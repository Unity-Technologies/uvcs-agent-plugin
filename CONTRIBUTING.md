# Contributing

Thanks for helping teach agents to use UVCS well. The most valuable contributions are small and
concrete: a `cm` recipe that actually works, a gotcha that cost you an hour, a workflow written
down so an agent stops guessing.

[CLAUDE.md](CLAUDE.md) is the authoritative style guide for skill content. It is written for AI
agents, but the rules apply to everyone — read it before writing a skill. This document covers
the mechanics.

## All contributions are subject to the [Unity Contribution Agreement (UCA)](https://unity.com/legal/licenses/unity-contribution-agreement)

By making a pull request, you are confirming agreement to the terms and conditions of the UCA, including that your
Contributions are your original creation and that you have complete right and authority to make your Contributions.

When you open your first pull request, a bot (CLA Assistant) asks you to accept the UCA, as an individual or on
behalf of your company. A pull request is merged only once it's accepted.

## Ground rules

1. **Verified, not remembered.** Every `cm` command, flag, and output shape must be run against
   a real `cm` before it lands. Note the version (`cm version`) when behaviour is version
   sensitive. No invented flags.
2. **Portable across agents.** Claude Code, Claude Desktop, Codex, Cursor, and others. No
   client-specific tool names, paths, or environment variables in `skills/`.
3. **Short.** Skill text is paid for on every activation. If a capable model already handles it,
   leave it out. Deleting a paragraph is a real improvement.
4. **Public by default.** No credentials, internal hostnames, customer data, or real user names
   anywhere in the repo. Use placeholders: `<server>`, `<repo>`, `<branch>`, `<user>`.
5. **Read-only unless asked.** Label every command read-only or mutating. Mutating operations
   (`checkin`, `merge`, `undo`, `rm`, `branch -d`, `switch`, `shelve`) must instruct the agent to
   confirm with the user first.

## Repository layout

Fixed by [Agent Plugins 1.0](https://agent-plugins.org/specification) — do not relocate:

```
plugin.json                          Manifest ($schema pinned to 1.0.0)
skills/uvcs-<name>/SKILL.md          Required: frontmatter + instructions
skills/uvcs-<name>/references/*.md   Detail, loaded on demand
skills/uvcs-<name>/scripts/          Optional executables
skills/uvcs-<name>/assets/           Optional templates and data
com.unity/                           Unity/client-specific extras (never required)
```

Only immediate subdirectories of `skills/` are scanned, and each must contain a `SKILL.md`.
Nothing deeper is discovered.

## Adding a skill

1. **Check it belongs.** UVCS command syntax lives in exactly one place: the `uvcs-core` hub
   skill. A new skill should add *workflow and judgement*, and defer to the hub for syntax. If
   you are copying a table of flags, stop — extend the hub instead.
2. **Scaffold it.** Use a skill-creator skill if you have one (in Claude Code:
   `example-skills:skill-creator`). It gets frontmatter, layout, and description shape right.
3. **Name it** `uvcs-<something>`, lowercase, hyphens only. The `name` in frontmatter **must**
   equal the directory name.
4. **Write the frontmatter:**

   ```yaml
   ---
   name: uvcs-review-branch
   description: <what it does>. Use when <concrete triggers, in the words users actually type>.
   ---
   ```

   `description` is the only part loaded at startup, in every session. It is a routing decision.
   Include real vocabulary (`UVCS`, `Plastic`, `cm`, `changeset`, `cset`, `branch`, `workspace`,
   `merge`, `label`, `shelve`) and keep it **mutually exclusive** with existing skills —
   overlapping descriptions make the wrong skill fire.
5. **Keep `SKILL.md` under 500 lines** (~5k tokens; shorter is better). Push detail into
   `references/`, named for the question it answers (`find-queries.md`, `merge.md`), and say in
   one line *when* to read each.
6. **Validate the format:**

   ```bash
   skills-ref validate ./skills/uvcs-<name>
   ```

   See [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref).
7. **Run the behavioral evals:**

   ```bash
   cd evals && npm ci && npm run eval
   ```

   No API key needed — it uses your Claude Code login. About 90 seconds for the full suite;
   `--filter-pattern <regex>` narrows it while you iterate. If your change alters what a skill
   teaches, update or add a test. See [evals/README.md](evals/README.md).
8. **Test triggering** with realistic phrasings, including ones that should *not* fire it.
9. **If you added/renamed a skill or changed a `description`, smoke-test triggering in a
   second agent** (symlink the skill into e.g. `~/.codex/skills/` or `~/.cursor/skills/` and
   run a few realistic prompts). Content-only changes don't need this — CI already validates
   format and behavior on every PR.
10. **Re-read and cut** everything that did not earn its tokens.

## Pull requests

- One skill or one coherent change per PR.
- In the description, say **which agents you tested in** and **which `cm` version** you verified
  against.
- Paste a short transcript showing the skill doing the thing. That is the real review artifact.
- Run through the review checklist at the bottom of [CLAUDE.md](CLAUDE.md).

### Why `Skill evals` shows as skipped on your PR

It is not broken and you do not need an Anthropic key. GitHub does not give Actions secrets to a
workflow run from a fork (or from Dependabot), so the eval job skips rather than fail on a
credential it was never handed. The suite runs on your change when a maintainer adds the PR to
the **merge queue**: GitHub rebuilds it on a branch in this repository, the workflow runs there
with the project's own credentials, and a failing eval takes the PR back out of the queue instead
of merging it. Expect review first, then that run.

Two ways to see the result earlier, both optional:

- Run the suite locally — no key needed if you are logged into Claude Code (step 7 above).
- Run it in your fork: add an `ANTHROPIC_API_KEY` secret to **your** fork and start
  *Actions ▸ Skill evals ▸ Run workflow* there. It costs your own credit, so only bother if the
  local run is not an option.

## Reporting problems

- **Bugs, wrong commands, bad triggering:** open an issue. Include the agent and client version,
  the `cm` version, what you asked, and what the agent did. The quickest way is to ask the agent
  itself — *"report this as a plugin bug"* — the `uvcs-report-issue` skill collects exactly that,
  writes the reproduction in the shape of an eval, redacts names, and files it once you have read
  the text.
- **A skill that works in one agent but not another:** please report it. Portability is a
  feature, so this is a real bug.
- **Security issues:** do not open a public issue. See [SECURITY.md](SECURITY.md).
