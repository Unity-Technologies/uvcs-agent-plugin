---
name: uvcs-address-review
description: >-
  Address the comments a reviewer left on a UVCS / Plastic SCM code review or merge request, as
  the code author: find the review on the workspace's branch, build a queue of the change requests
  and questions still pending, then work them one at a time under the user's direction or
  unattended with one shelve per comment. It applies the fixes, links each check-in back to its
  comment with the [apply-change:] tag, posts answers, discards a request the user rejects, and
  re-requests the review. Use when the user says fix the review, address the review comments,
  apply the review changes, rework required, answer the reviewer's question, discard a review
  comment, or re-request review. This is the author side — producing findings and publishing them
  is uvcs-code-review. All cm syntax comes from the uvcs-core skill — load it first.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# Addressing review comments with `cm`

This skill owns the *order and the stopping points*. Every `cm` flag, field sentinel and
availability note it names belongs to the **`uvcs-core`** skill — load it first, and read
**reviews-and-merge-requests** (comment types, replies, the `[apply-change:]` tag) and
**find-queries** (comment fields, `location` vs `line`, the revision lookup) rather than guessing.

The reviewer's comments are the spec, and they are anchored to code that may have moved since.
So the shape of this workflow is *anchor to one review on one branch, work out what is genuinely
still pending, then change exactly one thing per changeset* — never a batch that leaves nobody
able to tell which fix answered which comment.

**Availability gate, once, before promising anything.** The `comment` and `reviewer` subcommand
groups are newer than some clients; `cm mergerequest --usage` lists them where they exist. Where
they do not, the fix-and-check-in half still works completely — `[apply-change:]` is a check-in
tag, not a review command — but answering, discarding and re-requesting do not. Say which half
you can do instead of discovering it mid-queue.

## 1. Anchor to the workspace's branch

Addressing comments means editing files and creating changesets, so the workspace is not context
here — it is the thing being changed.

```
cm status --header          # branch@repo@server, or the changeset/label/shelve it is pinned to
cm status                   # pending changes
```

- **Pending changes: stop.** Ask the user to check them in or shelve them
  (`cm shelveset create --all -c "..."`) first. Everything below either checks in or undoes on a
  per-file basis, and unrelated edits sitting in the workspace would be swept into a fix's
  changeset or thrown away by its undo. This is the one gate with no workaround.
- **On a branch** — that branch is the target. Continue silently; do not announce that the
  workspace looks fine.
- **Pinned to a changeset** — unusual, and check-in is not the natural flow from there. Say so and
  ask before continuing.
- **On a label or a shelve** — stop. Applying review fixes needs the workspace on the reviewed
  branch; name what it is on and let the user switch.

**If the user named a branch other than the workspace's, never switch silently.** `cm switch`
replaces their working tree. Ask, and if they agree run it and then stop — re-read the state on
the next request rather than carrying stale paths across the switch.

**Do not go looking on other branches.** The workspace's branch is the whole search space. No
review there, or nothing pending on it, means there is nothing to do — say that and stop. Trying
other branches, other statuses or other repositories is how this workflow starts editing the
wrong code.

## 2. Find the review

```
cm find review "where target='br:/main/task001'" \
    --format="{id}|{title}|{targettype}|{status}|{owner}" --nototal
```

`review` and not `mergerequest`: a branch may carry a plain code review instead of an MR, and the
author has to address either. On whichever exists, `cm mr <id>` and `cm codereview <id>` are the
same commands on the same id.

*Rework required* is the normal reason you are here, but do **not** filter on it. Whether a
comment is pending is a property of the comment — nothing applied it and nothing discarded it —
not of the review's status field, and a reviewer often leaves change requests without finishing
their pass. Report the status you found and move on.

More than one review on the branch: list them and let the user pick. Never merge two reviews'
comments into one queue.

## 3. Work out what is actually pending

```
cm find changereviewcomment "where reviewid=<id>" --xml --nototal
```

`--xml` because comment text is free-form and may contain newlines, which no `--format` string can
delimit. Take the thread **once** and keep it — every step below reads from it.

A comment is pending only on the evidence of its own children:

| Bucket | The comment is |
|---|---|
| **change to make** | `type=change`, `parent=-1`, `appliedinchangeset=-1`, and no child of `type=discarded` |
| **question to answer** | `type=question`, `parent=-1`, and no child at all |
| **not yours** | everything else — already applied, already discarded, already answered, plus `conversation`, `comment` and `timeline` |

`-1` is the unset value on every numeric field, so `appliedinchangeset=-1` is "not applied" and
`parent=-1` is "top-level" — never a real id. If both buckets come out empty, say the review is
already addressed and stop.

**Line numbers.** Use `{location}` and **add 1**. It is the 0-based stored position; the 1-based
`{line}` alias does not exist on every client, so `location + 1` is the portable rule and the +1
is not optional. `location=-1` means the comment is not anchored to a line at all.

**The file to edit.** The comment carries a revision id, not a path. Resolve it, do not search for
it and do not guess from names in the comment text:

```
cm find revision "where id=<revisionid>" --format="{item}|{changeset}|{branch}" --nototal
```

`{item}` is the path to edit. `{changeset}` dates the anchor: it is the revision the reviewer was
reading, not necessarily what is on disk now. **Read the file around the line before editing it**
— if the code the reviewer described is not there any more, the fix may already be in, or the
line may have shifted. Say so instead of editing whatever now sits at that line number.

When a comment only makes sense against the surrounding change, capture the branch's diff and read
it: `cm patch br:/main/task001 --integration > <tmp> 2>&1`.

**Give every item a short id.** Reuse the reviewer's own — `uvcs-code-review` writes `[B1]`,
`[I1]`, `[S1]`, `[N1]` into the comment text and the user will refer to those, so never renumber
them. For a hand-written comment with no embedded id, assign `CH1`, `CH2`… to changes and `Q1`,
`Q2`… to questions, skipping numbers an embedded id already took.

## 4. Show the queue, then ask how to work it

Sort by file and line so the queue reads top-down through the code, and show it before touching
anything:

```
**Review 311: "Inventory cleanup"** — reviewer @<user>, status Rework required, 3 pending

Changes to make

| # | File | Line | Request |
|---|---|---|---|
| B1 | /src/InventoryManager.cs | 89 | Slot is dereferenced before the null check |
| S1 | /src/ItemData.cs | 26 | Weight is not clamped to >= 0 |

Questions to answer

| # | File | Line | Question |
|---|---|---|---|
| Q1 | /src/Player.cs | 104 | Is the 30s timeout intentional? |
```

Then ask which way to work, and **wait** — this is the last cheap moment to reorder, skip or drop
something, and the two modes differ in what reaches the server:

- **Assisted** — the user drives. They say "fix B1", "answer Q1", "discard S1", "show B1",
  "status"; each fix is shown before it is checked in. Nothing happens that they did not ask for.
- **Unattended** — every item is worked through without stopping, each fix landing in its own
  shelve and nothing checked in. The user reviews the shelves at the end.

Default to Assisted if the user does not choose, but do not start in either mode until they have
seen the queue.

## 5. Assisted — one item, on request

Act only on what the user asked for. Do not pick the next item, do not suggest one, and do not
start a fix they did not name.

**A change.** Show the request in full — reviewer comments are structured (`What's wrong` / `Why it
matters` / `Fix`), so keep the line breaks instead of flattening them into a paragraph. Read the
file, apply the fix, show the result as a diff, and wait. Tweak and re-show as long as they keep
asking. On "ok", confirm the check-in with the comment and the file list visible, then:

```
cm checkin /src/InventoryManager.cs -c "[apply-change:8123d65a] Null-check the slot before use"
```

**One comment, one changeset**, always. The 8-hex is the first block of the comment GUID, and it
is what links the changeset to the comment — batch two fixes and one of them silently stays
pending. Name the paths: a bare `cm checkin` is scoped to the current directory. On the
*"change requests … cannot be found or are already applied"* error the changeset still landed and
only the link is missing — never re-run the check-in; report it and move on.

**A question.** Read the code at the line and around it, propose a reply, and let the user edit it.
Only after they agree:

```
cm mr 311 comment reply <comment_guid> -commentsfile=<file>
```

`reply` takes the comment's **GUID**, not the numeric id that `parent` fields carry. Use
`-commentsfile` rather than `-c` for anything you generated — quoting rules differ per shell.

**A discard, and only when the user says so.** Discarding tells the reviewer their request was
rejected; that is a social act and never yours to propose. Ask for the reason, confirm, then:

```
cm mr 311 comment reply <comment_guid> --discard -commentsfile=<file>
```

After each item, one line: what happened and how many are left. On "status", show what is applied,
discarded, skipped and pending. "Skip" leaves an item pending and posts nothing. If the user says
"do the rest" or "go", switch to unattended for what remains and say you are doing it.

## 6. Unattended — one shelve per item

The user chose not to be interrupted, so do not ask per item. Every fix still lands in its **own**
shelve, and nothing is checked in — the review only changes when the user checks the shelves in.

```
cm shelveset create /src/InventoryManager.cs --all \
    -c "[apply-change:8123d65a] Null-check the slot before use" --summaryformat
cm undo /src/InventoryManager.cs
```

The `undo` is what makes the next shelve contain only its own fix; without it every shelve piles
up all the previous ones. It is safe *here and only here*: step 1 guaranteed a clean workspace, so
the sole thing it discards is the fix just shelved. Undo **exactly the paths you edited**, named
— never `-r` over the workspace, and never after a step that did not shelve first.

The tag in a shelve comment links nothing — only a check-in triggers the server-side match. It is
there so the shelve carries its own ready-made check-in comment.

Answer questions the same way as in Assisted mode, without the approval round trip. Work changes
before questions: a fix can change the answer.

If a fix or a shelve fails, report it in one line, mark the item skipped and **carry on** — one bad
item must not strand the rest. Leave no half-applied edit behind: undo the paths you touched for
that item before moving to the next one.

## 7. Wrap up

Show what happened to every item — applied, discarded, answered, skipped — with the changeset or
shelve each one produced, and a `plastic://` link for the review (shapes and the `@` → `.` rewrite:
**plastic-links**). Shelveset links use the **positive** id.

Then re-request the review, and the timing differs by mode:

```
cm mr 311 reviewer rerequest
```

- **Assisted** — the fixes are in. Re-request once at least one item was applied or discarded.
- **Unattended** — nothing is in yet. **Do not re-request.** Tell the user to apply the shelves
  they want (`cm shelveset apply sh:<id> --preview`, then without `--preview`), check them in with
  the shelve's own comment so the `[apply-change:]` tag fires, and ask you to re-request when
  they are done.
- **Everything skipped** — nothing changed, so there is nothing for the reviewer to look at.
  Do not re-request.

## Mutating, irreversible, and visible to other people

Steps 1–4 are read-only end to end, and a session that stops after the queue has cost nobody
anything. From step 5 on:

- **Check-in reaches the server and other people build on it.** No `cm` command deletes a
  changeset. Confirm each one in Assisted mode.
- **Every reply and every discard notifies a human.** Never post text the user has not seen, and
  never propose a discard.
- **`cm undo` is irreversible** and takes anything else pending with it. Only ever run it on named
  paths, immediately after the shelve that saved them.

## Not this skill's job

Producing the findings is **`uvcs-code-review`** — this skill consumes comments that already
exist and never writes new ones except as replies. Landing the branch afterwards is
**`uvcs-merge`**. And there is no rebase, no staging area and no local commit: never reach for
`git` in a UVCS workspace, and never invent a `cm` flag — check `uvcs-core` or `cm help`.
