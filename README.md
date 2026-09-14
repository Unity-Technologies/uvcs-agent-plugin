# Unity Version Control agent plugin

Teach your AI coding agent to work with **Unity Version Control** (UVCS, formerly Plastic SCM).

This is an [Agent Plugin](https://agent-plugins.org) — a portable bundle of
[Agent Skills](https://agentskills.io) that gives an agent working knowledge of the `cm`
command line and of the UVCS workflows built on top of it: exploring history, reviewing a
branch, tracing a regression back to the changeset that caused it, and producing deep links so
results are clickable — `unityhub://` links that open the object in the Unity Editor when the
workspace is a Unity project, `plastic://` links that open the UVCS desktop GUI when it is not.

It ships knowledge, not a runtime. There is nothing to build and nothing to run as a service:
your agent reads the skills and drives the `cm` CLI you already have installed.

> **Status: early development (0.1.0).** Skills are being added. Expect the set of skills and
> their names to change before 1.0.

## Why

Agents are good at reasoning about code and bad at guessing a CLI they have never seen. Left
alone, an agent asked to "review this branch" will invent `git`-shaped commands, mistake
changesets for commits, and produce output nobody can click through. These skills close that
gap: they encode what a model cannot infer — UVCS concepts, exact `cm` syntax, machine-readable
output formats, and the order of operations for real workflows — and deliberately leave out
everything a capable model already does well.

## What's inside

```
plugin.json          Agent Plugins 1.0 manifest
skills/              One directory per skill, each with a SKILL.md
```

| Skill | Purpose | Status |
| ----- | ------- | ------ |
| `uvcs-core` | The hub: UVCS concepts vs git, object specs, how to report changesets and build `unityhub://` / `plastic://` deep links, read-only vs mutating commands — plus the full `cm` reference in its `references/`. Every other skill builds on it. | ✅ Available |
| `uvcs-merge` | Merge a branch, changeset, label, or shelve and drive it to a resolved workspace without a merge tool window. | ✅ Available |
| `uvcs-switch` | Move the workspace to another branch (creating it first if needed), handling pending changes the way the GUIs do: leave them on a shelve, or bring them across. | ✅ Available |
| `uvcs-root-cause` | Root cause analysis: trace a symptom to the changeset that introduced it. | ✅ Available |
| `uvcs-code-review` | Review a branch, changeset, shelve, or your pending changes, and publish the findings as merge request or code review comments. | ✅ Available |
| `uvcs-address-review` | The author side: apply the change requests a reviewer left, answer their questions, and re-request the review. | ✅ Available |

Skill names are `uvcs-`prefixed so they stay unambiguous when installed alongside other plugins.

The shape is deliberate: **one hub, and workflow skills that own judgement.** `uvcs-core`'s body
carries only what every UVCS task needs, with `cm` syntax one level down in
`references/commands.md` and friends. A workflow skill like `uvcs-merge` decides *what to do and
in what order* and prints the exact command it runs — it never restates the hub's flag tables or
output formats, so there is a single place to fix a command when `cm` changes.

## Requirements

- The **`cm` command line** on your `PATH`. It ships with
  [Unity Version Control](https://unity.com/solutions/version-control) (desktop client or the
  standalone CLI). Verify with `cm version`.
- A configured UVCS **server and credentials** — the skills assume `cm` is already able to talk
  to your organization. Check with `cm whoami` and `cm lrep`.
- A UVCS **workspace** for anything that inspects local files. Purely server-side queries
  (`cm find`, `cm log`) work without one.
- An AI agent that supports Agent Skills or Agent Plugins (see below).

## Install

Distribution is deliberately outside the Agent Plugins spec, so there is no one command that
works everywhere. Pick the line for your agent.

### Claude Code

This repository is its own marketplace. Register it, then install from it:

```
/plugin marketplace add Unity-Technologies/unity-version-control-plugin
/plugin install unity-version-control@unity
```

The same two steps from a terminal, without starting a session:

```bash
claude plugin marketplace add Unity-Technologies/unity-version-control-plugin
claude plugin install unity-version-control@unity
```

### Any other agent

The skills install into Codex, Cursor, Gemini CLI, OpenCode, Copilot, Zed and ~70 more with one
command:

```bash
npx skills add Unity-Technologies/unity-version-control-plugin --skill '*'
```

Keep the `--skill '*'`. Every workflow skill builds on `uvcs-core`, so installing one on its own
leaves it pointing at a hub that is not there. Add `-g` to install for every project rather than
the current one, and `-a <agent>` to pick a specific agent when several are installed.

### Clients that implement Agent Plugins 1.0

The root `plugin.json` is all these clients need, so they install straight from the repository
URL with no marketplace involved — in VS Code, *Chat: Install Plugin From Source*; elsewhere the
equivalent "install plugin from a Git URL" command:

```
https://github.com/Unity-Technologies/unity-version-control-plugin
```

### Manual

```bash
git clone https://github.com/Unity-Technologies/unity-version-control-plugin.git
```

Or download `unity-version-control-<version>.zip` from the
[Releases page](https://github.com/Unity-Technologies/unity-version-control-plugin/releases) and
unzip it — each release ships a `.sha256` next to the archive if you want to verify it. Then
point your client's plugin or skills install path at the directory, or copy the `skills/*`
directories where it looks for skills.

We have verified the Claude Code and `npx skills` routes ourselves; the rest follow each client's
documented mechanism. Verified one-liners will be added as we test each client — if you work one
out, please [contribute it](CONTRIBUTING.md).

## Updating

The two main routes do not track the same thing, which is worth knowing before you pick one:

| Installed with | Follows | Update with |
| -------------- | ------- | ----------- |
| `/plugin install` | the `version` in the manifest — pinned until a release bumps it | `/plugin update unity-version-control` |
| `npx skills add` | the default branch, compared by content hash | `npx skills update` |

So marketplace installs sit on the last release and `npx skills` installs sit on `main`. We keep
`main` release-quality — every PR runs skill validation and the behavioural eval suite — so the
difference is which fixes you have, not whether the skills work.

## Usage

Once installed, you do not invoke skills directly — describe the task and the agent picks the
right one:

- "Review branch `/main/scm-12345` and tell me what changed and what looks risky."
- "This test started failing last week. Find the changeset that broke it."
- "Which changesets on `/main` touched `Editor/Inspector/` in the last month?"
- "Give me a link to changeset 41827 so I can paste it in the ticket."

Skills that only read (`cm find`, `cm log`, `cm diff`, `cm status`) run freely. Anything that
mutates a repository — checkin, merge, undo, deleting a branch — is written to ask you first.
Reviews and analyses stay read-only end to end.

## Compatibility

This plugin targets **many agents, not one**. It follows
[Agent Plugins 1.0](https://agent-plugins.org/specification) for packaging and
[Agent Skills](https://agentskills.io/specification) for the skill format, and the content is
written tool-agnostically: no client-specific tool names, paths, or environment variables in the
portable core. Anything a single client needs goes in a reverse-domain namespaced directory and
is never required for the skills to work.

If a skill misbehaves in a specific agent, that is a bug worth reporting — portability is a
feature here.

## Contributing

Contributions are welcome, especially real-world `cm` recipes and workflows.
See [CONTRIBUTING.md](CONTRIBUTING.md) for how skills are structured and what "good" looks like,
and [CLAUDE.md](CLAUDE.md) for the conventions AI agents must follow when editing this repo —
worth reading even if you are human, since it is the authoritative style guide.

Ground rule: every `cm` command in a skill is verified against a real CLI, never remembered or
inferred.

- **Bugs and feature requests:** [GitHub issues](https://github.com/Unity-Technologies/unity-version-control-plugin/issues)
- **Security reports:** see [SECURITY.md](SECURITY.md)

## License

[Apache License 2.0](LICENSE). See [NOTICE](NOTICE).

Unity Version Control and Plastic SCM are trademarks of Unity Technologies.
