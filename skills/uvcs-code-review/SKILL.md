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
grammar) and `uvcs-core/references/diff-and-patch.md` (what each spec diffs, `--integration`,
capture rules) rather than guessing.

## What this skill owns, and what it yields

Two kinds of content, and they are not equal in authority:

- **UVCS mechanics — always this skill.** Which object to diff and how, getting real content
  instead of a file list, anchoring a finding to a file and line, publishing comments, setting
  reviewer status, reporting the result. Nothing else knows these.
- **Review judgement — yielded the moment anything else governs it.** Severity names and
  definitions, what counts as a finding, how findings are worded and formatted, how many to
  report. **If the project or the user supplies code-review rules, a review checklist, or another
  review skill, follow those** and use this skill only to carry the result into UVCS.

Only when nothing else governs does the default apply, and it is short: point at the exact line,
name the exact expression that is wrong, give a concrete fix, and drop anything you cannot say
precisely why is wrong. Style preferences are not defects.

## 1. Route the target

| The user means | Object | Review object |
|---|---|---|
| a branch, "this branch", an MR/PR | `br:/main/task001` | **merge request** — `cm mr` |
| one changeset | `cs:4207` | **code review** — `cm codereview` |
| a range | `cs:4100 cs:4207` | code review on the end changeset |
| a shelve | `sh:12` | **code review** — `cm codereview` |
| "my changes", nothing named | pending changes | none — chat only |

A branch under review **is** a merge request: that is how the review becomes assignable and
visible instead of a chat message that evaporates. A lone changeset or shelve is a plain code
review; reaching for `cm mr` there is the common mistake.

Default to pending changes when the user just says "review my changes". If the request is
genuinely ambiguous, ask rather than guess — a branch review publishes to other people.

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

Read the captured file **completely**. For pending changes, the workspace files on disk are the
"after" side:

```
cm status --machinereadable --all --includeRevId --fieldseparator="|"
```

Alongside the patch, take the per-file metadata once and **keep it for the whole review**:

```
cm diff <spec> --format="{status} {path} {baserevid} {revid} {repository}"
```

Every finding has to be anchored later to a **server path** (`/src/Player.cs`, not a workspace
path) and a line. An agent that throws this away has to redo the diff at publish time.

Binaries, Unity YAML assets (`.unity`, `.prefab` — not reviewable line by line), deleted files
and files that only moved get a mention in the report, not findings.

## 3. Review, and keep the anchors

Follow whatever governs judgement (see above). Whatever produces the findings, each one needs:

- a **short ID in brackets at the start of the comment text** — `[B1]`, `[I2]`… — so the author
  can say "fix B1" and the **`uvcs-address-review`** skill can find the comment again. Under the
  default judgement the letter is the severity: **B**locker, **I**mportant, **S**uggestion,
  **N**it. When other rules govern, take the letter from their severity names; keep the bracket
  and the number.
- the **server path** and the line, taken from the diff metadata. `--line` is the line as an
  editor shows it (**1-based**) — never convert it, never subtract one.

## 4. Show the findings, then ask what to publish

**Nothing is published automatically.** Show the findings in chat first and let the user choose:
all, all of one severity, specific IDs, all except some, or none. "None" means nothing is
published and the workflow stops there.

What you showed in chat **is** the comment text. Do not reword, summarize or reformat at publish
time — the user approved exactly the text that lands.

Then the offer depends on the target:

- **Pending changes** — there is no review object. The files are in the current workspace, so
  offer to fix the findings instead.
- **Branch, changeset, shelve** — offer to publish. **Never offer to fix the code.** The
  workspace is very likely not pointing at the object you reviewed, so editing files would
  corrupt something else entirely.
- **No findings at all** — say so, and for a branch or changeset offer to publish the approval
  (step 5 with no comments and a `Reviewed` status).

## 5. Publish

Confirm before anything is created or posted, with the target and the comment count visible —
each comment notifies a human, and a published review is public to the team.

Locate an existing review before creating a second one:

```
cm find mergerequest "where target='br:/main/task001'" --format="{id} {title}" --nototal
cm find review "where target='cs:4207'" --format="{id} {title}" --nototal
```

`target` only matches branches and changesets: for a shelve, ask the user for the review id
instead of assuming none exists.

If there is none, create it — that is the step that turns a review into something the team can
act on:

```
cm mergerequest create br:/main/task001 "<title>" --destination=br:/main --users=me,<user>
cm codereview cs:4207 "<title>" --users=me,<user>
cm codereview sh:12 "<title>" --users=me
```

On a review that already exists, put yourself on it:

```
cm mr <id> reviewer add --users=me
```

One comment per finding, anchored. Findings are multi-line, so write each to a file:

```
cm mr <id> comment add --path=/src/Player.cs --line=42 --type=Change -commentsfile=<file>
cm mr <id> comment add -commentsfile=<file>          # a remark on the review as a whole
```

`--type=Change` is right for a finding — it names something wrong and says what to fix. Keep
`--type=Question` for something you genuinely need the author to answer. On a code review,
`cm codereview <id>` substitutes for `cm mr <id>` throughout.

Finish with your own reviewer status, and say why in the same call:

```
cm mr <id> reviewer status --status="Rework required" -c="<one line on what needs attention>"
cm mr <id> reviewer status --status=Reviewed -c="<one line on why it is good to go>"
```

Report the result with a link the user can click —
`plastic://<server>/repos/<repo>/merge-requests/<id>`, or `/code-reviews/<id>` for a code review
(shapes and the `@` → `.` rewrite: `uvcs-core/references/deep-links.md`) — plus the comment
count and the status you set.

## Mutating, and visible to other people

Steps 1–4 are read-only end to end: analysis must never mutate anything, and a review that stops
after step 4 has cost nobody anything.

From step 5 on, every command is visible to the team — creating the MR, each comment, the
reviewer list, the status. Confirm first, and never publish findings the user did not select.

Deleting a review or a comment is irreversible and takes the whole thread with it. If a review
was created by mistake, say so and offer `--mergerequeststatus=Closed`; never present a delete as
a casual next step.

## Not this skill's job

Approving is not merging. When the user wants the branch actually merged — before or after the
review — hand off to the **`uvcs-merge`** skill; the preview, the mode and the check-in are its
decisions, not this one's.

Addressing comments is not reviewing either. When the user is the **author** — "fix the review",
"address these comments", "answer the reviewer" — that is **`uvcs-address-review`**, which reads
the thread back and applies the fixes.
