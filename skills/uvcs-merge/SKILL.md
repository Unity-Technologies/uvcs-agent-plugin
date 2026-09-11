---
name: uvcs-merge
description: >-
  Merge a UVCS / Plastic SCM branch, changeset, label, or shelve into the current workspace with
  the cm CLI and drive it to a clean, resolved workspace without ever opening a merge tool
  window: preview first, apply with diff3 conflict markers, resolve or pick a contributor,
  verify, then hand the check-in decision back to the user. Use whenever the user wants to merge
  or integrate one UVCS branch into another, merge down
  from /main into a task branch, cherry-pick a changeset, resolve UVCS merge conflicts, finish a
  merge that is already in progress, or when cm refuses an operation because a merge is in
  progress or conflict markers are still pending. All cm syntax comes from the uvcs-cli-reference
  skill — load it first.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# Merging with `cm`

This workflow uses the **`uvcs-cli-reference`** skill for every `cm` invocation, object spec, and
output format — load it first. Its **merge-conflict-markers** reference holds the marker format,
exit codes, and the check-in guard; its **branches-and-merge** reference holds the preview output
tokens. Read them rather than guessing flags.

A merge you cannot finish is worse than one you never started: it blocks the next merge and the
next check-in for whoever owns the workspace. So the shape of this workflow is *learn what the
merge does before applying it, apply it in a mode that can never block, and leave the workspace
either finished or obviously unfinished* — never silently half-merged.

## 1. Establish where you are

Merge direction in UVCS is "stand on the destination, pull from the source" — the workspace *is*
the destination. Getting this backwards merges the wrong way round, so confirm before acting:

```
cm status --header          # current branch@repo@server and head changeset
cm status                   # pending changes
```

Everything in this step and the next is read-only, so gather it in one go rather than a
round-trip per command — you need the whole picture before deciding anything anyway.

- If the workspace is not on the destination branch the user means, say so and switch only after
  they confirm — `cm switch` replaces their working tree.
- Pending changes survive a merge but make the result hard to review, and an `undo` after a bad
  merge would take the user's own edits with it. If `cm status` is not clean, offer to shelve
  first (`cm shelveset create --all -c "..."`, which is recoverable) rather than merging on top.
- If `cm status` reports a merge already in progress or files with pending conflict markers,
  finish that merge first (jump to step 4) — a new merge is refused while either is pending.

## 2. Preview — always, and it is free

```
cm merge <source_spec>                     # read-only; no --merge, nothing is touched
cm merge <source_spec> --machinereadable   # same, one stable prefix per line
```

Read the result as: `STATUS NO_MERGES_DETECTED` → nothing to do, say so and stop.
`FILE_CONFLICT <path> ...` → both sides changed that file. Everything else (`ADD`, `RM`, `MV`,
`CHG`) the merge applies by itself.

`FILE_CONFLICT` is not a prediction of conflict: most such files merge cleanly. Do not report
"there are N conflicts" from the preview — report that N files need a content merge, if you
mention it at all. What actually collides is only knowable by running the merge.

## 3. Choose the mode

| The user has said | Do this |
|---|---|
| nothing about conflicts | `--conflict-markers` (below). It behaves exactly like a normal merge when nothing collides, so it costs nothing to use by default. |
| "resolve the conflicts", "handle it", "just merge it" | `--conflict-markers`, then resolve. |
| they want to resolve in their own merge tool / GUI | The merge is theirs to run: give them the exact command, then stop and wait. Say why you are not running it — the call blocks until the window closes, and killing it on a timeout leaves the merge half-applied. Do not quietly substitute markers: a marked-up file is not the three-pane merge they asked for. Offering markers as an alternative is fine; deciding for them is not. |
| which side wins ("take theirs", "keep ours", "prefer main") | `--keepsource` / `--keepdestination` — no markers, no resolution work. Confirm which contributor they mean: **source** is the branch being merged in, **destination** is the workspace. |

`.unity`, `.prefab` and other Unity YAML assets are a deliberate exception. They are text, so
marker mode will happily mark them — but it bypasses UnityYAMLMerge, and a scene file full of
markers is worse than useless. Which side wins is a content decision you cannot make from the
file, so ask, then take that whole side: `--keepsource` / `--keepdestination` when it applies to
the merge as a whole, otherwise restore that one file from the chosen changeset with `cm cat`
(the marker header names both changesets) — once the markers are gone the entry clears itself.

Old clients have no `--conflict-markers` (check `cm merge --help`). There, the only headless
options are `--keepsource` / `--keepdestination`; if neither fits, hand the merge back to the
user rather than launching a tool that will hang.

## 4. Apply it

```
cm merge <source_spec> --merge --conflict-markers
```

This is mutating, but it is confined to the workspace: the merge lands as *pending changes*, and
nothing reaches the server until check-in, so `cm undo` still backs the whole thing out. Exit `1`
means "files need attention", not failure — do not retry the command.

Then work the output:

- `CONFLICT_MARKERS <path>` — the file has diff3 markers. Fix the file on disk.
- `UNRESOLVED <path> (binary|symlink|recursive)` — markers were impossible. Pick a contributor
  for that path with `--keepsource` / `--keepdestination`. For a binary asset, which side wins is
  a call you usually cannot make from the file alone — ask, naming both changesets.

## 5. Resolve

Resolving means producing the code that should exist, which is frequently neither side verbatim:
two people adding to the same list usually want both additions; two people rewriting the same
function usually want one design, not a stitched-together hybrid. Read all three sections —
`destination` (the workspace), `base` (the common ancestor, context only), `source` (incoming) —
and delete every marker line when done.

Judgement, not mechanics, is what makes this safe:

- Adjacent or mechanical collisions (imports, registrations, version bumps, changelog entries)
  are yours to resolve — do it and say what you did.
- A genuine logic collision in code you do not own is not. Resolve what is unambiguous, then
  show the user the remaining regions and ask. Promising a clean merge you cannot judge is how
  wrong code reaches `/main`.
- Never resolve by deleting the other side's work to make the file compile.

If the correct content legitimately contains marker text (a test fixture, a parser constant),
clear its entry without touching the file: `cm merge --mark-resolved <path>`.

## 6. Verify, then stop

```
cm merge --list-conflict-markers       # read-only; exit 0 = nothing left
```

Build or run the tests if the repository has an obvious way to — a merge that compiles on both
sides separately can still fail merged, and you are the last person who can catch it cheaply.

**Stop there.** The merge result is pending changes in the user's workspace; checking it in
creates a changeset on the server that other people build on, and no `cm` command deletes it.
That is the user's call, and "merge this branch" does not ask for it. Report what is pending and
offer:

> The merge is applied and nothing is left to resolve. To finish it, the changes need to be
> checked in — `cm checkin --all -c "merged /main/task001"`. Want me to run that?

Run it only once they say yes. `cm checkin` also refuses while any marked file still contains
markers and names them — that guard is the safety net, not the plan.

**Merges from a shelve never end in a check-in.** `cm merge sh:<id>` and `cm shelveset apply`
exist to put work-in-progress back into a workspace: pending changes *are* the finished state,
and the user carries on editing. Do not check in, and do not offer to.

## If you have to abandon

Say so explicitly and leave the workspace in a state the user can see. `cm undo <paths>` /
`cm undo .` discards the merge along with anything else pending, irreversibly — so offer a shelve
first, and never present the undo as a casual next step. Leaving markers in place is also a
legitimate outcome: the check-in guard means nothing bad can land by accident.

## Stay in UVCS

There is no rebase, no staging area, and no local commit. Never reach for `git` in a UVCS
workspace, and never fabricate a `cm` flag — check `cm help merge` or the hub reference instead.
