---
name: uvcs-code-review
description: >-
  Review UVCS / Plastic SCM changes as the reviewer and publish the findings as review comments:
  a branch through its merge request, a changeset or shelve through a code review, or the
  workspace's pending changes in chat. Use when the user says review my changes, review this
  branch, review changeset 42 or shelve 12, code review, open a merge request or pull request,
  request a review from someone, publish review comments, approve, LGTM, or set my status to
  rework required. Works with any review rules or checklist the project already supplies.
  Performing the merge is uvcs-merge; fixing a review as its author is uvcs-address-review. All
  cm syntax comes from the uvcs-core skill — load it first.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# Code review with `cm`

Every `cm` flag, output token and availability note this skill names belongs to the
**`uvcs-core`** skill — load it first, and read
`uvcs-core/references/reviews-and-merge-requests.md` (MR and review lifecycle, reviewers, comment
grammar) and `uvcs-core/references/diff-and-patch.md` (what each spec diffs, `--integration`).

## What this skill owns, and what it yields

Two kinds of content, and they are not equal in authority:

- **UVCS mechanics — always this skill.** Which object to diff and how, getting real content
  instead of a file list, anchoring a finding to a file and line, publishing comments, setting
  reviewer status. Nothing else knows these.
- **Review judgement — yielded the moment anything else governs it.** Severity names and
  definitions, what counts as a finding, how many to report, and the report layout when they
  supply one. **If the project or the user supplies code-review rules, a review checklist, or
  another review skill, follow those** and use this skill only to carry the result into UVCS.

Only when nothing else governs does the default apply: point at the exact line, name the exact
expression that is wrong, give a concrete fix, and drop anything you cannot say precisely why is
wrong. Style preferences are not defects.

## 1. Route the target

| The user means | Object | Review object |
|---|---|---|
| a branch, "this branch", an MR/PR | `br:/main/task001` | **merge request** — `cm mr` |
| one changeset | `cs:4207` | **code review** — `cm codereview` |
| a range | `cs:4100 cs:4207` | code review on the end changeset |
| a shelve | `sh:12` | **code review** — `cm codereview` |
| "my changes", nothing named | pending changes | none — chat only |

A branch under review **is** a merge request: that is how the review becomes assignable instead
of a chat message that evaporates. A lone changeset or shelve is a plain code review; reaching
for `cm mr` there is the common mistake. Default to pending changes when the user just says
"review my changes", and ask rather than guess when the target is ambiguous — a branch review
publishes to other people.

```
cm status --header      # the workspace's branch@repo@server — the target when none is named
```

## 2. Read the change, not the file list

A review of filenames is not a review. Get the content:

```
cm patch br:/main/task001 --integration > <tmp> 2>&1   # what would land in the destination
cm patch cs:4207 > <tmp> 2>&1
cm patch cs:4100 cs:4207 > <tmp> 2>&1
cm patch sh:12 > <tmp> 2>&1
```

Read it **completely**. For pending changes, the workspace files on disk are the "after" side:

```
cm status --machinereadable --all --includeRevId --iscochanged --fieldseparator="|"
```

Alongside the patch, take the per-file metadata once and **keep it for the whole review**:

```
cm diff <spec> --format="{status} {path} {baserevid} {revid} {repository}"
```

Every finding is anchored to a **server path** (`/src/Player.cs`, not a workspace path) and a
line. Binaries, deleted files and files that only moved get a mention in the report, not findings.

## 3. Review, and keep the anchors

Follow whatever governs judgement (see above). Each finding needs a **short ID in brackets** —
`[B1]`, `[I2]`… — so the author can say "fix B1" and **`uvcs-address-review`** can find the
comment again; the letter is its severity (**B**locker, **I**mportant, **S**uggestion, **N**it,
or the initials of whatever scheme governs). It also needs the **server path** and the line from
the diff metadata: `--line` is **1-based**, the line as an editor shows it — never subtract one.

## 4. Show the findings, then ask what to publish

**Nothing is published automatically.** Show every finding in chat first, in this layout: a
header table, then one section per severity in the order 🔴 BLOCKERS, 🟡 IMPORTANT, 💡 SUGGESTIONS,
⚪ NITS — each with its count, and **no section at all for a severity with no findings**.

````markdown
# Review — <branch link>

> **Rework required** — <one sentence on why>

| Branch | <link> → <destination> |
|---|---|
| **Changesets** | <first> – <last> (6) |
| **Files** | 4 |
| **Merge request** | <link, or "none yet"> |
| **Findings** | 2 blockers · 4 important · 1 suggestion · 1 nit |
| **Published** | nothing |

## 🔴 BLOCKERS (2)

### [B1] Air jumps play the jump clip twice

**`/src/PlayerController.cs`** line 106

The air-jump branch calls `PlayOneShot`, and `PlayerJumped` plays the same clip a frame later.

**Fix** — delete line 106; `PlayerJumped` already handles the audio:

```diff
- audioSource.PlayOneShot(jumpAudio);
```

---

### [B2] …
````

A `---` goes between findings, never before the first or after the last in a section. The icon
goes on the **section** heading only: repeated per finding it is noise, and the two heading
levels look alike in a terminal — caps sections against sentence-case finding titles is what
carries the hierarchy. Code goes in a fenced block, never inline in prose: `diff` with `-`/`+`
when a line is replaced or deleted, the file's own language for added code. No "checked and
fine" list; add a **Verified** row only when a check closes a concern already raised.

What gets published is the finding **body** — `[B1] /src/PlayerController.cs line 106 — <what is
wrong>. Fix: …`. Titles, section headings and rules are chat structure: a UVCS thread renders no
headings and already shows the anchor. Beyond dropping them, do not reword what the user approved.

Then let the user choose: all, all of one severity, specific IDs, all except some, or none —
"none" stops the workflow with nothing published. What you offer depends on the target:

- **Pending changes** — no review object; the files are in the current workspace, so offer to fix
  the findings instead.
- **Branch, changeset, shelve** — offer to publish. **Never offer to fix the code**: the
  workspace is very likely not pointing at the object you reviewed.
- **No findings at all** — say so, and for a branch or changeset offer to publish the approval
  (step 5 with no comments and a `Reviewed` status).

## 5. Publish

Confirm before anything is created or posted, with the target and the comment count visible.

Locate an existing review before creating a second one:

```
cm find mergerequest "where target='br:/main/task001'" --format="{id} {title}" --nototal
cm find review "where target='cs:4207'" --format="{id} {title}" --nototal
```

`target` only matches branches and changesets: for a shelve, ask the user for the review id
instead of assuming none exists.

If there is none, create it — that turns the review into something the team can act on:

```
cm mergerequest create br:/main/task001 "<title>" --destination=br:/main --users=me,<user>
cm codereview cs:4207 "<title>" --users=me,<user>
cm codereview sh:12 "<title>" --users=me
cm mr <id> reviewer add --users=me      # on one that already exists, put yourself on it
```

One comment per finding, anchored. Findings are multi-line, so write each to a file:

```
cm mr <id> comment add --path=/src/Player.cs --line=42 --type=Change -commentsfile=<file>
cm mr <id> comment add -commentsfile=<file>                  # a remark on the review as a whole
cm codereview <id> comment add --path=/src/Player.cs --line=42 --type=Change -commentsfile=<file>
```

`--type=Change` is right for a finding; keep `--type=Question` for something you genuinely need
the author to answer. On a code review every subcommand is spelled `cm codereview <id> ...`,
never `cm mr` — there is no merge request there.

Finish with your own reviewer status, and say why in the same call:

```
cm mr <id> reviewer status --status="Rework required" -c="<one line on what needs attention>"
cm mr <id> reviewer status --status=Reviewed -c="<one line on why it is good to go>"
cm codereview <id> reviewer status --status=Reviewed -c="<...>"        # on a code review
```

Then report what landed: update the header table's **Merge request** and **Published** rows with
the review's link, the comment count and the status. Links come from
`uvcs-core/references/deep-links.md`, never from memory.

## Mutating, and visible to other people

Steps 1–4 are read-only end to end: analysis must never mutate anything, and a review that stops
after step 4 has cost nobody anything. From step 5 on, every command is visible to the team —
creating the MR, each comment, the reviewer list, the status. Confirm first, and never publish
findings the user did not select. Deleting a review or a comment is irreversible and takes the
whole thread with it: if one was created by mistake, say so and offer
`--mergerequeststatus=Closed`, never a delete as a casual next step.

## Not this skill's job

Approving is not merging: when the user wants the branch merged — before or after the review —
hand off to the **`uvcs-merge`** skill; the preview, the mode and the check-in are its decisions.
Addressing comments is not reviewing either: when the user is the **author** ("fix the review",
"address these comments", "answer the reviewer"), that is **`uvcs-address-review`**.
