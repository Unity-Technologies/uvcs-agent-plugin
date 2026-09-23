---
name: uvcs-address-review
description: >-
  Address the comments a reviewer left on a UVCS / Plastic SCM code review or merge request, as
  the code author: find the review on the workspace's branch, list the change requests,
  questions and comments still pending, plan their order, then fix, answer, discard or
  re-request under the user's direction, one check-in per change request. Use when the user says
  fix the review, address the review comments, apply the review changes, my review came back as
  rework required, answer the reviewer's question, discard a review comment, or re-request review.
  This is the author side — producing findings and publishing them is uvcs-code-review. All cm
  syntax comes from the uvcs-core skill — load it first.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# Addressing review comments with `cm`

This skill owns the *order and the stopping points*; every `cm` flag it names belongs to the
**`uvcs-core`** skill — load it first, and read `uvcs-core/references/reviews-and-merge-requests.md`
(comment types, replies, `[apply-change:]`) and `uvcs-core/references/find-queries.md` (comment
fields, `location` vs `line`, the revision lookup) rather than guessing.

**Check availability first**: no `comment`/`reviewer` in `cm mergerequest --usage`, only fixing works.

## 1. Anchor to the workspace's branch

```
cm status --header          # branch@repo@server, or the changeset/label/shelve it is pinned to
cm status                   # pending changes
```

- **Pending changes: stop.** Ask the user to check them in or shelve them
  (`cm shelveset create --all -c "..."`) first: every fix below checks in or undoes per file, and
  would sweep in or throw away unrelated edits. No workaround.
- **On a branch** — that branch is the target. Continue silently.
- **Pinned to a changeset** — unusual, and check-in is not the natural flow. Say so and ask first.
- **On a label or shelve** — stop. Name what it is on and let the user switch.
- **On a branch other than the one the user named** — stop, name both branches, ask, and wait;
  `cm switch` replaces their working tree. Once they agree, switch and stop again.

**Do not go looking on other branches.** The workspace's branch is the whole search space; no
review there, or nothing pending on it, means there is nothing to do — say so and stop.

## 2. Find the review

```
cm find review "where target='br:/main/task001'" --format="{id}|{title}|{status}|{owner}" --nototal
```

`review` and not `mergerequest`: a branch may carry a plain code review instead of an MR; on
either, `cm mr <id>` and `cm codereview <id>` are the same commands. Do **not** filter on *Rework
required*: pending is a property of the comment, not of the review's status. Two reviews on the
branch: list them, let the user pick, never merge queues.

## 3. Work out what is actually pending

```
cm find changereviewcomment "where reviewid=<id>" --xml --nototal
```

Take the thread **once** and keep it. Whether a parent is pending is decided by its **children**
(rows whose `parent` carries its id), never by its own fields: a discarded change keeps
`type=change` and `appliedinchangeset=-1`, an answered question keeps `type=question`.

| Bucket | The comment is |
|---|---|
| **change** — make it or discard it | `type=change`, `parent=-1`, `appliedinchangeset=-1`, and no row in the thread with `parent=<its id>` and `type=discarded` (from anyone) |
| **question** — answer it | `type=question`, `parent=-1`, and **no row in the thread with `parent=<its id>`** — its own fields never show whether it was answered; only a scan of the other rows does |
| **comment** — address, clarify or answer it | `type=comment` or `conversation`, `parent=-1`, no row with `parent=<its id>`, and posted by someone other than the user |
| **not yours** | everything else — a parent already applied or settled by a child, every child itself, and `timeline` |

`-1` is "unset" on every numeric field, never a real id. A `discarded` child settles its parent
whoever posted it — reviewer, author, or you earlier. All buckets empty: say so and stop.

**Line numbers: `{location}` + 1.** It is 0-based and works on every client; `-1` means the
comment is not anchored to a line (`uvcs-core/references/find-queries.md`).

**The file** comes from the comment's revision id — never search or guess it from the comment:

```
cm find revision "where id=<revisionid>" --format="{item}|{changeset}|{branch}" --nototal
```

**The anchor is what the reviewer read, not what is on disk.** `{changeset}` dates it; a later
changeset that touched the file may have moved the line or removed the code. Understand *what* the
reviewer asks about *which code* — reading the revision they saw if the workspace copy no longer
matches — then find that code in the workspace copy and fix it there. If the code already does
what is asked, nothing is left to check in: say so and propose a discard.

```
cm cat "revid:<revisionid>@rep:<repo>@repserver:<server>" --file=/tmp/reviewed.cs
```

**Give every item a short id**: reuse the bracketed id a comment starts with (`[B1]`, `[I2]`… from
`uvcs-code-review`), never renumber; otherwise `CH1`… for changes, `C1`… comments, `Q1`… questions.

## 4. Plan the order, show it, then ask how to work it

**Order matters: one fix can change or invalidate another.** Changes and comments first, questions
last — a fix can change the answer. Within them, from the most specific and least risky (a rename,
a one-line null check) to the most general (a refactor, a pattern across files): narrow fixes land
while the reviewer's anchors still hold, and the broad change then builds on top of them. Put a
dependency before what depends on it.

For each item, form a verdict before touching anything: exactly what the reviewer wants, where,
and how you would change it. Mark it **unclear** when you cannot state that with confidence, and
**disagree** only when you are sure the reviewer is wrong (the code already handles it, the change
breaks something) — with the reason; when in doubt it is *unclear*, not *disagree*.

Show the plan — id, file, line, request, any verdict — then ask which way to work, and **wait**:

- **Interactive** — you walk the plan one item at a time, and every fix, check-in, reply and
  discard waits for the user's "ok". Nothing reaches the server that they have not approved.
- **Unattended** — every clear item is worked without stopping, each fix in its own shelve and
  nothing checked in; the user reviews the shelves at the end. Default to Interactive.

## 5. Interactive — one item at a time, every step approved

Take the items in plan order. For each, show the request in full, keeping its line breaks (a
finding flattened into one line loses its fix), and your proposal; then **stop and wait**:

| Item | You propose, and revise until the user approves | On "ok" |
|---|---|---|
| change | the fix, applied in the workspace and shown as a diff | check in with the tag |
| question or comment | a reply | post it |
| question or comment pointing at a sensible change | the fix as a diff, then the reply | check in *without* the tag, then post "fixed in `cs:<id>`" |
| disagree | a discard, with the reason | post it |
| unclear | your question to the user | carry on with their answer |

The user can also name an item ("fix B1", "show Q2"), "skip" one (it stays pending, nothing is
posted), ask for "status", or say "do the rest" to switch to unattended. After each item, one
line — what happened, how many are left — and offer the next; never start it unasked.

A change, once the diff is approved — show the comment and file list, then:

```
cm checkin src/InventoryManager.cs -c "[apply-change:8123d65a] Null-check the slot before use"
```

**One comment, one changeset**, always: `[apply-change:<first 8 hex of the comment GUID>]` and a
one-line summary of the fix — batch two and one silently stays pending. Name **workspace** paths
(`{item}`; the `/src/...` anchor is a server path). On *"change requests … cannot be found or are
already applied"* the changeset still landed: never re-run the check-in; report it, move on.

A fix for a question or comment — **no** tag: on anything but a change it matches nothing and errors:

```
cm checkin src/InventoryManager.cs -c "Dispose the stream"
```

A reply, once its text is approved — by the comment's **GUID**, not the numeric `parent` id:

```
cm mr 311 comment reply <comment_guid> -commentsfile=<file>
```

A discard — the only way to settle a change you will not make; a plain reply leaves it pending:

```
cm mr 311 comment reply <comment_guid> --discard -commentsfile=<file>
```

## 6. Unattended — one shelve per item

Do not ask per item. Every fix lands in its **own** shelve, and nothing is checked in — the review
only changes when the user checks the shelves in.

```
cm shelveset create src/InventoryManager.cs --all \
    -c "[apply-change:8123d65a] Null-check the slot before use" --summaryformat
cm undo src/InventoryManager.cs
```

The `undo` keeps the next shelve to its own fix, and is safe only because step 1 left the workspace
clean: undo **exactly the paths you edited, named**, never `-r`, never without a shelve first.

Answer questions and comments as in Interactive mode without the approval round trip, after the
changes. Leave **unclear** and **disagree** items, and any answer that needs a fix, for the user.
If a fix or shelve fails, undo its paths, mark it skipped and **carry on**.

## 7. Wrap up

Show what happened to every item — applied, discarded, answered, skipped — with the changeset or
shelve it produced and the review, each a markdown link on its own `cs:<id>` / `sh:<id>` name
(`uvcs-core/references/deep-links.md`). What comes next depends on the mode:

- **Unattended** — nothing is in yet, so **do not re-request.** Hand the user the commands that
  land each shelve — its comment is the check-in comment, so the `[apply-change:]` tag fires —
  and tell them to ask you to re-request once those land; leave the re-request command out:

  ```
  cm shelveset apply sh:101 --preview
  cm shelveset apply sh:101
  cm checkin --all -c "[apply-change:8123d65a] Null-check the slot before use"
  ```

- **Interactive** — the fixes are in. Re-request once at least one item was applied or discarded;
  with everything skipped nothing changed, so there is nothing to re-request:

  ```
  cm mr 311 reviewer rerequest
  ```

## Mutating, irreversible, visible to other people

Steps 1–4 are read-only. From step 5 on: no `cm` command deletes a changeset, so confirm each
check-in in Interactive mode; every reply and discard notifies a human, so never post text the user
has not seen; `cm undo` is irreversible, so only on named paths, right after their shelve.

## Not this skill's job

Producing the findings is **`uvcs-code-review`** — this skill only replies. Landing the branch is
**`uvcs-merge`**. And never reach for `git` in a UVCS workspace, or invent a `cm` flag.
