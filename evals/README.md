# Skill evals

[Promptfoo](https://www.promptfoo.dev/) suite for `skills/uvcs-cli-reference`. It checks that a
model with the skill loaded composes correct `cm` commands and respects the safety rules.

## Design principles

- **Fast and cheap.** One small evaluated model (Claude Haiku), `temperature: 0`,
  `max_tokens: 1024`, and 13 tests. Most assertions are deterministic string checks
  (`icontains` / `not-icontains`); `llm-rubric` is used only where a string match cannot
  express the requirement (a few assertions, judged by one Sonnet call each).
- **Green means minimum quality; red means something broke.** Every test pins a behavior the
  skill exists to teach (query grammar rules, flag names, output formats) — not stylistic
  preferences. If you edit the skill and a test goes red, the edit removed or weakened one of
  those behaviors. CI allows a single failure (`fail-on-threshold: 90`) to absorb rare judge
  flakiness; two or more failures fail the PR.
- Tests load the same files an agent would: `SKILL.md` always, plus the one reference the task
  calls for.

## Running locally

```bash
export ANTHROPIC_API_KEY=<your key>
cd evals
npm ci
npm run eval
npx promptfoo view      # browse results
```

Promptfoo is version-pinned in `package.json` so local runs and CI evaluate with the same
tool version.

## CI

`.github/workflows/skill-evals.yml` runs the suite on pull requests that touch `skills/**` or
`evals/**` (plus manual `workflow_dispatch` runs). Results land in the job's step summary;
the job fails when two or more tests fail (one failure is tolerated to absorb rare judge
flakiness). The pinned promptfoo install is cached on `package-lock.json`, so warm runs skip
the install entirely.

Authentication uses **Anthropic Workload Identity Federation** — no API key secret in the repo.
The job exchanges its GitHub OIDC token for a short-lived Anthropic access token and passes it
to promptfoo as a bearer header (`ANTHROPIC_CUSTOM_HEADERS`). One-time setup
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

Until the variables are set, the eval job skips itself. OIDC tokens are not issued to PRs from
forks, so the job also skips those; a maintainer pushes the branch to this repo to run the
suite.

## Adding tests

Add cases to `tests/*.yaml` (grouped by theme: `queries`, `commands`). Prefer
deterministic assertions; reserve `llm-rubric` for semantics. Every test should encode a fact
verified against a real `cm` — the same bar as the skill content itself. Keep the suite small:
each test costs tokens on every PR, so a new test must guard a behavior whose silent regression
would actually hurt users.
