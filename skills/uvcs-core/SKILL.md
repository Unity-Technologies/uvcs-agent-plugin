---
name: uvcs-core
description: >-
  Core knowledge for Unity Version Control (UVCS, formerly Plastic SCM) and its cm command line:
  how UVCS concepts differ from git, object specs (br:, cs:, lb:, sh:, serverpath:), which cm
  command answers which question, read-only vs mutating vs irreversible commands, how to name
  UVCS objects and build deep links (plastic://, or unityhub:// when the workspace is a Unity
  project) when reporting results, and curated cm recipes for status, find queries, diff and
  patch, history, branches, checkin, shelves, merge requests and code reviews. Use whenever composing or running any cm command, or when the user mentions UVCS,
  Unity Version Control, Plastic SCM, cm, changeset, cset, workspace, selector, branch, label,
  shelve, shelveset, checkin, annotate, merge request, MR, pull request, PR, code review,
  reviewer, xlink, plastic:// or unityhub:// links. Every UVCS workflow skill builds on this one —
  load it first.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# UVCS core

`cm` is the UVCS command line. This is **not git**: commands, concepts, and grammar differ.
Never fall back to git commands or git assumptions in a UVCS workspace.

Verified against `cm` 11.0.16. Anything version-sensitive is marked.

## First steps

1. Check the CLI is available: `cm version`. If missing, stop and tell the user to install the
   Unity Version Control client (it ships `cm`) — do not improvise with git.
2. Check where you are: `cm status --header` prints the workspace's current
   `branch@repo@server` and head changeset, the branch as its **full path**:

   ```
   /main/task055@mygame@myorg@cloud (cs:4207 - head)
   ```

   If the current directory is not inside a workspace it errors (`<path> is not in a
   workspace.`) — server-side queries (`cm find`, `cm log`) still work from anywhere.
3. Identify the user when needed: `cm whoami`.

## Concepts — UVCS vs git

| UVCS term | Closest git idea | Key differences |
|---|---|---|
| Repository | remote repo | Lives on the server, addressed `repo@server` (e.g. `mygame@myorg@cloud`). No local repo. |
| Workspace | working tree / clone | Local directory mapped to a repo. No staging area, no local commits: checkin goes straight to the server. Several on the same repo are normal, each with its own selector and pending changes. |
| Selector | HEAD | What the workspace points to: a branch, changeset, label, or shelve. Change with `cm switch`. |
| Changeset (cset) | commit | Immutable snapshot with per-repo integer id (`cs:42`) and a GUID. Belongs to exactly **one** branch. |
| Revision | blob | One file's content at one changeset, addressable by `revid`. |
| Branch | branch | A first-class server object with owner, comment, attributes — not a moving pointer. Hierarchical names: `/main`, `/main/task001`, `/main/task001/fix2`. |
| Checkout | (none) | Marking a file "I'm editing this" (`cm checkout`). **Not** git checkout — switching is `cm switch`. Most workflows edit without checkout; the file then shows as *Changed*. |
| Shelve (shelveset) | stash | Server-side, has an integer id (`sh:12`), shareable, not attached to a branch's history. |
| Label | tag | First-class object attached to one changeset. |
| Attribute | (none) | Typed key/value metadata settable on branches, changesets, labels (e.g. `status=RESOLVED`). |
| Xlink | submodule | Directory link mounting another repo at a specific changeset inside the parent repo. |
| Merge request (MR) | pull request | Server object proposing a merge of a source branch into a destination branch, with reviewers and a comment thread. Same object as a code review, plus the merge proposal. |
| Code review | PR review | Reviewers, statuses, and inline/conversation comments on a **changeset or shelve**. For a branch, the merge request is the workflow. |
| Merge | merge | Creates a merge changeset on the destination branch. There is **no rebase command** (see `references/branches-and-merge.md`). |

There is no `cm worktree`, and none is needed: with no local repository to share, a second working
copy — for a parallel task, or an agent per branch — is just another workspace on the same repo,
deleted when done. Invocations and the delete gotcha: `references/commands.md`.

## Object specs

Most commands take object specs, not bare names. `cm help objectspec` is the authoritative list.

| Prefix | Object | Example |
|---|---|---|
| `br:` | branch | `br:/main/task001` — always the full path from `/main` |
| `cs:` | changeset | `cs:42`, or by GUID |
| `lb:` | label | `lb:v1.2.0` |
| `sh:` | shelve | `sh:12` (ids are positive in the CLI) |
| `att:` | attribute name | `att:status` |
| `serverpath:` | file at a path | `serverpath:/src/Player.cs#br:/main/task001` — without `#br:`/`#cs:` it resolves against the current selector |
| `revid:` | one file revision | `revid:1234@rep:mygame@repserver:myorg@cloud` |
| `rep:` / `repo@server` | repository | `rep:mygame@repserver:myorg@cloud`, short form `mygame@myorg@cloud` |
| `repserver:` | server | `repserver:myorg@cloud` |

## Finding the right command

Two traps make guessing expensive here, so route the question before composing a command:

- **Most specialized commands only *act*.** `cm branch` creates, renames and deletes branches but
  cannot list them; `cm attribute` sets values but cannot read them; `cm log` details changesets
  you already name — no branch spec, no `--limit` — and cannot list a branch's. **`cm find` is the query tool** for branches,
  changesets, labels, shelves, revisions, attributes, merges and reviews.
  Anything shaped like "which / list / show me all" is a `cm find` query, and its shape is always
  **object first, then a quoted clause** — never one quoted string:

  ```
  cm find <object> "where <field>='<value>' order by <field> desc limit <n>" --format="..." --nototal
  cm find attribute "where srcobj='br:/main/task001'" --nototal
  ```

  Field names, sort names, and which objects reject `order by` are per-object:
  `references/find-queries.md` before composing anything non-trivial.
- **The grammar is not uniform across subcommands.** A flag valid for one verb is often rejected
  by another (`--nototal` is `cm find`-only; `--format` field names differ per command). Do not
  generalize syntax between verbs.

So: take the invocation from `references/commands.md` (curated, verified) or from help, never from
memory, and do not retry a failed command with speculative syntax. When no recipe covers it:

- `cm showcommands --all` — every command with a one-line description.
- `cm help <command>` (or `cm <command> --help`) — full syntax; `cm <command> --usage` — terse.
- `cm showfindobjects` — every queryable object and its fields (for `cm find`).

## Read-only vs mutating

Read-only — no effect on the repository or workspace:
`status`, `find`, `log`, `history`, `annotate`, `diff`, `patch` (generating), `cat`/`getfile`,
`ls`, `fileinfo`, `whoami`, `version`, `showcommands`, `help`, `showfindobjects`,
`getworkspacefrompath`/`gwp`, `workspace list`, `lock list`.

Mutating — they change the workspace or the server-side repository:
`add`, `checkin`/`ci`, `checkout`/`co`, `switch`, `update`, `move`, `remove`, `branch`,
`label`, `attribute`, `shelveset`, `merge`, `undo`, `undochange`, `undocheckout`, `revert`,
`undelete`, `changeset`, `codereview`, `mergerequest`/`mr`, `xlink`, `patch --apply`,
`workspace create` / `workspace delete` (client-side: no server object is created or destroyed).
`cm mergerequest`/`cm codereview` mutate even when they only add a comment or a reviewer — those
are visible to everyone on the review. Their one read-only verb is `reviewer list`.

Irreversible — no `cm` command can recover what these discard:
`undo` / `undochange` / `undocheckout` (uncommitted work), `branch delete`, `label delete`,
`shelveset delete`, `codereview -d` / `mergerequest delete` (the review and its whole comment
thread), `mergerequest <id> comment delete`.

When and whether to confirm a mutating command with the user is workflow policy, owned by the
higher-level skill (or agent) driving the task — not by this skill.

## Reporting UVCS objects

Results must round-trip: every object named in a report should paste back into `cm` or click open.

- **Name objects the way `cm` does**: `cs:4207`, `br:/main/task001`,
  `lb:v1.2.0`, `sh:12`. Always the **full** branch path — `task001` alone is not an identifier.
- **Changeset ids are per-repository** integers, not global hashes. When more than one repo is in
  play (xlinks), qualify the id with its repo or the number is ambiguous.
- **Make objects clickable when the repo and server are known** (`cm status --header`, or
  `{repository}` in `cm diff` output): one markdown link per object, `unityhub://` in a Unity
  project (`Assets/` + `ProjectSettings/`) and `plastic://` anywhere else. Shapes, rendering and
  encoding: `references/deep-links.md`.
- **Report only what command output shows.** Never fill in a changeset id, branch name, author or
  date from inference — if a command did not print it, say it is unknown and name the command
  that would answer it.

## UVCS workflow skills

Higher-level skills own the judgement and the order of operations for one task, and use this
skill for every `cm` invocation. **When one covers the task at hand, load and follow it — do not
drive that task from this skill alone.** The syntax here is enough to compose the commands and
not enough to get the order and the stopping points right, which is where the damage happens.

| Skill | Use it for |
|---|---|
| `uvcs-merge` | Any merge, cherry-pick or conflict resolution, including finishing a merge already in progress. Never run `cm merge --merge` without it; its first command is always the read-only preview, `cm merge <src>` with no `--merge`. |
| `uvcs-switch` | Moving the workspace to another branch, changeset, label or shelve, creating the branch first if needed. Never `cm switch` a workspace with pending changes without it. |
| `uvcs-root-cause` | "Why did this break / which changeset introduced it / who broke this line": tracing a bug or regression back through history. Read-only. |
| `uvcs-code-review` | Reviewing a branch or merge request, a changeset, a shelve or pending changes, and publishing the findings as review comments. |
| `uvcs-address-review` | The author side of a review: applying the change requests a reviewer left, answering questions, discarding a request, re-requesting the review. |
| `uvcs-report-issue` | Something in **this plugin** was wrong or missing — a recipe `cm` rejected, a fact `cm help` contradicts, a task no skill covers, a result the user says is not what they asked for — reported as a GitHub issue. Not for UVCS product problems. |

For any task these do not cover, this skill plus judgement is the whole toolkit.

## Cross-cutting gotchas

- **Empty output is not proof of "no changes".** Check the exit status and stderr. Capture
  `cm patch` output to a temp file (stderr merged) and read the file — see
  `references/diff-and-patch.md` for the capture and full-ingestion rules.
- **Never run `cm diff` on a bare workspace path or with no arguments**, and never `cm merge` a
  conflicted file without a headless mode: both launch a GUI window, return nothing on stdout,
  and block the command until a human closes it.
- **Comments with shell-special characters**: on PowerShell, backticks inside `-c "..."` are
  silently eaten; in Git Bash on Windows, MSYS rewrites `/main/...` positional args into
  Windows paths. Fixes and safe patterns: `references/shell-gotchas.md`. When a comment is
  generated programmatically, prefer `-commentsfile=<path>` over `-c`.
- **Permission error on checkin** (`You don't have ci permission on ...`): most often the
  workspace is on a protected branch like `/main`. Run `cm status --header`, switch to a task
  branch, retry — before assuming a real ACL problem.
- **Xlinked sub-repos**: `cm diff` reports the owning repo per file in `{repository}`; when it
  is not the primary repo, run content commands (`cm patch`) from inside the xlink directory,
  and add `on repository '<repo>@<server>'` inside `cm find` query strings (see
  `references/find-queries.md`).
- **Many read-only commands, all known up front** (5 or more): one `cm shell` batch is ~3× faster
  than one process each, but it changes the exit-code and error-stream contract. Follow
  `references/batching-commands.md` exactly or run them plainly. Never batch a mutating command.
- **A recipe from this skill that `cm` rejects is a defect in this plugin, not in UVCS.** Take
  the syntax from `cm help <command>`, finish the task, then ask the user once, in these words:
  "That recipe is a bug in this plugin — want me to report it with `uvcs-report-issue`?" Likewise
  for a task no recipe or skill covers.

## References — read when the task needs them

| File | Read it when |
|---|---|
| `references/commands.md` | Running anything beyond the orientation commands above: the verified invocation for status, workspaces, branches, checkin, shelves, merge, diff, cat, history, labels, attributes, reviews. |
| `references/reviews-and-merge-requests.md` | Anything touching a merge request or a code review: creating one, reviewers, statuses, inline and conversation comments, reading the thread. |
| `references/find-queries.md` | Composing any `cm find` query: objects, fields, sort names, date constants, limits. |
| `references/status-and-checkin.md` | Parsing `cm status`, checkin/checkout/undo semantics, ignore/hidden/cloaked conf files. |
| `references/diff-and-patch.md` | Listing changed files, unified patches, `--integration`, extracting revisions, failure modes. |
| `references/branches-and-merge.md` | Branch/shelve/label lifecycle details, switch semantics, merge and cherry-pick, no-rebase note. |
| `references/merge-conflict-markers.md` | Resolving a conflicted merge headlessly: `--conflict-markers`, exit codes, marker format, the check-in guard. |
| `references/history-and-annotate.md` | File history, blame tokens, `cm log` formats, walking `/main` history. |
| `references/shell-gotchas.md` | Running `cm` from PowerShell / Git Bash / POSIX shells; quoting and comment pitfalls. |
| `references/batching-commands.md` | Running 5+ read-only commands as one `cm shell` batch: when it pays, the restrictions, and the exit-code and error-stream contract that changes. |
| `references/deep-links.md` | Building a clickable link to a branch, changeset, label, shelve, code review or merge request: `unityhub://` in a Unity project, `plastic://` everywhere else, rendered as a markdown link. |
