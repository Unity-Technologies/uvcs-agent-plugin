# CLAUDE.md — UVCS agent plugin

Guidance for any AI agent creating or maintaining content in this repository.

## What this repo is

An **agent plugin** that teaches AI agents to work with **UVCS** (Unity Version Control,
formerly Plastic SCM). It ships *knowledge*, not product code: skills, references, and small
helper scripts.

Planned shape:

- **One hub skill: the `cm` CLI reference.** `cm` is the UVCS command line. This skill is the
  single source of truth for command syntax, flags, and output formats.
- **Higher-level task skills** that build on the hub: review a branch, root cause analysis,
  build Plastic links (`plastic://`) for richer output, and similar workflows.

Whoever ships a skill owns the whole vertical: it must trigger reliably, be correct against a
real `cm`, and stay portable across agents.

## Non-negotiables

1. **Multi-agent portability.** This plugin must work in Claude Code, Claude Desktop, Codex /
   Codex CLI, Cursor, and other clients. Never write for one client only.
2. **Spec compliance.** Follow [Agent Plugins 1.0](https://agent-plugins.org/specification) for
   packaging and [Agent Skills](https://agentskills.io/specification) for `SKILL.md`. Be
   pragmatic about *style* advice in those docs; be strict about *format*.
3. **Token economy.** Every token in a skill is paid for on every activation. If a capable model
   already handles it, do not write it down.
4. **Verified, not invented.** Every `cm` command, flag, and output shape must be checked against
   a real `cm` before it lands.
5. **Public repository.** Everything here is public and Apache-2.0 licensed. No credentials,
   internal hostnames or links, org/user names, or customer data — anywhere, including examples
   and commit messages. Use placeholders (`<server>`, `<repo>`, `<branch>`, `<user>`).

## Layout (fixed by the spec — do not relocate)

```
plugin.json                       # $schema + name required; other metadata optional
skills/uvcs-<name>/SKILL.md       # one skill per immediate subdirectory; nothing deeper is scanned
skills/uvcs-<name>/references/    # detail loaded on demand
skills/uvcs-<name>/scripts/       # optional executables
skills/uvcs-<name>/assets/        # optional templates/data
mcp.json                          # only if we ever ship an MCP server; root only
com.unity/                        # our client-specific extras, reverse-domain namespaced
README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md CHANGELOG.md LICENSE NOTICE
.github/                          # issue and PR templates
```

Rules that bite:

- `plugin.json` `$schema` must be pinned to `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.
  If `mcp.json` is ever added, pin it to the same 1.0.0 version — a mismatch invalidates MCP config.
- Only these top-level `plugin.json` fields are permitted: `$schema`, `name`, `version`,
  `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`.
- Skill `name` in frontmatter **must equal its directory name**: 1–64 chars, lowercase
  `a-z0-9-`, no leading/trailing hyphen, no `--`.
- Client-specific behaviour (hooks, slash commands, subagents, custom agent definitions) is
  **not** portable and never belongs in the portable core. Put it under a reverse-domain
  directory, and make sure the skill still works fully without it.

## Writing skills

### Frontmatter

```yaml
---
name: <matches-directory>
description: <what it does>. Use when <concrete triggers, incl. words users actually type>.
---
```

`description` (max 1024 chars) is the *only* part loaded at startup, in every session, for every
user. It is a routing decision, not marketing. Include the vocabulary people really use —
`UVCS`, `Plastic SCM`, `cm`, `changeset`, `cset`, `workspace`, `branch`, `merge`, `label`,
`shelve`, `plastic://`. Keep descriptions **mutually exclusive** across skills; overlapping
descriptions make the wrong skill fire.

Optional fields, used sparingly: `license`, `compatibility` (only for real environment
requirements, e.g. `Requires the cm CLI on PATH`), `metadata` (author/version). `allowed-tools`
is experimental and client-dependent — a skill must never *depend* on it.

### What not to write

Do not spend tokens on things a modern LLM already does well:

- General reasoning, summarizing, diff reading, code review taste, writing style.
- Generic version-control theory (what a branch/merge/diff is).
- Basics that are identical to git and behave as expected in UVCS.
- Restating the `description` in the body, "Overview"/"Introduction"/"Conclusion" sections,
  motivational prose, apologies about limitations, or long rationales.
- Full `cm help` dumps. Curate what agents actually need.

Do write down what a model cannot guess:

- UVCS-specific concepts and terminology, and where they differ from git
  (changesets vs commits, branch naming with `/main/scm123`, selectors, workspaces, `--format`).
- Exact flags and machine-readable output formats, especially `cm find` queries.
- Gotchas, quoting/escaping traps, platform differences, and error messages with their fix.
- The ordering and preconditions of multi-step operations.

### Structure and size

Use progressive disclosure — three levels, no more:

1. `description` (~100 tokens) — routing.
2. `SKILL.md` body — the smallest complete set of instructions. Target **under 500 lines /
   ~5k tokens**; shorter is better. Cutting a line is a real improvement.
3. `references/*.md`, `scripts/`, `assets/` — loaded only when the task needs them.

Keep references one level deep from `SKILL.md`; no nested reference chains. Name reference files
by the question they answer (`find-queries.md`, `merge.md`, `output-formats.md`) and say in
`SKILL.md` *when* to read each one, in one line.

Prefer tables, terse command recipes, and a worked example over paragraphs. Deterministic,
repeatable logic belongs in `scripts/`, not in prose the model has to re-derive.

### Tool-agnostic phrasing

Skills are read by agents with different toolsets. Describe the *action*, not one client's tool:

- ✅ "Read `references/find-queries.md`" / "Run: `cm find ...`"
- ❌ "Use the Read tool" / "Call Bash" / "Launch a subagent" / "Use the Task tool"
- ❌ Hardcoded `.claude/` paths, `${CLAUDE_*}` variables, client-only file conventions.

Do not assume a workspace path, a current directory, a configured server, or that `cm` is even
installed. Detect it (e.g. via a `cm` status/version check), and state what to do when it is
missing. When referring to plugin-relative paths in the spec's configuration fields, they must
start with `./` and stay inside the plugin root.

## Skill composition: the `cm` hub

- **Command syntax lives in exactly one place**: the `uvcs-cli-reference` skill. Higher-level
  skills describe *workflow and judgement*, and point at the hub for syntax.
- Cross-skill *file* paths are fragile — clients differ in how skills are installed and whether
  one skill can invoke another. So: name the dependency explicitly in the body (e.g. "This
  workflow uses the `uvcs-cli-reference` skill for all `cm` invocations; load it first"), and let the agent
  resolve it.
- Pragmatic exception: a higher-level skill may inline the **one or two exact invocations** it
  needs to stay usable standalone. It must never copy tables, flag lists, or reference material —
  that duplication rots.
- If two skills keep needing the same block of text, that block belongs in the hub's
  `references/`, not in both.

## Verifying `cm` content

Before claiming a command works:

- Run it, or at minimum `cm help <command>` / `cm help commands`, against a real `cm`.
- Paste real output shapes (trimmed and anonymized), not remembered ones.
- Note the `cm` version you verified against (`cm version`) when behaviour is version-sensitive.
- Prefer stable, parseable output for agent consumption (`--format`, `--machinereadable`,
  `--xml` where available) over human-formatted output that changes between releases.

**Mark every command read-only or mutating.** Read-only (`cm find`, `cm log`, `cm diff`,
`cm status`, `cm cat`) can be run freely. Mutating operations (`cm checkin`, `cm merge`,
`cm undo`, `cm rm`, `cm branch -d`, `cm switch`, `cm shelve`, anything touching a server) affect
real repositories and other people's work. Division of responsibility (settled): the
`uvcs-cli-reference` hub labels commands as plain facts — read-only / mutating / irreversible —
and stays policy-free. The confirmation rules (when to ask the user first, when to suggest
shelving before an undo, never presenting a destructive command as a casual next step, keeping
reviews and analyses read-only end to end) are workflow guidance and belong to the higher-level
skills that perform those operations — every workflow skill that mutates must carry them.

`uvcs-merge` is the worked example: the hub states what each merge mode does mechanically, and
`uvcs-merge` owns the decision (preview first; markers unless the user asked for their own merge
tool; a contributor when they named a side; ask before resolving what is genuinely ambiguous;
treat the check-in as the point of no return). Never gate that on detecting a headless session —
an agent cannot drive a merge tool window whatever the machine is, and there is no portable
signal to detect one.

## Workflow for changes here

1. **Use a skill-creator skill** to scaffold or refactor a skill rather than hand-rolling
   structure — in Claude Code, `example-skills:skill-creator`. It gets frontmatter, layout, and
   description shape right, and can evaluate triggering.
2. Validate the format: `skills-ref validate ./skills/uvcs-<name>`
   (see https://github.com/agentskills/agentskills/tree/main/skills-ref), plus the `plugin.json`
   / `mcp.json` schemas. CI re-checks both on every PR
   (`.github/workflows/validate-skills.yml`, via `Flash-Brew-Digital/validate-skill`).
   Behavioral regressions are guarded by the promptfoo eval suite in `evals/`
   (`.github/workflows/skill-evals.yml`, Anthropic auth via Workload Identity Federation —
   see `evals/README.md`). If a change alters what a skill teaches, update or add an eval.
3. Test triggering with realistic user phrasings, including ones that should *not* fire it.
4. If the PR **adds or renames a skill, or changes a `description`** (the triggering surface),
   smoke-test it in a second agent: symlink the skill directory into that client's skills dir
   (e.g. `~/.codex/skills/`, `~/.cursor/skills/`) and run 2–3 realistic prompts. Content-only
   changes skip this — a reference edit cannot change how another client discovers the skill,
   and CI already covers format (validate-skill) and behavior (evals).
5. Then re-read the skill and delete everything that did not earn its tokens.

Failures should degrade gracefully: per the spec, one broken skill must not take down the others,
so keep skills independent and self-contained.

## Commit history

The log is the story of how this plugin was built. `git log --oneline --stat` should show where
the direction changed, what was hard, and what got reverted — none of which is visible in the
finished skills.

- **One coherent change per commit**, at a natural stopping point. Not one commit per file, not
  one commit per week. If a message needs "and", consider two commits.
- **Subject: one line, specific, in the imperative.** "Rescope cross-agent testing to
  triggering-surface changes only", never "update docs" or "minor edits". Say what actually
  changed, not which files moved.
- **Body: why it mattered.** The constraint behind the change, what you rejected and why, what a
  review or an eval caught. Skip the body only when the subject truly says everything.
- **Be honest.** Reversals, dead ends, and corrections from review are the most useful entries in
  the log. A commit that undoes an earlier decision should say that it does, and why.
- **Write it while the work is fresh**, after reviewing the diff (`git diff --word-diff`) — the
  message is the record of what happened, so it is worth the minute it costs.
- **Tag milestones** (`git tag -a v0.1.0 -m "..."`): the message records the day's work, the tag
  records the landmark.

## Review checklist

- [ ] `name` matches the directory; frontmatter valid per Agent Skills 1.0.
- [ ] `description` states what + when, uses real user vocabulary, no overlap with sibling skills.
- [ ] `SKILL.md` well under 500 lines; detail pushed to `references/`.
- [ ] Nothing a vanilla LLM already knows; no filler sections; no duplicated `cm` syntax.
- [ ] No client-specific tools, paths, or assumptions in the portable core.
- [ ] Every `cm` command verified against a real CLI; read-only vs mutating labelled.
- [ ] No secrets, internal URLs, real user/customer/org data.
- [ ] If a skill was added/renamed or a `description` changed: triggering smoke-tested in a
      second agent, and `CHANGELOG.md` updated.

## Settled conventions

- Plugin `name`: `unity-version-control`. License: Apache-2.0.
- Skills are prefixed `uvcs-` so they stay unambiguous alongside other installed plugins.
  Set: `uvcs-cli-reference` (hub, shipped), `uvcs-merge` (shipped), `uvcs-review-branch`,
  `uvcs-root-cause`, `uvcs-links`.
- Our reverse-domain namespace for non-portable extras is `com.unity`.

## Open decisions

Do not silently invent answers to these — ask, then record the answer here.

- Whether we ever ship an MCP server alongside the skills, or stay skills-only.
- Verified per-client install instructions for `README.md` (currently generic — fill in as each
  client is tested).
