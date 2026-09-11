---
name: uvcs-cli-reference
description: >-
  Reference for the cm command line of Unity Version Control (UVCS, formerly Plastic SCM):
  core concepts and how they differ from git, object specs (br:, cs:, lb:, sh:), SQL-like
  cm find queries, machine-readable output (--format, --machinereadable), branch / checkin /
  shelve / diff / patch / history / annotate recipes, and shell quoting gotchas. Use whenever
  composing or running any cm command, or when the user mentions UVCS, Unity Version Control,
  Plastic SCM, cm, changeset, cset, workspace, selector, branch, merge, label, shelve,
  shelveset, checkin, code review, xlink, or plastic:// links. Higher-level UVCS workflow
  skills build on this one — load it before running cm.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# UVCS `cm` CLI reference

`cm` is the UVCS command line. This is **not git**: commands, concepts, and grammar differ.
Never fall back to git commands or git assumptions in a UVCS workspace.

Verified against `cm` 11.0.16. Anything version-sensitive is marked.

## First steps

1. Check the CLI is available: `cm version`. If missing, stop and tell the user to install the
   Unity Version Control client (it ships `cm`) — do not improvise with git.
2. Check where you are: `cm status --header` prints the workspace's current
   `branch@repo@server` and head changeset. If the current directory is not inside a workspace
   it errors — server-side queries (`cm find`, `cm log`) still work from anywhere.
3. Identify the user when needed: `cm whoami`.

## Concepts — UVCS vs git

| UVCS term | Closest git idea | Key differences |
|---|---|---|
| Repository | remote repo | Lives on the server, addressed `repo@server` (e.g. `mygame@myorg@cloud`). No local repo. |
| Workspace | working tree / clone | Local directory mapped to a repo. No staging area, no local commits: checkin goes straight to the server. |
| Selector | HEAD | What the workspace points to: a branch, changeset, label, or shelve. Change with `cm switch`. |
| Changeset (cset) | commit | Immutable snapshot with per-repo integer id (`cs:42`) and a GUID. Belongs to exactly **one** branch. |
| Revision | blob | One file's content at one changeset, addressable by `revid`. |
| Branch | branch | A first-class server object with owner, comment, attributes — not a moving pointer. Hierarchical names: `/main`, `/main/task001`, `/main/task001/fix2`. |
| Checkout | (none) | Marking a file "I'm editing this" (`cm checkout`). **Not** git checkout — switching is `cm switch`. Most workflows edit without checkout; the file then shows as *Changed*. |
| Shelve (shelveset) | stash | Server-side, has an integer id (`sh:12`), shareable, not attached to a branch's history. |
| Label | tag | First-class object attached to one changeset. |
| Attribute | (none) | Typed key/value metadata settable on branches, changesets, labels (e.g. `status=RESOLVED`). |
| Xlink | submodule | Directory link mounting another repo at a specific changeset inside the parent repo. |
| Merge | merge | Creates a merge changeset on the destination branch. There is **no rebase command** (see `references/branches-and-merge.md`). |

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

## Discovering commands

The full catalog is one command away — prefer checking help over guessing flags:

- `cm showcommands --all` — every command with a one-line description.
- `cm help <command>` (or `cm <command> --help`) — full syntax; `cm <command> --usage` — terse.
- `cm showfindobjects` — every queryable object and its fields (for `cm find`).

`cm`'s grammar is **not uniform across subcommands**: a flag valid for one is often rejected by
another (`--nototal` is `cm find`-only; `--format` field names differ per command). Do not
generalize syntax between verbs — check help or the references here.

## Read-only vs mutating

Read-only — no effect on the repository or workspace:
`status`, `find`, `log`, `history`, `annotate`, `diff`, `patch` (generating), `cat`/`getfile`,
`ls`, `fileinfo`, `whoami`, `version`, `showcommands`, `help`, `showfindobjects`,
`getworkspacefrompath`.

Mutating — they change the workspace or the server-side repository:
`add`, `checkin`/`ci`, `checkout`/`co`, `switch`, `update`, `move`, `remove`, `branch`,
`label`, `attribute`, `shelveset`, `merge`, `undo`, `undochange`, `undocheckout`, `revert`,
`undelete`, `changeset`, `codereview`, `xlink`, `patch --apply`.

Irreversible — no `cm` command can recover what these discard:
`undo` / `undochange` / `undocheckout` (uncommitted work), `branch delete`, `label delete`,
`shelveset delete`.

When and whether to confirm a mutating command with the user is workflow policy, owned by the
higher-level skill (or agent) driving the task — not by this reference.

## Querying: `cm find`

Most specialized commands only **act** (e.g. `cm branch` creates/renames/deletes branches but
cannot list them; `cm attribute` sets values but cannot read them). **`cm find` is the query
tool** for branches, changesets, labels, shelves, revisions, attributes, merges, and reviews:

```
cm find branch "where owner='me' order by date desc limit 5" --format="{name} {date}" --nototal
cm find changeset "where branch='/main/task001'" --format="{changesetid} {owner} {comment}" --nototal
```

The query language has fixed clause order, per-object field names, distinct sort-field names,
and objects that reject `order by` entirely. **Before composing any non-trivial query, read
`references/find-queries.md`** — do not improvise from SQL or memory, and do not retry a failed
query with speculative syntax.

## Everyday recipes

Full syntax, output formats, and gotchas for each area live in the references — read the
matching file before going beyond these exact invocations.

**Pending changes** (see `references/status-and-checkin.md` for change codes and parsing):

```
cm status --header                                                  # current branch + head cset
cm status --machinereadable --all --includeRevId --fieldseparator="|"
```

**Branches**:

```
cm branch create /main/task001 -c "short description"     # child of /main
cm switch /main/task001                                   # also accepts cs:, lb:, sh: specs
```

**Checkin**:

```
cm checkin <paths> -c "comment"        # explicit paths; no-path form is cwd-scoped!
cm checkin --all -c "comment"          # everything pending, from the workspace root
```

**Shelve** (`--all` is required to pick up files changed without checkout):

```
cm shelveset create --all -c "WIP: description"
cm shelveset apply sh:<id> --preview          # then: cm shelveset apply sh:<id>
```

**Merge** (see `references/branches-and-merge.md`):

```
cm merge br:/main/task001                        # dry run: what the merge would do
cm merge br:/main/task001 --merge                # merge into the current branch
```

The dry run is read-only and lists the conflicts — run it first. A conflicted file otherwise
launches the configured merge tool, which blocks the command on a window no agent can drive.
Newer `cm` builds add `--conflict-markers` for a merge that never launches a tool — read
`references/merge-conflict-markers.md` before merging anything that may conflict.

**What changed** (see `references/diff-and-patch.md` — including the `--integration` flag,
which answers "what would land in the parent if merged now", the GitHub-PR-style diff):

```
cm diff br:/main/task001 --format="{status} {path} {baserevid} {revid} {repository}"
cm patch br:/main/task001        # unified diff; also takes cs: and sh: specs
```

Never run `cm diff` on a bare workspace path or with no arguments — it launches the GUI diff
tool and returns nothing on stdout.

**File content at any point in history** (`cm cat` and `cm getfile` are the same command):

```
cm cat "serverpath:/src/Player.cs#br:/main/task001"
cm cat "revid:<id>@rep:<repo>@repserver:<server>" --file=/tmp/base.cs
```

**History and blame** (see `references/history-and-annotate.md` for format tokens):

```
cm history /path/file.cs --format="{changesetid} {branch} {owner} {date}"
cm annotate /path/file.cs --format="{changeset}|{owner}|{content}"   # note: {changeset}, not {changesetid}
cm log cs:42 --csformat="{changesetid};{branch};{owner};{comment}"
```

Listing changesets ("recent history", "last N commits") is a **`cm find changeset`** query with
`order by changesetid desc limit N` — `cm log` only details one changeset (or a `--from` range)
and accepts neither branch specs nor a limit.

**Labels and attributes**:

```
cm label create lb:v1.2.0 cs:42 -c "release 1.2.0"
cm find label "where name like 'v1.%' order by date desc limit 10" --format="{name} {changeset}" --nototal
cm attribute set att:status br:/main/task001 RESOLVED
cm find attribute "where srcobj='br:/main/task001'"        # reading = cm find, never cm attribute
```

**Code reviews** (the CLI cannot add inline comments):

```
cm codereview br:/main/task001 "Review title" --assignee=<user>
cm codereview -e <id> --status=Reviewed          # statuses: "Under review", "Reviewed", "Rework required"
cm find review "where assignee='me' and status='Under review'" --nototal
```

## Cross-cutting gotchas

- **Empty output is not proof of "no changes".** Check the exit status and stderr. Capture
  `cm patch` output to a temp file (stderr merged) and read the file — see
  `references/diff-and-patch.md` for the capture and full-ingestion rules.
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

## References — read when the task needs them

| File | Read it when |
|---|---|
| `references/find-queries.md` | Composing any `cm find` query: objects, fields, sort names, date constants, limits. |
| `references/status-and-checkin.md` | Parsing `cm status`, checkin/checkout/undo semantics, ignore/hidden/cloaked conf files. |
| `references/diff-and-patch.md` | Listing changed files, unified patches, `--integration`, extracting revisions, failure modes. |
| `references/branches-and-merge.md` | Branch/shelve/label lifecycle details, switch semantics, merge and cherry-pick, no-rebase note. |
| `references/merge-conflict-markers.md` | Resolving a conflicted merge headlessly: `--conflict-markers`, exit codes, marker format, the check-in guard. |
| `references/history-and-annotate.md` | File history, blame tokens, `cm log` formats, walking `/main` history. |
| `references/shell-gotchas.md` | Running `cm` from PowerShell / Git Bash / POSIX shells; quoting and comment pitfalls. |
| `references/plastic-links.md` | Building `plastic://` deep links to branches, changesets, labels, shelves, code reviews. |
