# Skill evals

[Promptfoo](https://www.promptfoo.dev/) suite for the plugin's skills. It checks that a model
with a skill loaded composes correct `cm` commands, reports results the way `uvcs-core`
prescribes, and respects the safety rules.

## Design principles

- **Fast and cheap.** One small evaluated model (Claude Haiku), one API call per test. Most
  assertions are deterministic checks; `llm-rubric` is used only where a string match cannot
  express the requirement (a minority of assertions, judged by one Sonnet call each).
- **Model-agnostic.** No test may depend on how one model phrases things:
  - *"must not run X"* is `assertions/commands.cjs:notRun`, which reads only the command lines in
    fenced code blocks — a model that explains "this does not use `--discard`" is not running
    it. `not-icontains` is for text that must not appear anywhere (redacted names, a link form);
  - the evaluated model's answers vary from run to run (Claude 5 models take no `temperature`),
    so the gate in `run-evals.sh` measures a pass rate instead of assuming one answer per prompt.

  Changing model family is the two `id:` lines in `promptfooconfig.yaml` plus whatever
  parameters that family accepts — and a full-suite measurement before merging.
- **Green means minimum quality; red means something broke.** Every test pins a behavior the
  skill exists to teach (query grammar rules, flag names, output formats, reporting notation)
  — not stylistic preferences. If you edit the skill and a test goes red, the edit removed or
  weakened one of those behaviors.
- Tests load the same files an agent would: `SKILL.md` always, plus the one reference the task
  calls for. Workflow-skill tests override `skill_content` with that skill and pass the hub
  reference it points at — which is also how the hub/workflow split gets exercised.

## Running locally

No credentials to set up, and no local variant of the config — the same
`promptfooconfig.yaml` CI runs works as-is:

```bash
cd evals
npm ci                  # first time only
npm run eval
npx promptfoo view      # browse results
```

This works because promptfoo resolves Anthropic credentials in order — `apiKey` in the
provider config, then `ANTHROPIC_API_KEY`, then **the Claude Code OAuth credential from
your local session**. With no API key in the environment it falls through to the third,
which is why a machine logged into Claude Code needs nothing else. (`apiKeyRequired: false`
on both providers is what lets it get that far instead of failing the startup key check.)
Confirm which path was taken in the debug log:

```
[anthropic] Authenticating with Claude Code OAuth credential from local session.
```

The same ordering is what lets CI pick its credential without a config change: the API-key
path exports `ANTHROPIC_API_KEY` and stops at step two, and the WIF path exports a
*placeholder* `ANTHROPIC_API_KEY` alongside the bearer header so it also stops at step two
and never reaches the OAuth fallback. To use a real API key locally, `export
ANTHROPIC_API_KEY=<key>` — it takes precedence with no config change.

Promptfoo is version-pinned in `package.json` so local runs and CI evaluate with the same
tool version, and the config names the evaluated model, so local runs and CI evaluate the same
model.

While iterating on one skill, narrow the run to the tests that load the file you changed (the
selection rule is in `CLAUDE.md`) — the full suite is about 70 tests, **90 seconds** and roughly
**$0.50** of API usage (locally it draws on your Claude Code subscription instead):

```bash
npx --no-install promptfoo eval --filter-pattern "shelve"   # only matching tests
npx --no-install promptfoo eval --no-cache                  # ignore cached results
```

### `run-evals.sh` — what CI runs

`./run-evals.sh` is the exact entry point CI uses, and it is worth using locally for the same
two reasons. It **names every failing test** (promptfoo's own table truncates at 25 rows, so a
plain run tells you *how many* failed and not *which*), and it **re-runs each failure 4 times**
with `--no-cache` to measure its pass rate, so a one-off miss separates itself from a regression
in one command. It takes any `promptfoo eval` flag:

```bash
./run-evals.sh                                        # whole suite
./run-evals.sh --filter-pattern "An approved report"  # one test, same reporting
./run-evals.sh --burn-in --filter-pattern "…"         # 8 runs each, 7 must pass
node reachable-tests.cjs --edited-since origin/main   # what CI burns in for your edits
```

`--burn-in` is the gate for a test a change can move: it is what CI runs on the reached tests,
and on every added or edited test (`EVAL_BURN_IN_RUNS` / `EVAL_BURN_IN_PASSES`). Locally it is a
smoke check only — the local sign-in adds a system prompt CI does not have, so measure margin in
CI: `gh workflow run skill-evals.yml --ref <branch> -f burn_in='^(?:<description>)$'`.

Exit status is 1 when a test that failed passes fewer than 3 of its 4 retries, 0 otherwise
(`EVAL_RETRIES` / `EVAL_RETRY_PASSES` change the numbers; the trade-off is tabulated at the top of
the script). A test that failed and then passed its retries is reported as **unstable**, with its
rate — treat that as a scenario with too little margin, not as a pass: see *Writing evals that do
not flake* in `CLAUDE.md`.

## CI

`.github/workflows/skill-evals.yml` runs the suite through `run-evals.sh`, limited to the tests
the change can reach (`reachable-tests.cjs`, by the table in `CLAUDE.md`, "Workflow for changes
here", step 3): a test whose prompt carries no changed file can only re-roll its own noise. A
change no test loads, such as a README fix or a doc in `evals/`, runs none and passes; a changed
test file runs the tests in it; a change to the config, the runner, an assertion, the install or
the workflow runs everything. Reached tests are **burned in** (8 runs, 7 must pass) rather than
run once; a whole-suite run takes one pass with retries and burns in only the tests the change
adds or edits. `suite-rules.test.cjs` lints the mechanical anti-flake rules before any API call.
A weekly scheduled run takes the whole suite, to catch drift no
file change causes (the hosted model or the judge changing). The step summary
lists the tests that failed and why, unstable tests are raised as PR warning annotations, and
the full `results.json` / `retry.json` are attached to the run as the `eval-results` artifact for
when you need the model output behind a failure. The pinned promptfoo install is cached on
`package-lock.json`, so warm runs skip the install entirely.

The gate used to be "two or more failures fail the job", which hid a genuine single-test
regression, and then "a test that fails twice fails the job", which assumed a temperature-0 model
that answers one prompt the same way every time. Claude 5 models cannot be pinned, so the gate now
samples: a failure is retried 4 times and must pass 3.

### When it runs — and where an outside PR gets verified

The suite runs only in the development repository. The public repository is a read-only mirror
of its `main` and release tags (`.github/workflows/mirror.yml`), holds no credential, and skips
this job: nothing is merged there. In the development repository:

| Trigger | Runs? | Why |
|---|---|---|
| `pull_request`, branch in the repository | yes, the reachable tests, burned in | The gate: `evals` is a required check, and there is no merge queue. |
| `pull_request` from **Dependabot** | yes, the same | Dependabot runs get the Dependabot secrets, so `ANTHROPIC_API_KEY` is stored there too. |
| `workflow_dispatch` | yes, the whole suite | Manual, including in your own fork with your own key. |
| `schedule` (weekly) | yes, the whole suite | Drift no pull request causes. |

An outside contribution is opened on the public repository and reviewed there. Once approved, a
maintainer fetches it into the development repository and opens it there as a branch of its own:

```bash
git fetch public pull/<n>/head:contrib/<n>
git push origin contrib/<n>
```

From that point it is an ordinary in-repository PR: the evals run on it, and it cannot merge
until they pass. After the merge, the mirror carries the
commits to the public repository with the contributor still the author, and the maintainer closes
the public PR with a link to them.

Why it is shaped this way: a workflow that evaluates a pull request runs that pull request's
code, and here that code — `evals/` and the workflow itself — is exactly what a contribution
changes, so whatever credential the job holds is readable by the change under test. There is no
sandbox to put around a suite whose executable surface is the thing under review. Keeping the
credential in a repository that only ever runs commits a maintainer has already read — and
bringing outside code in only after that read — leaves nothing for an unreviewed change to reach.
`pull_request_target` was rejected for the same reason (secrets plus a checkout of contributor
code is the documented pwn-request pattern), and so was evaluating public PRs from the
development repository automatically, which is the same exposure with an extra hop.

The PR run is the only run: once green, the PR merges without a queue and without the branch
being brought up to date with `main`. The weekly scheduled run of the whole suite is what notices
an interaction between two PRs that were each green on their own.

### Authentication

The workflow has two auth paths and runs exactly one of them, chosen by the `ANTHROPIC_AUTH`
repository variable. Both leave the credential in the environment promptfoo already reads, so
nothing else in the workflow or in this directory changes when the mode does.

| `ANTHROPIC_AUTH` | Needs | State |
|---|---|---|
| `api-key` | the `ANTHROPIC_API_KEY` **secret** | **in use** |
| `wif` (default when the variable is unset) | the four federation variables below | intended end state, currently blocked |

**Why not WIF today.** The token exchange itself succeeds, but the federated service account
resolves to an organization with no API credits, so every eval call returns `Your credit
balance is too low to access the Anthropic API` (400, `invalid_request_error`). That is an
account/billing problem, not a workflow one, so the WIF step is kept intact and the job runs
on a key in the meantime.

**Switching back to WIF** once the account is funded: set `ANTHROPIC_AUTH` to `wif` (or delete
the variable) and delete the `ANTHROPIC_API_KEY` secret. No file in this repo needs to change.

#### `api-key` mode

One secret, `ANTHROPIC_API_KEY`, stored twice with the same value: under Settings → Secrets and
variables → **Actions** for ordinary runs, and under **Dependabot** for Dependabot's PRs, which
get only that store. Exported into the job as-is. The key is workspace-scoped and used by CI only — rotate it in
the Console and update both copies; nothing else refers to it. The job fails with an explicit
error if the mode is `api-key` and the secret is empty.

#### `wif` mode

**Anthropic Workload Identity Federation** — no API key secret in the repo. The job exchanges
its GitHub OIDC token for a short-lived Anthropic access token and passes it to promptfoo as a
bearer header (`ANTHROPIC_CUSTOM_HEADERS`). One-time setup
([docs](https://platform.claude.com/docs/en/manage-claude/wif-providers/github-actions)):

1. In the Claude Console: **Settings → Workload identity → Connect workload → GitHub Actions**.
   Register the issuer (`https://token.actions.githubusercontent.com`), create a service
   account, and create a federation rule matching this repository
   (`subject_prefix: "repo:<owner>/<repo>:"` + `claims.repository_owner`), audience
   `https://api.anthropic.com`.
2. Set these **repository variables** (Settings → Secrets and variables → Actions →
   Variables — they are identifiers, not secrets): `ANTHROPIC_FEDERATION_RULE_ID`,
   `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID`, and (if the rule spans
   multiple workspaces) `ANTHROPIC_WORKSPACE_ID`.

In `wif` mode the job skips itself until those variables are set, and a skipped job satisfies the
required check, so a variable deleted by mistake turns the gate green without running it. Check the variables
after touching them.

Whichever mode is active, the public mirror never runs the job (see *When it runs* above). Both auth steps deliberately run **after** `npm ci`: written
into the environment before the install, the credential would be visible to every install script
in promptfoo's dependency tree, on exactly the lockfile-changing PRs that miss the cache.

## Adding tests

Add cases to `tests/*.yaml` (one file per hub area or workflow skill; `promptfooconfig.yaml`
lists them). Prefer
deterministic assertions; reserve `llm-rubric` for semantics. Every test should encode a fact
verified against a real `cm` — the same bar as the skill content itself. Keep the suite small:
each test costs tokens on every PR, so a new test must guard a behavior whose silent regression
would actually hurt users. Before adding or changing a test, read *Writing evals that do not
flake* in the root `CLAUDE.md` — the rules there each come from a test that flaked.
