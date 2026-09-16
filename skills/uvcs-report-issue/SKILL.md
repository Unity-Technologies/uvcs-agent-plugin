---
name: uvcs-report-issue
description: >-
  Report a defect or a gap in this UVCS agent plugin itself — a cm command or flag a skill gave
  that cm rejected, a fact a reference gets wrong, a recipe or workflow that is missing, a skill
  that did not trigger or behaved differently in another agent, or a result that was not what the
  user asked for — as a GitHub issue on the plugin's repository, with a redacted, reproducible
  scenario a maintainer can turn into a fix and an eval. Use when the user says report this bug,
  file an issue, the plugin or the skill got it wrong, request a skill or a workflow, or when
  uvcs-core flags a rejected recipe. Not for problems in UVCS, cm or a server themselves, and not
  for bugs in the user's own code.
---

# Reporting a plugin issue

Issues go to the plugin's **public** tracker,
`https://github.com/Unity-Technologies/unity-version-control-plugin/issues`. Whoever picks one up,
a person or an agent, fixes it from the report alone: it must let them reproduce the scenario
without asking a question, and it must carry nothing from the user's project that they did not
mean to publish. Everything here is read-only except the filing itself.

## 1. Is it ours?

| What happened | Where it goes |
|---|---|
| A command copied from a skill or reference that `cm` rejected (`Unexpected option`, an unknown field, a wrong object), once `cm help <command>` confirmed the skill is the wrong side | here, **bug** |
| A fact in a skill contradicted by `cm` output, by `cm help`, or by another reference | here, **bug** |
| A skill drove the wrong workflow, or stopped to ask (or failed to) at the wrong place; the wrong skill fired, or none did; it works in one agent and not another | here, **bug** |
| No recipe, reference or skill for a task the user needed; something that would have made the result better | here, **enhancement** |
| `cm` itself crashes, a server is unreachable, sign-in or permission errors, a GUI problem | UVCS product support (`https://support.unity.com/`), not this tracker |
| A bug in the user's code or repository history | not an issue at all: `uvcs-root-cause` |
| A credential in a skill, or any security problem in the plugin | never a public issue: `SECURITY.md` in the repository |

The check that settles the first row is the evidence the report needs:

```
cm help <command>
```

## 2. Collect

```
cm version
```

Plus, from the machine: OS, the shell `cm` ran in (PowerShell, Git Bash, zsh, …), the agent client
and its version if known, how the plugin was installed and its version (`version` in the
`plugin.json` beside the `skills/` directory when there is one, otherwise the install route).

From the session: the user's request verbatim; every command run, with its full output, trimmed
to the relevant part and never paraphrased; what should have happened, with the evidence
(the `cm help` output, a GUI behaviour, another reference); and the skill file plus the **exact
lines followed, quoted**. The quote identifies the content whatever version is installed, so it is
never optional. Nothing is re-run to gather evidence: the report describes what happened.

## 3. Write the reproduction as a test

Every fix in the plugin lands with an eval, and an eval is a user message, the command output
pasted into it, and what the answer must and must not contain. Write the **Reproduction** section
in exactly that shape so a maintainer can lift it:

- **One behaviour per report.** Two defects are two issues.
- **Complete inputs.** The actual `cm status --header` line, the actual `--machinereadable` rows,
  redacted — never "a few changed files".
- **Any decision the user made mid-way** is stated in the message ("I have already decided:
  bring them along").
- **Must contain** names the command or fact that had to appear; **must not contain** names the
  one that did.

## 4. Redact

| Real | Placeholder |
|---|---|
| organization and server (`myorg@cloud`, `plastic.example.com:8087`) | `<org>@cloud`, `<server>` |
| repository | `<repo>` |
| user names, emails, `cm whoami` | `<user>`, `<user2>` |
| paths or file names that name the product; any code beyond the lines the repro needs | `<path>/File.cs`; drop it |
| changeset, branch, shelve and review comments naming people, tickets or products | `<comment>` |
| keep | changeset and shelve ids, branch *structure* (`/main/task001`), error messages verbatim, flag names, counts |

Redact consistently so the report still parses (`<repo>@<org>@cloud`, not three unrelated
placeholders for one server). The user's own request is redacted the same way. When it is not
obvious whether something is sensitive, ask.

## 5. Show it, then file it

Filing publishes. Fill `assets/issue-template.md`, show the user the **complete** text — title,
label and body, not a summary — and wait for a yes. Then, in order:

```
gh auth status
gh issue list --repo Unity-Technologies/unity-version-control-plugin --state all --search "<two or three words from the title>"
gh issue create --repo Unity-Technologies/unity-version-control-plugin --title "[<skill>] <symptom>" --label bug --body-file <tmp>.md
```

- **Title:** `[<skill>] <one-line symptom>` — `[uvcs-core] commands.md gives cm log a --nototal
  flag cm rejects`. `[new skill]` when the request fits none.
- **Label:** `bug` or `enhancement`, nothing else — other labels may not exist and the command
  fails on one that does not.
- **A match in the search:** show it, and offer to add the scenario there instead:
  `gh issue comment <n> --repo Unity-Technologies/unity-version-control-plugin --body-file <tmp>.md`.
- **`gh` missing or not signed in:** save the body to a file, give its path, and give the form
  link for the user to paste it into —
  `https://github.com/Unity-Technologies/unity-version-control-plugin/issues/new?template=bug_report.yml`
  (`skill_request.yml` for an enhancement). Do not sign the user in.
- Report the issue URL back, as a link.

## Offering to report

The `uvcs-core` hub asks for this offer when a recipe it gave was rejected, contradicted or
missing. Finish the user's task first — the corrected command from `cm help` — and then offer
**once**, in one sentence: what went wrong, that it is a plugin defect, and that you can file it.
The same offer applies when the user says the plugin did not do what they asked. If they decline,
do not raise it again in the session. Never file unasked, and never file without the user having
read the text.
