# Changelog

All notable changes to this plugin are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because this plugin ships instructions rather than code, treat these as breaking changes:
renaming or removing a skill, and changing a skill's `description` in a way that alters when it
triggers.

## [Unreleased]

### Added

- **`uvcs-cli-reference`** — the hub skill: UVCS concepts vs git, object specs, `cm find`
  query language, status/checkin/undo semantics, diff/patch (incl. `--integration`),
  branches/shelves/labels/merge, history/annotate, shell quoting gotchas, and `plastic://`
  deep links. Every command verified against `cm` 11.0.16. This is the skill previously
  planned as `uvcs-cm`; the name changed before it ever shipped.
- **`references/merge-conflict-markers.md`** in the hub skill: the headless merge mode
  (`cm merge --conflict-markers`, `--list-conflict-markers`, `--mark-resolved`) — exit-code
  contract, `CONFLICT_MARKERS` / `UNRESOLVED` output lines, diff3 marker format, what never
  gets markers, and the check-in guard. Verified against the implementation and its
  `cm help merge`; the flags are **not** in `cm` 11.0.16 or any released client yet, and the
  reference says so and tells agents to probe first.
- CI quality gates: skill format validation on every PR
  (`Flash-Brew-Digital/validate-skill` + `plugin.json` schema check) and a promptfoo eval
  suite (`evals/`) that runs when skill content changes, authenticated to the Claude API via
  Workload Identity Federation (no stored API key).
- Repository foundations: Agent Plugins 1.0 manifest, Apache-2.0 license, contribution and
  security policies, and the authoring conventions in `CLAUDE.md`.
