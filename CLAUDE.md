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
.claude-plugin/plugin.json        # the same manifest again, where Claude Code looks for it
.claude-plugin/marketplace.json   # this repo is also its own one-plugin marketplace
skills/uvcs-<name>/SKILL.md       # one skill per immediate subdirectory; nothing deeper is scanned
skills/uvcs-<name>/references/    # detail loaded on demand
skills/uvcs-<name>/scripts/       # optional executables
skills/uvcs-<name>/assets/        # optional templates/data
mcp.json                          # only if we ever ship an MCP server; root only
com.unity/                        # our client-specific extras, reverse-domain namespaced
README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md LICENSE NOTICE
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
- **`.claude-plugin/` is the one exception to that rule**, because the location is dictated by
  the client and cannot be moved: Claude Code reads its manifest from `.claude-plugin/plugin.json`
  and ignores the root `plugin.json` entirely (`claude plugin validate .` reported
  `"manifest": null` against 2.1.266 before this directory existed — the skills still loaded, but
  with no name, version or description). So the plugin carries **two** manifests with the same
  content, and the split is useful rather than merely tolerated: the root one stays a clean Agent
  Plugins 1.0 manifest restricted to the permitted fields above, and anything Claude-only —
  `hooks` first — goes in `.claude-plugin/plugin.json`, where it is legal. Nothing else may follow
  it out of `com.unity/`; the test is whether the client *forces* the path.

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
   **CI is stricter than that target**: `validate-skill` runs with `fail-on-warning`, and its
   `body-progressive-disclosure` rule warns — so the job fails — at a body of **more than 200
   lines** in a skill with no `references/`, `scripts/` or `assets/` directory. For a workflow
   skill, which by our own convention has no `references/`, 200 body lines is therefore a hard
   ceiling. Cut prose to fit; do not add a directory just to clear the rule.
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

## Skill composition: the `uvcs-core` hub

`uvcs-core` is the hub, and it is the **parent** of the `cm` reference, not its sibling. Its body
holds only what every UVCS task needs — the domain model, object specs, object naming and
`plastic://` reporting conventions, read-only / mutating / irreversible labels, how to route a
question to the right command, and the catalogue of workflow skills. All `cm` syntax lives one
level down in `references/`, with `references/commands.md` as the curated everyday set.

This shape was chosen deliberately over a separate `uvcs-core` + `uvcs-cli-reference` pair: two
always-on descriptions covering the same vocabulary cannot be made mutually exclusive, a workflow
skill would face a four-level chain to reach a flag, and an agent that loaded the CLI half alone
would get every mutating command with none of the conventions.

- **Command syntax lives in exactly one place**: `uvcs-core`'s `references/`. Higher-level skills
  describe *workflow and judgement*, and point at the hub for syntax.
- Cross-skill *file* paths are fragile — clients differ in how skills are installed and whether
  one skill can invoke another. So: name the dependency explicitly in the body (e.g. "This
  workflow uses the `uvcs-core` skill for all `cm` invocations; load it first"), and let the agent
  resolve it. Name the hub *reference* the same way — "read **merge-conflict-markers**" — never a
  path into another skill's directory.
- **Inline the invocation, never the explanation.** A workflow skill prints the exact command it
  runs, on the line where it runs it — that keeps it executable in one step and usable when the
  hub is absent. It must never carry flag tables, output-token glossaries, exit-code contracts,
  availability caveats, or format specs; those are hub facts and that duplication rots. The test
  is not a command count: `cm merge <src> --merge --conflict-markers` on the step that applies
  the merge is right, and a paragraph explaining what `--conflict-markers` does is wrong.
- Replacing a command with a prose pointer ("see the hub for merge syntax") is **not** the fix for
  duplication and was rejected: it costs a lookup hop per step, and an agent that fails the lookup
  invents a flag — the exact failure this plugin exists to prevent. A stale pointer also reads
  fine while giving nothing, where a stale command is at least caught by an eval.
- If two skills keep needing the same block of text, that block belongs in the hub's
  `references/`, not in both.

Reference files are named by the question they answer, unprefixed: inside
`skills/uvcs-core/references/`, a `cm-` prefix or a `-reference` suffix carries no information.

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
real repositories and other people's work. Division of responsibility (settled): the `uvcs-core`
hub labels commands as plain facts — read-only / mutating / irreversible — and stays policy-free.
Its reporting conventions cover *notation and rendering* only (how to name `cs:42`, when to emit
a `plastic://` link, never inventing an id) for the same reason. The confirmation rules (when to
ask the user first, when to suggest
shelving before an undo, never presenting a destructive command as a casual next step, keeping
reviews and analyses read-only end to end) are workflow guidance and belong to the higher-level
skills that perform those operations — every workflow skill that mutates must carry them.

`uvcs-merge` is the worked example: the hub states what each merge mode does mechanically, and
`uvcs-merge` owns the decision (preview first; markers unless the user asked for their own merge
tool; a contributor when they named a side; ask before resolving what is genuinely ambiguous;
treat the check-in as the point of no return). Never gate that on detecting a headless session —
an agent cannot drive a merge tool window whatever the machine is, and there is no portable
signal to detect one.

`uvcs-switch` is the same division applied to `cm switch`: the hub states what the client setting
`PendingChangesOnSwitchAction` does to a dirty switch and what the automatic shelve comment looks
like, and `uvcs-switch` owns the decision the desktop GUIs and the Unity plugin put in a dialog —
present both options (leave the changes on a shelve, or bring them across) and let the user pick.
It is deliberately **not** part of `uvcs-merge`: only the "bring" half is a merge, it triggers on
different words, and a workflow that shelves and undoes the user's work needs its own stopping
points. Do not fold it in.

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

## Cutting a release

One button, no local steps: **Actions ▸ Release ▸ Run workflow**, pick the branch and the bump
level (patch / minor / major). `.github/workflows/release.yml` bumps `version` in **both**
manifests, commits and tags `v<version>` on that branch, packages the plugin with `git archive` (everything
except the paths marked `export-ignore` in `.gitattributes`), and opens a **draft** release with
notes generated from the merged PRs since the previous tag and the zip + `.sha256` attached.
Review the draft on the Releases page and click *Publish release*.

Consequences worth keeping in mind: the version lives in the two manifests and nowhere else —
never bump it by hand, or the next run fails on an existing tag. The marketplace entry
deliberately carries **no** `version`, so a release only has to move two files; `validate-skills`
fails the PR if the manifests disagree with each other or if a version creeps into the entry,
which is the most common reason a plugin-directory submission is rejected. The release notes are
only as good as the PR titles, so title PRs the way you would write a commit subject.

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
      second agent.

## Settled conventions

- Plugin `name`: `unity-version-control`. License: Apache-2.0.
- Skills are prefixed `uvcs-` so they stay unambiguous alongside other installed plugins.
  Set: `uvcs-core` (hub, shipped), `uvcs-merge` (shipped), `uvcs-switch` (shipped),
  `uvcs-root-cause` (shipped), `uvcs-code-review` (shipped), `uvcs-address-review` (shipped),
  `uvcs-links` (see Open decisions). Review has **two** skills on purpose, split by *side* and not by object:
  `uvcs-code-review` produces findings and publishes them, `uvcs-address-review` consumes an
  existing thread as the author. Their triggers do not overlap ("review this branch" vs "fix the
  review"), and the shared vocabulary lives in the hub's `reviews-and-merge-requests.md`, so this
  is not the split that was rejected below. `uvcs-merge-request` and
  `uvcs-review-branch` were planned separately and collapsed into `uvcs-code-review`: reviewing a
  branch *is* reviewing its merge request, so splitting them would have produced two skills
  fighting over the same triggers and the same `cm mr` workflow — do not resurrect the split. The
  hub was named
  `uvcs-cli-reference` until it grew into a real hub; the name now describes the body and the
  `cm` reference sits in its `references/`.
- Every shipped workflow skill gets a one-line row in the hub's **UVCS workflow skills** table.
  Adding a skill without that row is an incomplete change.
- Our reverse-domain namespace for non-portable extras is `com.unity`.
- **No `CHANGELOG.md`.** Release notes are generated from the merged PRs when a release is cut,
  so there is no hand-maintained changelog to update. Do not re-add one.

## Open decisions

Do not silently invent answers to these — ask, then record the answer here.

- Whether we ever ship an MCP server alongside the skills, or stay skills-only.
- Verified per-client install instructions for `README.md` (currently generic — fill in as each
  client is tested).
- Whether `uvcs-links` still needs to exist as a skill. Building `plastic://` links is now hub
  material — the reporting conventions in `uvcs-core` plus `references/plastic-links.md` — so a
  dedicated skill would either duplicate that or be a thin wrapper. Left in the planned set until
  decided; do not ship it without answering this.
