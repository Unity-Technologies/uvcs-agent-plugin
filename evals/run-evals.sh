#!/usr/bin/env bash
#
# Run the promptfoo suite, name every test that failed, then re-run just those.
#
# Two problems this solves, both of which cost real debugging time:
#
#   1. promptfoo's console table truncates to the first 25 rows, so a red job
#      reports "2 failed" and nothing about *which* two. Whoever picks it up —
#      a person or an agent — has no way to tell a regression from noise without
#      re-running the whole suite locally. Every non-passing test is now printed
#      by description, with the assertion reason that rejected it.
#
#   2. At temperature 0 a prompt sitting on a decision boundary still flips about
#      one run in eight, so an untouched test can go red on an unrelated PR. The
#      old gate absorbed that by tolerating a single failure, which also hid a
#      real one-test regression. Instead, failures are re-run on their own
#      (`--filter-failing`, `--no-cache` so the response is genuinely re-rolled)
#      and only a test that fails *twice* fails the job.
#
# A test that passes only on the retry is reported as FLAKY, in the summary and
# as a PR annotation. That is not a pass to shrug at: per CLAUDE.md ("Writing
# evals that do not flake") a flip means the scenario has no margin, and the next
# skill edit will tip it for good. Fix the scenario, not the run.
#
# Usage:  evals/run-evals.sh [extra promptfoo eval flags]
# e.g.    evals/run-evals.sh --filter-pattern "An approved report is filed"
#
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "::error::evals/node_modules is missing — run 'npm ci' in evals/ first" >&2
  exit 1
fi

SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
CONFIG=promptfooconfig.yaml
mkdir -p output

run_suite() {
  local out="$1"; shift
  # promptfoo exits non-zero when tests fail; we want to read the results file
  # and decide ourselves, so swallow the status here.
  npx --no-install promptfoo eval -c "$CONFIG" -o "$out" \
    --no-share --max-concurrency 4 "$@" || true
  if [ ! -s "$out" ]; then
    echo "::error::promptfoo wrote no results to $out (it failed to start)"
    exit 1
  fi
}

stat_of() { jq -r ".results.stats.$1 // 0" "$2"; }

# "<description><TAB><why it failed>" for every non-passing row.
#
# A row carries the reason twice: once per failing assertion in
# gradingResult.componentResults, and again flattened into .error. Prefer the
# per-assertion reasons and fall back to .error, which is the only one populated
# when the provider itself errored rather than an assertion rejecting the output.
failing_rows() {
  jq -r '
    .results.results[]
    | select(.success == false)
    | [ (.gradingResult.componentResults // [])[]
        | select(.pass == false) | .reason ] as $reasons
    | [ (.testCase.description // "(no description)"),
        ( if ($reasons | length) > 0 then $reasons | join(" / ")
          else (.error // "no reason recorded") end
          | gsub("[\r\n\t]+"; " ") )
      ]
    | @tsv' "$1"
}

# Render failing_rows as a markdown list, reason trimmed — llm-rubric reasons run
# to paragraphs and the point here is to identify the test, not to re-read it.
report() {
  local title="$1" file="$2" annotation="${3:-}"
  {
    echo ""
    echo "### $title"
    echo ""
  } >> "$SUMMARY"
  while IFS=$'\t' read -r desc why; do
    [ -n "$desc" ] || continue
    echo "  - $desc — $why"
    echo "- **$desc** — ${why:0:400}" >> "$SUMMARY"
    if [ -n "$annotation" ]; then
      echo "::${annotation}::${desc} — ${why:0:400}"
    fi
  done < <(failing_rows "$file")
}

run_suite output/results.json "$@"

PASSES=$(stat_of successes output/results.json)
FAILS=$(stat_of failures output/results.json)
ERRORS=$(stat_of errors output/results.json)
TOTAL=$((PASSES + FAILS + ERRORS))

{
  echo "## Skill evals"
  echo ""
  echo "| Passed | Failed | Errors |"
  echo "|---|---|---|"
  echo "| $PASSES | $FAILS | $ERRORS |"
} >> "$SUMMARY"

if [ "$TOTAL" -eq 0 ]; then
  echo "::error::Evals matched no tests — check the config and any --filter flags"
  exit 1
fi

if [ $((FAILS + ERRORS)) -eq 0 ]; then
  echo "Evals passed: $PASSES/$TOTAL"
  exit 0
fi

echo "Failed on the first run:"
report "Failed on the first run" output/results.json

echo ""
echo "Re-running those $((FAILS + ERRORS)) test(s) to separate a regression from a boundary flip..."
run_suite output/retry.json "$@" --filter-failing output/results.json --no-cache

R_PASSES=$(stat_of successes output/retry.json)
R_FAILS=$(stat_of failures output/retry.json)
R_ERRORS=$(stat_of errors output/retry.json)

if [ $((R_FAILS + R_ERRORS)) -eq 0 ]; then
  {
    echo ""
    echo "⚠️ **$R_PASSES test(s) passed only on the retry.** At temperature 0 that means the"
    echo "scenario sits on a decision boundary and the next skill edit will tip it for good —"
    echo "move the scenario, do not re-roll it. See CLAUDE.md, *Writing evals that do not flake*."
  } >> "$SUMMARY"
  # The retry file holds only the retried tests, so every row in it is flaky.
  while IFS=$'\t' read -r desc _; do
    [ -n "$desc" ] || continue
    echo "::warning::Flaky eval (failed, then passed on retry): $desc"
    echo "- $desc" >> "$SUMMARY"
  done < <(jq -r '.results.results[] | [(.testCase.description // "(no description)"), ""] | @tsv' output/retry.json)
  echo "Evals passed on retry: $PASSES/$TOTAL first time, $R_PASSES recovered."
  exit 0
fi

echo "Still failing after the retry:"
report "Still failing after the retry" output/retry.json error
echo "::error::Evals failed: $((R_FAILS + R_ERRORS)) test(s) failed twice"
exit 1
