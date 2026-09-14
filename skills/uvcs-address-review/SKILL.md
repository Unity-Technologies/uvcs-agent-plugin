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

The reviewer's comments are the spec, and they are anchored to code that may have moved since. So
the shape is *anchor to one review on one branch, work out what is genuinely still pending, then
change exactly one thing per changeset* — never a batch that leaves nobody able to tell which fix
answered which comment.

**Check availability once, before promising anything** — `cm mergerequest --usage` lists the
`comment` and `reviewer` groups where the client has them. Without them the fix-and-check-in half
still works completely (`[apply-change:]` is a check-in tag, not a review command) but answering,
discarding and re-requesting do not. Say which half you can do rather than finding out mid-queue.

## 1. Anchor to the workspace's branch

The workspace is not context here — it is the thing being changed.

```
cm status --header          # branch@repo@server, or the changeset/label/shelve it is pinned to
cm status                   # pending changes
```

- **Pending changes: stop.** Ask the user to check them in or shelve them
  (`cm shelveset create --all -c "..."`) first. Everything below checks in or undoes per file, so
  unrelated edits would be swept into a fix's changeset or thrown away by its undo. No workaround.
- **On a branch** — that branch is the target. Continue silently; do not announce that the
  workspace looks fine.
- **Pinned to a changeset** — unusual, and check-in is not the natural flow. Say so and ask first.
- **On a label or shelve** — stop. Name what it is on and let the user switch.
- **On a branch other than the one the user named** — stop and ask; `cm switch` replaces their
  working tree. The switch is not your next action: name both branches, ask, and wait. Only once
  they agree, switch and then stop again, so nothing carries stale paths across it.

**Do not go looking on other branches.** The workspace's branch is the whole search space. No
review there, or nothing pending on it, means there is nothing to do — say so and stop. Other
branches, statuses or repositories are how this workflow ends up editing the wrong code.

## 2. Find the review

```
cm find review "where target='br:/main/task001'" --format="{id}|{title}|{status}|{owner}" --nototal
```

`review` and not `mergerequest`: a branch may carry a plain code review instead of an MR, and the
author has to address either. On whichever exists, `cm mr <id>` and `cm codereview <id>` are the
same commands on the same id.

*Rework required* is the usual reason you are here, but do **not** filter on it: whether a comment
is pending is a property of the comment — nothing applied it, nothing discarded it — not of the
review's status field, and reviewers often leave change requests without finishing a pass. Two
reviews on the branch: list them, let the user pick, never merge their comments into one queue.

## 3. Work out what is actually pending

```
cm find changereviewcomment "where reviewid=<id>" --xml --nototal
```

Take the thread **once** and keep it — every step below reads from it. A comment is pending only
on the evidence of its own children:

| Bucket | The comment is |
|---|---|
| **change to make** | `type=change`, `parent=-1`, `appliedinchangeset=-1`, no child of `type=discarded` |
| **question to answer** | `type=question`, `parent=-1`, no child at all |
| **not yours** | everything else — a parent already applied, or settled by a child (`type=discarded` discards it whoever left it, `comment` answers it), and every child itself, plus `conversation` and `timeline` |

`-1` is the unset value on every numeric field, never a real id. A `discarded` child settles its
parent whoever posted it — a discard already in the thread counts exactly like one you post. If
both buckets are empty, say the review is already addressed and stop.

**Line numbers: use `{location}` and add 1.** It is 0-based, the 1-based `{line}` alias is missing
on older clients, and the +1 is not optional. `location=-1` means not anchored to a line at all.

**The file to edit** comes from the comment's revision id — resolve it, never search for it or
guess from names in the comment text:

```
cm find revision "where id=<revisionid>" --format="{item}|{changeset}|{branch}" --nototal
```

`{item}` is the path; `{changeset}` dates the anchor — what the reviewer read, not necessarily
what is on disk. **Read the file around the line before editing**, and the branch diff too when a
comment only makes sense against the whole change (`cm patch br:/main/task001 --integration`): if
the code the reviewer described is gone, the fix may already be in or the line has shifted.

**Give every item a short id.** When the comment text starts with a bracketed id (`uvcs-code-review`
writes `[B1]`, `[I2]`…), reuse it: the user will refer to it, so never renumber. For a comment
with none, assign `CH1`, `CH2`… to changes and `Q1`, `Q2`… to questions.

## 4. Show the queue, then ask how to work it

Sort by file and line so the queue reads top-down through the code, and show it — id, file, line,
and the first line of the request — before touching anything, with the changes and the questions
separated; they end differently. Then ask which way to work, and **wait**. This is the last cheap
moment to reorder, skip or drop something, and the modes differ in what reaches the server:

- **Assisted** — the user drives. They say "fix B1", "answer Q1", "discard S1", "show B1",
  "status"; each fix is shown before it is checked in. Nothing happens they did not ask for.
- **Unattended** — every item is worked without stopping, each fix landing in its own shelve and
  nothing checked in. The user reviews the shelves at the end. Default to Assisted if they do not
  choose.

## 5. Assisted — one item, on request

Act only on what the user asked for: never pick the next item, suggest one, or start a fix they
did not name.

**A change.** Show the request in full, keeping its line breaks — a finding flattened into one
line loses its fix. Read the file, apply the fix, show the result as a diff, and wait; tweak and
re-show as long as they keep asking. On "ok", confirm the check-in with the comment and file list
visible, then:

```
cm checkin src/InventoryManager.cs -c "[apply-change:8123d65a] Null-check the slot before use"
```

**One comment, one changeset**, always. The 8-hex is the first block of the comment GUID and it is
what links the changeset to the comment — batch two fixes and one silently stays pending. Name the
paths, as **workspace** paths (`{item}` gave them; the comment's `/src/...` anchor is a server
path): a bare `cm checkin` is scoped to the current directory. On the *"change requests … cannot
be found or are already applied"* error the changeset still landed and only the link is missing:
never re-run the check-in, report it and move on.

**A question.** Read the code at the line and around it, propose a reply, let the user edit it.
Only once they agree:

```
cm mr 311 comment reply <comment_guid> -commentsfile=<file>
```

`reply` takes the comment's **GUID**, not the numeric id that `parent` fields carry.

**A discard, only when the user says so.** It tells the reviewer their request was rejected; that
is a social act and never yours to propose. Ask for the reason, confirm, then:

```
cm mr 311 comment reply <comment_guid> --discard -commentsfile=<file>
```

After each item, one line: what happened and how many are left. On "status", show applied,
discarded, skipped and pending; "skip" leaves an item pending and posts nothing; on "do the rest"
or "go", switch to unattended for what remains and say you are doing it.

## 6. Unattended — one shelve per item

The user chose not to be interrupted, so do not ask per item. Every fix still lands in its **own**
shelve, and nothing is checked in — the review only changes when the user checks the shelves in.

```
cm shelveset create src/InventoryManager.cs --all \
    -c "[apply-change:8123d65a] Null-check the slot before use" --summaryformat
cm undo src/InventoryManager.cs
```

The `undo` is what keeps the next shelve to its own fix; without it every shelve piles up all the
previous ones. It is safe *here and only here*: step 1 guaranteed a clean workspace, so the only
thing it discards is the fix just shelved. Undo **exactly the paths you edited, named** — never
`-r` over the workspace, and never after a step that did not shelve first.

Answer questions as in Assisted mode, without the approval round trip, and work changes first — a
fix can change the answer. If a fix or shelve fails, report it in one line, mark the item skipped
and **carry on**; one bad item must not strand the rest. Undo the paths you touched for it first,
so no half-applied edit is left behind.

## 7. Wrap up

Show what happened to every item — applied, discarded, answered, skipped — with the changeset or
shelve it produced, and a `plastic://` link for the review (**deep-links**; shelveset links use
the **positive** id). Whether you re-request at all depends on the mode:

- **Assisted** — the fixes are in. Re-request once at least one item was applied or discarded:

  ```
  cm mr 311 reviewer rerequest
  ```

- **Unattended** — nothing is in yet, so **do not re-request.** Tell the user to apply the shelves
  they want (`cm shelveset apply sh:<id> --preview`, then without it), check them in with the
  shelve's own comment so the `[apply-change:]` tag fires, then ask you to re-request.
- **Everything skipped** — nothing changed; there is nothing for the reviewer to look at.

## Mutating, irreversible, visible to other people

Steps 1–4 are read-only end to end, and a session that stops after the queue has cost nobody
anything. From step 5 on: a check-in reaches the server and other people build on it and no `cm`
command deletes a changeset, so confirm each one in Assisted mode; every reply and every discard
notifies a human, so never post text the user has not seen; and `cm undo` is irreversible and
takes anything else pending with it, so only ever on named paths, right after their shelve.

## Not this skill's job

Producing the findings is **`uvcs-code-review`** — this skill only replies. Landing the branch is
**`uvcs-merge`**. And never reach for `git` in a UVCS workspace, or invent a `cm` flag.
