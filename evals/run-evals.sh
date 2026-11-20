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
#   2. The evaluated model's answers vary from run to run, so a sound test still
#      misses now and then on a PR that never touched it. A test that fails is
#      re-run on its own RETRIES times (`--filter-failing`, `--no-cache` so every
#      answer is genuinely re-rolled), and one pass settles it. Only a test that
#      fails its first run and every retry fails the job:
#
#        true pass rate   chance the job goes red on it (RETRIES=3)
#        95%              0.0006%
#        80%              0.16%
#        50%              6%
#        0% (broken)      100%
#
#      Each test runs once; only a failing one runs again. The goal is a CI that is
#      green unless something is really broken: a PR reaches dozens of tests at a
#      time, and any gate that asks each of them for a pass *rate* goes red on noise
#      (8 runs needing 7 failed a 64-test PR about half the time at 98% per test).
#
# The retries are a safety net, not the design. An eval must pass on its FIRST
# run (CLAUDE.md, "Writing evals that do not flake"): one that needed a retry is
# reported as UNSTABLE, a defect in the test to fix in a PR of its own. It does not
# fail this job, so an author is never blocked by a test their change did not break.
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
RETRIES="${EVAL_RETRIES:-3}"
CONCURRENCY="${EVAL_CONCURRENCY:-4}"
CONFIG=promptfooconfig.yaml
mkdir -p output

run_suite() {
  local out="$1"; shift
  # promptfoo exits non-zero when tests fail; we want to read the results file
  # and decide ourselves, so swallow the status here.
  npx --no-install promptfoo eval -c "$CONFIG" -o "$out" \
    --no-share --max-concurrency "$CONCURRENCY" "$@" || true
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

# "<passes><TAB><runs><TAB><description><TAB><last failure reason>" per retried test.
retry_rates() {
  jq -r '
    [.results.results[]
     | { d: (.testCase.description // "(no description)"), ok: .success,
         why: ( [ (.gradingResult.componentResults // [])[] | select(.pass == false) | .reason ]
                | if length > 0 then join(" / ") else "" end ) }]
    | group_by(.d)[]
    | [ (map(select(.ok)) | length), length, .[0].d,
        ((map(select(.ok | not)) | last | .why) // "" | gsub("[\r\n\t]+"; " ")) ]
    | @tsv' "$1"
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
echo "Re-running each of those $((FAILS + ERRORS)) test(s) up to $RETRIES times; one pass settles it..."
run_suite output/retry.json "$@" --filter-failing output/results.json --no-cache --repeat "$RETRIES"

UNSTABLE=()
BROKEN=()
while IFS=$'\t' read -r passes runs desc why; do
  [ -n "$desc" ] || continue
  if [ "$passes" -ge 1 ]; then
    UNSTABLE+=("$desc ($passes/$runs on retry)")
  else
    BROKEN+=("$desc ($passes/$runs on retry) — ${why:0:400}")
  fi
done < <(retry_rates output/retry.json)

if [ "${#UNSTABLE[@]}" -gt 0 ]; then
  {
    echo ""
    echo "⚠️ **Unstable — fix these tests:** each failed its first run and passed only on a retry."
    echo "An eval must pass on its first run. Fix the scenario, not the run — see CLAUDE.md,"
    echo "*Writing evals that do not flake*."
  } >> "$SUMMARY"
  for t in "${UNSTABLE[@]}"; do
    echo "::warning::Unstable eval, needed a retry (an eval must pass on its first run — fix the scenario): $t"
    echo "- $t" >> "$SUMMARY"
  done
fi

if [ "${#BROKEN[@]}" -eq 0 ]; then
  echo "Evals passed: $PASSES/$TOTAL first time, ${#UNSTABLE[@]} unstable."
  exit 0
fi

{
  echo ""
  echo "### Failed: the first run and all $RETRIES retries"
  echo ""
} >> "$SUMMARY"
for t in "${BROKEN[@]}"; do
  echo "::error::$t"
  echo "- **$t**" >> "$SUMMARY"
done
echo "::error::Evals failed: ${#BROKEN[@]} test(s) failed the first run and all $RETRIES retries"
exit 1
