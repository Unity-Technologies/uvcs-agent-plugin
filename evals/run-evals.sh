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
#   2. The evaluated model's answers vary from run to run, so a test with a 95%
#      pass rate still goes red now and then on a PR that never touched it. One
#      sample cannot tell that apart from a regression; a few can. So a test that
#      fails is re-run on its own RETRIES times (`--filter-failing`, `--no-cache`
#      so every answer is genuinely re-rolled), and it fails the job only when
#      fewer than REQUIRED of those pass:
#
#        true pass rate   chance the job goes red on it (RETRIES=4, REQUIRED=3)
#        95%              0.07%
#        90%              0.5%
#        50%              34% — and reported as unstable every time it is retried
#        0% (broken)      100%
#
#      Only failing tests are re-run, so a clean suite costs one run.
#
# A test that fails and then passes the retries is reported as UNSTABLE, with
# its measured rate, in the summary and as a PR annotation. That is not a pass
# to shrug at: per CLAUDE.md ("Writing evals that do not flake") it means the
# scenario has little margin, and the next skill edit can tip it for good. Fix
# the scenario, not the run.
#
# --burn-in: the gate for a test a change can move. Instead of one run plus retries, every
# selected test runs BURN_IN_RUNS times (8) and must pass BURN_IN_REQUIRED (7) of them:
#
#        true pass rate   chance it passes the burn-in (8 runs, 7 required)
#        99%              99.7%
#        90%              81%
#        75%              37%
#        50%              3.5%
#
# The retry gate above lets a 75% test through most of the time, and it then fails one later
# pull request in fifteen, for whoever opens it. The burn-in stops it on the pull request that wrote or moved
# it, which is where the fix belongs. CI uses it for the tests a change can reach, and for
# every added or edited test even when the whole suite runs (reachable-tests.cjs).
#
# Usage:  evals/run-evals.sh [--burn-in] [extra promptfoo eval flags]
# e.g.    evals/run-evals.sh --filter-pattern "An approved report is filed"
#         evals/run-evals.sh --burn-in --filter-pattern "An approved report is filed"
#
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "::error::evals/node_modules is missing — run 'npm ci' in evals/ first" >&2
  exit 1
fi

SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
RETRIES="${EVAL_RETRIES:-4}"
REQUIRED="${EVAL_RETRY_PASSES:-3}"
BURN_IN_RUNS="${EVAL_BURN_IN_RUNS:-8}"
BURN_IN_REQUIRED="${EVAL_BURN_IN_PASSES:-7}"
CONCURRENCY="${EVAL_CONCURRENCY:-4}"
CONFIG=promptfooconfig.yaml
mkdir -p output

BURN_IN=false
if [ "${1:-}" = --burn-in ]; then
  BURN_IN=true
  shift
fi

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

if [ "$BURN_IN" = true ]; then
  run_suite output/burn-in.json "$@" --no-cache --repeat "$BURN_IN_RUNS"
  {
    echo "## Skill evals: burn-in ($BURN_IN_RUNS runs each, $BURN_IN_REQUIRED must pass)"
    echo ""
    echo "| Passed | Test |"
    echo "|---|---|"
  } >> "$SUMMARY"
  COUNT=0
  SHORT=()
  while IFS=$'\t' read -r passes runs desc why; do
    [ -n "$desc" ] || continue
    COUNT=$((COUNT + 1))
    echo "| $passes/$runs | $desc |" >> "$SUMMARY"
    if [ "$passes" -lt "$BURN_IN_REQUIRED" ]; then
      SHORT+=("$desc ($passes/$runs) — ${why:0:400}")
    fi
  done < <(retry_rates output/burn-in.json)
  if [ "$COUNT" -eq 0 ]; then
    echo "::error::Burn-in matched no tests — check the --filter-pattern"
    exit 1
  fi
  if [ "${#SHORT[@]}" -eq 0 ]; then
    echo "Burn-in passed: $COUNT test(s), each at least $BURN_IN_REQUIRED/$BURN_IN_RUNS."
    exit 0
  fi
  for t in "${SHORT[@]}"; do
    echo "::error::Short of margin: $t"
  done
  {
    echo ""
    echo "**${#SHORT[@]} test(s) passed fewer than $BURN_IN_REQUIRED of $BURN_IN_RUNS.** The scenario sits on a"
    echo "decision boundary and will fail later pull requests at random. Fix the scenario or the skill"
    echo "(CLAUDE.md, *Writing evals that do not flake*); re-running only re-rolls it."
  } >> "$SUMMARY"
  echo "::error::Burn-in failed: ${#SHORT[@]} test(s) passed fewer than $BURN_IN_REQUIRED of $BURN_IN_RUNS runs"
  exit 1
fi

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
echo "Re-running each of those $((FAILS + ERRORS)) test(s) $RETRIES times to measure its pass rate..."
run_suite output/retry.json "$@" --filter-failing output/results.json --no-cache --repeat "$RETRIES"

UNSTABLE=()
BROKEN=()
while IFS=$'\t' read -r passes runs desc why; do
  [ -n "$desc" ] || continue
  if [ "$passes" -ge "$REQUIRED" ]; then
    UNSTABLE+=("$desc ($passes/$runs on retry)")
  else
    BROKEN+=("$desc ($passes/$runs on retry) — ${why:0:400}")
  fi
done < <(retry_rates output/retry.json)

if [ "${#UNSTABLE[@]}" -gt 0 ]; then
  {
    echo ""
    echo "⚠️ **Unstable:** these failed once, then passed at least $REQUIRED of $RETRIES retries."
    echo "The scenario has little margin — see CLAUDE.md, *Writing evals that do not flake*."
  } >> "$SUMMARY"
  for t in "${UNSTABLE[@]}"; do
    echo "::warning::Unstable eval: $t"
    echo "- $t" >> "$SUMMARY"
  done
fi

if [ "${#BROKEN[@]}" -eq 0 ]; then
  echo "Evals passed: $PASSES/$TOTAL first time, ${#UNSTABLE[@]} unstable."
  exit 0
fi

{
  echo ""
  echo "### Failed: fewer than $REQUIRED of $RETRIES retries passed"
  echo ""
} >> "$SUMMARY"
for t in "${BROKEN[@]}"; do
  echo "::error::$t"
  echo "- **$t**" >> "$SUMMARY"
done
echo "::error::Evals failed: ${#BROKEN[@]} test(s) passed fewer than $REQUIRED of $RETRIES retries"
exit 1
