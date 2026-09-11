# Unity Version Control agent plugin

Teach your AI coding agent to work with **Unity Version Control** (UVCS, formerly Plastic SCM).

This is an [Agent Plugin](https://agent-plugins.org) — a portable bundle of
[Agent Skills](https://agentskills.io) that gives an agent working knowledge of the `cm`
command line and of the UVCS workflows built on top of it: exploring history, reviewing a
branch, tracing a regression back to the changeset that caused it, and producing `plastic://`
links so results are clickable in Unity DevOps and the UVCS GUI.

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
| `uvcs-cli-reference` | The `cm` CLI reference: concepts, object specs, `cm find` queries, output formats, gotchas. The hub every other skill builds on. | ✅ Available |
| `uvcs-review-branch` | Review the changes on a branch: scope, risk, per-changeset walkthrough. | Planned |
| `uvcs-root-cause` | Root cause analysis: trace a symptom to the changeset that introduced it. | Planned |
| `uvcs-links` | Build `plastic://` links so branches, changesets, and diffs are clickable. | Planned |

Skill names are `uvcs-`prefixed so they stay unambiguous when installed alongside other plugins.

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

The plugin is a plain directory, so installation is: get the files, then register them with your
agent.

```bash
git clone https://github.com/Unity-Technologies/unity-version-control-plugin.git
```

How you register a plugin differs per client, and the mechanism is deliberately outside the
Agent Plugins spec. Follow your client's plugin or skills documentation and point it at the
cloned directory:

- **Claude Code / Claude Desktop** — install as a plugin, or place the `skills/*` directories
  where Claude looks for skills.
- **Codex / Codex CLI**, **Cursor**, **VS Code**, and other clients — use their respective
  plugin/skills install path.

Verified per-client one-liners will be added here as we test each client. If you work one out,
please [contribute it](CONTRIBUTING.md).

## Usage

Once installed, you do not invoke skills directly — describe the task and the agent picks the
right one:

- "Review branch `/main/scm-12345` and tell me what changed and what looks risky."
- "This test started failing last week. Find the changeset that broke it."
- "Which changesets on `/main` touched `Editor/Inspector/` in the last month?"
- "Give me a plastic link to changeset 41827 so I can paste it in the ticket."

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
