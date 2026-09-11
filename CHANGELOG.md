# Changelog

All notable changes to this plugin are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because this plugin ships instructions rather than code, treat these as breaking changes:
renaming or removing a skill, and changing a skill's `description` in a way that alters when it
triggers.

## [Unreleased]

### Added

- **`uvcs-core`** — the hub skill. Its body holds what every UVCS task needs: UVCS concepts vs
  git, object specs, how to route a question to the right command, read-only / mutating /
  irreversible labels, the conventions for reporting UVCS objects (name them as `cs:42` /
  `br:/main/task001` so they round-trip, emit a `plastic://` link when the repo and server are
  known, never fill in an id the output did not show), and a catalogue of the workflow skills.
  All `cm` syntax sits one level down in `references/`: the everyday set in
  **`references/commands.md`**, plus the `cm find` query language, status/checkin/undo semantics,
  diff/patch (incl. `--integration`), branches/shelves/labels/merge, history/annotate, shell
  quoting gotchas, and `plastic://` deep links. Every command verified against `cm` 11.0.16.

  Named `uvcs-cm`, then `uvcs-cli-reference`, during development; both names promised a command
  reference while the content was a hub. A separate hub + CLI-reference *pair* was considered and
  rejected — two always-on descriptions over the same vocabulary cannot be made mutually
  exclusive, workflow skills would face a four-level chain to reach a flag, and an agent that
  loaded the CLI half alone would get every mutating command with none of the conventions.
- **`references/merge-conflict-markers.md`** in the hub skill: the headless merge mode
  (`cm merge --conflict-markers`, `--list-conflict-markers`, `--mark-resolved`) — exit-code
  contract, `CONFLICT_MARKERS` / `UNRESOLVED` output lines, diff3 marker format, what never
  gets markers, and the check-in guard. Verified against the implementation and its
  `cm help merge`; the flags are **not** in `cm` 11.0.16 or any released client yet, and the
  reference says so and tells agents to probe first.
- **`uvcs-merge`** — workflow skill for merging with `cm`, driving a merge from preview to
  check-in without a merge tool window ever opening: establish the destination, preview
  read-only, pick the mode (conflict markers, a whole contributor, or handing the command to
  the user when they want their own tool), resolve with judgement, verify, and treat the
  check-in as the point of no return. Depends on `uvcs-core` for all `cm` syntax: it prints the
  exact invocation on the step that runs it and names the hub reference for every flag table,
  output token, exit-code contract, and availability caveat — the rule `CLAUDE.md` records as
  *inline the invocation, never the explanation*.
  Also adds the preview output tokens (`STATUS NO_MERGES_DETECTED`, `FILE_CONFLICT`, the
  directory-conflict codes) to the hub's `references/branches-and-merge.md`, with the caveat
  that `FILE_CONFLICT` means "both sides changed it", not "this will conflict".
- CI quality gates: skill format validation on every PR
  (`Flash-Brew-Digital/validate-skill` + `plugin.json` schema check) and a promptfoo eval
  suite (`evals/`) that runs when skill content changes, authenticated to the Claude API via
  Workload Identity Federation (no stored API key). `tests/reporting.yaml` covers the hub's
  reporting conventions and that a merge request defers to `uvcs-merge`.
- Repository foundations: Agent Plugins 1.0 manifest, Apache-2.0 license, contribution and
  security policies, and the authoring conventions in `CLAUDE.md`.
