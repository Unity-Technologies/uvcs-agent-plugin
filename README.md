# Unity Version Control agent plugin

Teach your AI coding agent to use **Unity Version Control** (UVCS, formerly Plastic SCM).

The plugin is a set of [Agent Skills](https://agentskills.io) packaged as an
[Agent Plugin](https://agent-plugins.org). It gives the agent working knowledge of the `cm`
command line and of common UVCS workflows: reading history, reviewing a branch, finding the
changeset that broke something, merging, and switching branches. There is nothing to build and
no service to run. The agent reads the skills and drives the `cm` CLI you already have.

It works with Claude Code, Codex, Cursor, Copilot, and any other agent that supports Agent
Skills.

> **Early development.** Skill names and scope may change before 1.0.

## What you can ask

Once installed, just describe the task. The agent picks the right skill.

- "Review branch `/main/scm-12345` and tell me what looks risky."
- "This test started failing last week. Find the changeset that broke it."
- "Which changesets on `/main` touched `Editor/Inspector/` in the last month?"
- "Merge `/main` into my branch and resolve the conflicts."
- "Switch to a new branch for this task. Keep my pending changes."
- "Give me a link to changeset 41827 so I can paste it in the ticket."

Read-only work such as searching, diffing and reviewing runs without asking. Anything that
changes a repository, such as check-in, merge, undo or deleting a branch, asks you first.

Results include clickable links: `unityhub://` when the workspace is a Unity project, and
`plastic://` (the UVCS desktop client) otherwise.

## Before you install

- The **`cm` command line** must be on your `PATH`. It ships with
  [Unity Version Control](https://unity.com/solutions/version-control). Check with `cm version`.
- `cm` must already be **signed in to your server**. Check with `cm whoami`.
- Tasks that touch local files need a UVCS **workspace**. Server-side questions about history
  and branches work without one.

## Install

### Claude Code

```
/plugin marketplace add Unity-Technologies/unity-version-control-plugin
/plugin install unity-version-control@unity
```

Or from a terminal:

```bash
claude plugin marketplace add Unity-Technologies/unity-version-control-plugin
claude plugin install unity-version-control@unity
```

### Codex, Cursor, Copilot, Gemini CLI, OpenCode, Zed and others

```bash
npx skills add Unity-Technologies/unity-version-control-plugin --skill '*'
```

Keep `--skill '*'`. Every skill depends on `uvcs-core`, so installing one skill alone does not
work. Add `-g` to install for all projects, or `-a <agent>` to choose one agent when several are
installed.

### Clients that implement Agent Plugins 1.0

Install the plugin from the repository URL. In VS Code, run *Chat: Install Plugin From Source*.
Other clients have an equivalent "install plugin from Git URL" command.

```
https://github.com/Unity-Technologies/unity-version-control-plugin
```

### Manual

Clone the repository, or download the zip from the
[Releases page](https://github.com/Unity-Technologies/unity-version-control-plugin/releases).
Then copy the `skills/*` directories to wherever your agent looks for skills.

We have tested the Claude Code and `npx skills` routes ourselves. The other routes follow each
client's documentation. If you verify one, please [tell us](CONTRIBUTING.md).

## Update

| Installed with | You get | Update with |
| -------------- | ------- | ----------- |
| `/plugin install` | the latest release | `claude plugin update unity-version-control` (see below) |
| `npx skills add` | the `main` branch | `npx skills update` |

Claude Code reads the available versions from its cached copy of the marketplace, so refresh that
first or the update finds nothing new. Both commands run from a terminal, and Claude Code has to
be restarted for the new version to load.

```bash
claude plugin marketplace update unity
claude plugin update unity-version-control      # or unity-version-control@unity
```

`main` is kept release-quality. Every change passes skill validation and a behavioral test
suite before merge.

## Skills

| Skill | What it does |
| ----- | ------------ |
| `uvcs-core` | The hub. UVCS concepts and how they differ from git, object specs, the `cm` command reference, and how to report results with deep links. Every other skill builds on it. |
| `uvcs-code-review` | Review a branch, changeset, shelve or pending changes, and publish the findings as merge request or code review comments. |
| `uvcs-address-review` | The author side of a review: apply the requested changes, answer questions, and re-request the review. |
| `uvcs-root-cause` | Trace a bug, crash or failing test back to the changeset that introduced it. Read-only. |
| `uvcs-merge` | Merge a branch, changeset, label or shelve and resolve conflicts without opening a merge tool. |
| `uvcs-switch` | Switch the workspace to another branch, creating it if needed, and keep or shelve pending changes. |

## Project-specific review rules

`uvcs-code-review` reviews with a general-purpose rule set (the reviewer prompt in
`skills/uvcs-code-review/assets/review-prompt.md`): confidence-gated findings, four severities,
a concrete fix on every blocker. Your project probably has rules of its own: what is always a
blocker here, what to check that the diff will not show, conventions no linter enforces, what
not to comment on. Give the reviewer those by adding **one skill to your project**, named
`code-review-rules`. The review skill finds it by name, merges it with its general rules, and
lets your rules win wherever the two conflict. No configuration, no registration.

1. Copy the template to your project's skills directory, as `code-review-rules/SKILL.md`:

   | Agent | Directory |
   | ----- | --------- |
   | Codex, Cursor, Copilot | `.agents/skills/code-review-rules/SKILL.md` |
   | Claude Code | `.claude/skills/code-review-rules/SKILL.md` |

   Template: [`skills/uvcs-code-review/assets/code-review-rules-template.md`](skills/uvcs-code-review/assets/code-review-rules-template.md).
   Or ask the agent: *"Set up code review rules for this project"* — it creates the file from
   the same template for you to fill in.

2. Fill in the sections you need and delete the rest. Keep the frontmatter: the `description` is
   how the skill is recognised, and the file is only ever read by the review skill, never run as
   a workflow on its own.

3. Check it in. Everyone on the project, on every agent, now reviews with the same rules.

A checklist the user pastes into the request works the same way, and a project can also replace
the default severity names with its own in the template's last section.

## Contributing

Contributions are welcome, especially real `cm` recipes and workflows. Read
[CONTRIBUTING.md](CONTRIBUTING.md) first. One rule matters above all: every `cm` command must be
verified against a real CLI, never remembered.

- **Bugs and feature requests:** [GitHub issues](https://github.com/Unity-Technologies/unity-version-control-plugin/issues)
- **Security reports:** [SECURITY.md](SECURITY.md)

## License

[Apache License 2.0](LICENSE). See [NOTICE](NOTICE).

Unity Version Control and Plastic SCM are trademarks of Unity Technologies.
