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

**Check availability first**: no `comment`/`reviewer`/`review` in `cm mergerequest --usage`, only fixing works.

## 1. Anchor to the workspace's branch

```
cm status --header          # branch@repo@server, or the changeset/label/shelve it is pinned to
cm status                   # pending changes
```

- **Pending changes: stop and ask.** The user checks them in or shelves them — their call, never
  yours, and nothing else runs until they have: every fix below checks in or undoes per file, and
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
either, `cm mr` and `cm codereview` are the same commands on its id. Do **not** filter on *Rework
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
| **question** — answer it | `type=question`, `parent=-1`, and **no row in the thread with `parent=<its id>`** — a child of *any* type (`comment`, `discarded`…) answers it; its own fields never show that |
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
last — a fix can change the answer. Among the changes, **the smallest goes first and the broadest
last**, never thread order: a one-line rename **before** a three-file refactor, then the question.
Reorder only for a stated dependency: a request that names code another item creates goes after it.

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

Naming an item ("fix B1", "answer Q2") starts it — it is not the "ok", so draft and ask. "skip"
leaves one pending, "status" reports, "do the rest" switches to unattended. After each item, one
line — what happened, how many are left — and offer the next; never start it unasked.

A change, once the diff is approved — show the comment and file list, then:

```
cm checkin src/InventoryManager.cs -c "[apply-change:8123d65a] Null-check the slot before use"
cm checkin src/Shop.cs src/Wallet.cs -c "[apply-change:3f9a0c21] [apply-change:77be4d10] Price in cents"   # cannot build apart: one check-in
```

**One comment, one changeset**: the tag (first 8 hex of the GUID) and a one-line summary, so each
thread reads against its own diff — both tags in **one** check-in only for fixes that cannot build
or pass tests apart. Name **workspace** paths (`{item}`; the `/src/...` anchor is a server path).
On *"change requests … cannot be found or are already applied"* it landed: never re-run; report it.

A fix for a question or comment — **no** tag: on anything but a change it matches nothing and errors:

```
cm checkin src/InventoryManager.cs -c "Dispose the stream"
```

A reply, once its text is approved — by the comment's **GUID**, not the numeric `parent` id:

```
cm mr comment reply <comment_guid> -commentsfile=<file>
```

A discard — the only way to settle a change you will not make; a plain reply leaves it pending:

```
cm mr comment reply <comment_guid> --discard -commentsfile=<file>
```

Last item done: re-request, unless every item was skipped (then nothing changed):

```
cm mr review 311 --re-request --all
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

- **Unattended** — nothing is in yet, so **do not re-request, nor print its command as a later
  step.** Hand the user the commands that land each shelve — its comment is the check-in
  comment, so the `[apply-change:]` tag fires — and tell them to ask you for it once they land:

  ```
  cm shelveset apply sh:101 --preview
  cm shelveset apply sh:101
  cm checkin --all -c "[apply-change:8123d65a] Null-check the slot before use"
  ```

- **Interactive** — the fixes are in, and the re-request closing step 5 is the last command.

## Mutating, irreversible, visible to other people

Steps 1–4 are read-only. From step 5 on: no `cm` command deletes a changeset, so confirm each
check-in in Interactive mode; every reply and discard notifies a human, so never post text the user
has not seen; `cm undo` is irreversible, so only on named paths, right after their shelve.

## Not this skill's job

Producing the findings is **`uvcs-code-review`** — this skill only replies. Landing the branch is
**`uvcs-merge`**. And never reach for `git` in a UVCS workspace, or invent a `cm` flag.
