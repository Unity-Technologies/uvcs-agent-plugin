---
name: uvcs-code-review
description: >-
  Review UVCS / Plastic SCM changes as the reviewer and publish the findings as review comments:
  a branch through its merge request, a changeset or shelve through a code review, or the
  workspace's pending changes in chat. Use when the user says review my changes, review this
  branch, review changeset 42 or shelve 12, code review, open a merge request or pull request,
  request a review from someone, publish review comments, approve, LGTM, or set my status to
  rework required. Merges the project's own code-review-rules skill into its general review
  rules when the project has one. Performing the merge is uvcs-merge; fixing a review as its
  author is uvcs-address-review. All cm syntax comes from the uvcs-core skill — load it first.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# Code review with `cm`

Every `cm` flag, output token and availability note this skill names belongs to the
**`uvcs-core`** skill — load it first, and read
`uvcs-core/references/reviews-and-merge-requests.md` (MR and review lifecycle, reviewers, comment
grammar) and `uvcs-core/references/diff-and-patch.md` (what each spec diffs, `--integration`).

## Two halves

- **UVCS mechanics — this file.** Which object to diff and how, getting real content instead of a
  file list, publishing comments anchored to a file and line, setting reviewer status.
- **Review judgement — `assets/review-prompt.md`.** What counts as a finding, the severities, how
  a finding is worded and laid out. It is the prompt the review itself runs from (step 3), and it
  is where the project's own rules are merged in: a project skill named `code-review-rules` wins
  over its general rules wherever they conflict. Nothing about judgement lives here.

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

For pending changes, the workspace files on disk are the "after" side:

```
cm status --machinereadable --all --includeRevId --iscochanged --fieldseparator="|"
```

Alongside the patch, take the per-file metadata once and **keep it for the whole review**:

```
cm diff <spec> --format="{status} {path} {baserevid} {revid} {repository}"
```

Every finding is anchored to a **server path** (`/src/Player.cs`, not a workspace path) and a
line. Binaries, deleted files and files that only moved get a mention in the report, not findings.

## 3. Run the review in a fresh agent

The review runs from `assets/review-prompt.md` in an agent of its own, with a clean context: the
diff and the code around it fill a context window by themselves, and a reviewer that still
carries this conversation, the routing and the publishing commands reviews worse. Where the
client cannot start one, follow that prompt yourself, in this session, right after step 2 — the
prompt is the review either way, never a step to skip.

First collect what the prompt's **Inputs** block asks for:

- **Project rules.** A skill named `code-review-rules`, or any loaded skill whose description
  says it holds this project's code review rules or checklist: read it and paste its body in
  whole. Rules the user pasted or pointed at count too. Nothing found means `none` — do not
  search the repository for a rules file. When the user asks to *set up* review rules for the
  project, create `code-review-rules/SKILL.md` in the client's project skills directory from
  `assets/code-review-rules-template.md`.
- **A read command** for whole files, so the reviewer can see callers and context the diff omits:

  ```
  cm cat "serverpath:<path>#br:/main/task001"                     # the after side (#br: or #cs:)
  cm cat "revid:<revid>@rep:<repo>@repserver:<server>"            # either side, from the diff rows
  ```

  For pending changes the after side is the file on disk.
- **The request**, in the user's words: a focus, "skip nits", a concern to verify.

Read the prompt file, fill the block in, and hand the whole text to the new agent together with
the patch path. What comes back is the report body: a verdict line, one section per severity, and
findings with a bracketed id, a path and a 1-based line. Keep it exactly — the `[B1]` ids are how
the author says "fix B1" and how **`uvcs-address-review`** finds the comment again.

## 4. Show the report, then ask what to publish

**Nothing is published automatically.** Show the whole report first: a title, then the header
table inserted right after the reviewer's verdict line, then the rest untouched.

````markdown
# Review — <branch link>

> **Rework required** — <the reviewer's sentence>

| Branch | <link> → <destination> |
|---|---|
| **Changesets** | <first> – <last> (6) |
| **Files** | 4 |
| **Merge request** | <link, or "none yet"> |
| **Findings** | 2 blockers · 4 important · 1 suggestion · 1 nit |
| **Published** | nothing |

## 🔴 BLOCKERS (2)
…
````

A **Verified** row goes in the table only when the reviewer emitted one, closing a concern the
user raised. Nothing else is added: no "checked and fine" list, no reworded findings.

What gets published is the finding **body** — `[B1] /src/PlayerController.cs line 106 — <what is
wrong>. Fix: …`. Titles, section headings and rules are chat structure: a UVCS thread renders no
headings and already shows the anchor. Beyond dropping them, do not reword what the user approved.

Then let the user choose: all, all of one severity, specific ids, all except some, or none —
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

Two different numbers: create takes the **object spec** from step 1 (`cs:4207`, `sh:12`, never a
bare `4207`), and every later subcommand takes the **review id** the create printed.

One comment per finding, anchored. Findings are multi-line, so write each to a file:

```
cm mr <id> comment add --path=/src/Player.cs --line=42 --type=Change -commentsfile=<file>
cm mr <id> comment add --path=/src/Player.cs --line=58 --type=Question -commentsfile=<file>   # a [Q] item
cm mr <id> comment add -commentsfile=<file>                  # a remark on the review as a whole
cm codereview <id> comment add --path=/src/Player.cs --line=42 --type=Change -commentsfile=<file>
```

Every finding — blocker, important, suggestion, nit — is `--type=Change`: it names something
wrong and tells the author what to fix. `--type=Question` is only for the report's `[Q]` items,
which ask the author something instead. On a code review every subcommand is spelled
`cm codereview <id> ...`, never `cm mr` — there is no merge request there.

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

Steps 1–4 are read-only end to end: analysis must never mutate anything — the reviewer agent
included — and a review that stops after step 4 has cost nobody anything. From step 5 on, every
command is visible to the team — creating the MR, each comment, the reviewer list, the status.
Confirm first, and never publish findings the user did not select. Deleting a review or a comment
is irreversible and takes the whole thread with it: if one was created by mistake, say so and
offer `--mergerequeststatus=Closed`, never a delete as a casual next step.

## Not this skill's job

Approving is not merging: when the user wants the branch merged — before or after the review —
hand off to the **`uvcs-merge`** skill; the preview, the mode and the check-in are its decisions.
Addressing comments is not reviewing either: when the user is the **author** ("fix the review",
"address these comments", "answer the reviewer"), that is **`uvcs-address-review`**.
