---
name: uvcs-switch
description: >-
  Move a UVCS / Plastic SCM workspace onto another branch, changeset, label or shelve with
  cm switch — including creating the branch first — and handle pending changes the way the UVCS
  GUIs and the Unity plugin do: detect them, ask whether to leave them behind on a shelve or
  bring them along, then shelve, undo, switch, and reapply. Use whenever the user wants to
  switch, change or move the workspace to another UVCS branch, start a new task branch and work
  on it, or when cm switch is refused, cancelled or hangs because the workspace has pending
  changes. All cm syntax comes from the uvcs-core skill — load it first.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# Switching the workspace with `cm`

This skill owns the *decision*. Every `cm` flag and output shape it names belongs to the
**`uvcs-core`** skill — load it first, and read **branches-and-merge** for switch and shelve
semantics rather than guessing.

`cm switch` rewrites the user's working tree. On a clean workspace that is all it is. On a dirty
one their uncommitted work has to go somewhere, and where it goes is **their call, not yours** —
the desktop GUIs and the Unity plugin stop and ask, and so does this workflow.

## 1. Look before you switch

```
cm status --header          # branch@repo@server, or the changeset/label/shelve it is pinned to
cm status                   # pending changes
```

Both are read-only, so run them together. Then:

- **Already on the target** — say so and stop. There is nothing to do.
- **Target does not exist yet** — if the user asked for a new branch, create it first:
  `cm branch create /main/task001 -c "<what it is for>"`. Creating from somewhere other than the
  current head (`--changeset=<id>`) is a decision; ask if it is not obvious.
- **Workspace clean** — switch and report where they landed:
  `cm switch br:/main/task001`, then `cm status --header`.
- **Workspace dirty** — go to step 2. Do **not** run `cm switch` yet.

Never fire a bare `cm switch` on an unchecked workspace. What it does with pending changes is a
client setting, and one of its outcomes is a prompt on stdin that silently answers itself with
*Cancel* and still exits 0 — the switch never happens and nothing says so (see
**branches-and-merge**).

## 2. Pending changes — ask, do not choose

Put the same two options to the user that the GUI does, naming both branches, and wait:

> You have pending changes in your workspace. How would you like to handle them?
>
> - **Leave changes on `/main/task001`** — they are saved on a shelve. You can apply or discard
>   them later.
> - **Bring changes to `/main/task002`** — they are applied on the destination after the switch.
>   Conflicts are possible, and I will tell you about any I cannot resolve.
> - **Cancel** — the workspace is left as it is.

Report what is pending (how many files, and the notable ones) so the choice is informed, and say
which branch each option names. Cancel is a real answer: if they do not reply, nothing happens.

Two cases decide themselves, and you should say which one applies rather than offering a choice
that does not exist:

- **Bring is unavailable** when the target is a label or a shelve, when it lives in another
  repository or on another server, or when the workspace is currently pinned to a label. Offer
  leave-or-cancel.
- **Only private (uncontrolled) files are pending.** Shelving cannot include them and `cm undo`
  does not remove them: they stay on disk and follow the workspace across. Say that, and switch.

## 3. Shelve, undo, switch — both options start here

```
cm find branch "where name='task001'" --format="{id}" --nototal
cm shelveset create --all -c "Automatic shelve created during switch operation (from br:21)"
cm undo . -r
cm switch br:/main/task002
cm status --header
```

That comment is the exact marker the GUIs write and look for, so a shelve made this way shows up
as theirs — `br:21` is the **internal id** of the branch being left, which is what the first
command fetches (`cs:<n>` / `lb:<id>` if the workspace was pinned to a changeset or a label).

Order matters and the middle step is the dangerous one:

- **Shelve first, and check it was created.** `cm undo` is irreversible and a shelve is the only
  thing standing between the user's work and nothing. If the shelve command fails or prints no
  shelve id, stop there — do not undo, do not switch.
- `--all` is not optional: without it, edited-but-not-checked-out files are silently left out and
  the undo then destroys them.
- Confirm the undo scope with the user when the workspace holds anything they did not mention.
  It clears the whole workspace, not just the files in play.

**Leaving the changes behind ends here.** Report the shelve as `sh:<id>` with its comment, plus a
deep link (**deep-links**), and say in one line how to get the work back:
`cm shelveset apply sh:<id>`. Bringing them along continues to step 4.

An earlier automatic shelve off the same branch is worth checking for first, since that is what
the GUI overwrites when the user leaves changes behind a second time:

```
cm find shelve "where owner='me' and comment='Automatic shelve created during switch operation (from br:21)'" \
    --format="{shelveid} {date}" --nototal
```

It warns before overwriting; do the same, except that you never delete without an answer. Name
the existing shelve and its date and ask whether to keep both or delete the old one
(`cm shelveset delete sh:<id>`, irreversible). Keeping both is the safe default and costs only a
stale shelve.

## 4. Bring changes to the destination

The shelve from step 3 is now replayed onto the new branch. That replay is an ordinary merge, so
**`uvcs-merge` owns it from here**. Three commands, run one at a time and each one read before
the next is issued:

```
cm merge sh:5              # 1. preview, read-only; report conflicts before applying anything
cm merge sh:5 --merge      # 2. apply, in the mode uvcs-merge picks, then resolve and verify there
cm shelveset delete sh:5   # 3. only if nothing is left to resolve — irreversible, and last
```

- **The preview is never skipped.** The shelve was made against a different changeset, so a file
  both sides touched needs a content merge. Conflicts it reports go to the user *before* anything
  is applied: that is the "you will be notified" half of the promise made in step 2.
- Use `cm merge`, not `cm shelveset apply`. Apply previews fine (`--preview`) but rejects
  `--conflict-markers`, so the first file both sides touched falls to the configured merge tool —
  a GUI window no agent can drive (**branches-and-merge**).

The shelve is the user's backup for the whole operation. Anything unresolved, anything they still
have to decide, any doubt at all: **leave it**, report its id, and say why it is still there. A
stale shelve costs nothing; a deleted one is gone.

The result is **pending changes** — that is the finished state. Do not check in, and do not offer
to. The user carries on working exactly where they left off.

## Rules that keep this safe

- **Nothing here is a casual next step.** `cm undo` and `cm shelveset delete` destroy work no
  `cm` command can recover, and `cm switch` replaces every file in the workspace. Ask, then act,
  then report what happened.
- **Verify each step before the next.** Re-check `cm status` after the undo and `cm status
  --header` after the switch. A step that quietly did nothing — the cancelled prompt, a shelve
  with nothing in it — turns the next one into data loss.
- **Stop on the first failure and leave the workspace where it is.** Say which steps ran, which
  did not, and where the user's changes currently live. Half a switch reported as a success is
  the worst outcome available.
- If a merge is already in progress or conflict markers are still pending, finish that first
  (**`uvcs-merge`**) — the switch is refused until then anyway.
