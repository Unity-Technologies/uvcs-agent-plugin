# Everyday `cm` invocations

Curated, verified against `cm` 11.0.16 — not the full catalog. For a command not here, use
`cm showcommands --all` and `cm help <command>`; do not extrapolate flags from the recipes below,
`cm`'s grammar is not uniform across subcommands.

Each area has a reference with the output formats, tokens, and failure modes; read the matching
one before going beyond these exact invocations.

## Pending changes

See `status-and-checkin.md` for change codes and parsing.

```
cm status --header                                                  # current branch + head cset
cm status                                                           # pending changes
cm status --machinereadable --all --includeRevId --fieldseparator="|"
cm status --machinereadable --all --includeRevId --iscochanged --fieldseparator="|"
```

`--iscochanged` splits the machine-readable `CO` into `CO`/`CO+CH` (plain `cm status` always
says `Checked-out (changed)`) — use it to review or diff contents, not to drive a checkin.

## Workspaces — extra working copies

The UVCS answer to `git worktree`: another workspace on the same repo. Nothing is shared or
cloned, so one per parallel task (or per agent) is the normal way to work on several branches at
once.

```
cm workspace list --format="{wkname}|{path}"               # read-only; also {machine} {wkid} {wkspec}
cm workspace create <name> <path> <repo>@<server>          # mutating (client only)
cm switch /main/task001                                    # mutating; run inside the new workspace
cm update                                                  # mutating; downloads the content
cm workspace delete <path>                                 # mutating (client only) — see below
```

- A new workspace is **empty**: `cm status --header` shows `(cs:0 - head:<n>)` until `cm update`
  or `cm switch` downloads the tree. Each workspace holds its own full copy of the content —
  there is no shared object store as in a `git worktree`.
- `cm workspace delete` removes the `.plastic` metadata and the client's registry entry and
  **leaves every file on disk**, including pending changes — which then simply stop being tracked
  and cannot be recovered as changes. Check in or shelve first; delete the directory yourself
  afterwards.
- Workspaces cannot nest or share a path, and names are unique per client; all three cases fail
  with `The workspace <name> (<path>) already exists.`
- Locks are server-side (`cm lock list`, read-only), so under exclusive checkout rules two of your
  own workspaces contend with each other exactly like two people would.

## Querying: `cm find`

`cm find` is the query tool for every UVCS object — branches, changesets, labels, shelves,
revisions, attributes, merges, reviews:

```
cm find branch "where owner='me' order by date desc limit 5" --format="{name} {date}" --nototal
cm find changeset "where branch='/main/task001' order by changesetid desc limit 10" --format="{changesetid} {owner} {comment}" --nototal   # "recent history": cm log cannot list a branch
```

The query language has fixed clause order, per-object field names, distinct sort-field names, and
objects that reject `order by` entirely. **Before composing any non-trivial query, read
`find-queries.md`** — do not improvise from SQL or memory, and do not retry a failed query with
speculative syntax.

## Branches

See `branches-and-merge.md`.

```
cm branch create /main/task001 -c "short description"     # child of /main
cm switch /main/task001                                   # also accepts cs:, lb:, sh: specs
```

Check `cm status` first: on a workspace with pending changes `cm switch` may carry them over,
fail, or stop at a stdin prompt that defaults to *Cancel* and still exits 0 — see
`branches-and-merge.md`.

## Checkin

```
cm checkin <paths> -c "comment"        # explicit paths; no-path form is cwd-scoped!
cm checkin --all -c "comment"          # everything pending, from the workspace root
```

## Shelve

`--all` is required to pick up files changed without checkout.

```
cm shelveset create --all -c "WIP: description"
cm shelveset apply sh:<id> --preview          # then: cm shelveset apply sh:<id>
```

## Merge

The `uvcs-merge` skill owns the merge workflow; these are the invocations it runs. Details in
`branches-and-merge.md` (preview output tokens) and `merge-conflict-markers.md` (headless mode).

```
cm merge br:/main/task001                             # dry run (read-only): what the merge would do
cm merge br:/main/task001 --merge                     # merge into the current branch
cm merge br:/main/task001 --merge --conflict-markers  # same, but a content conflict writes diff3
                                                      # markers instead of opening a merge tool
```

Run the dry run first. Without `--conflict-markers` (newer than 11.0.16) a content conflict
launches the configured merge tool, a window no agent can drive: `merge-conflict-markers.md`.

## What changed

See `diff-and-patch.md` — including the `--integration` flag, which answers "what would land in
the parent if merged now", the GitHub-PR-style diff.

```
cm diff br:/main/task001 --format="{status} {path} {baserevid} {revid} {repository}"
cm patch br:/main/task001        # unified diff; also takes cs: and sh: specs
```

## File content at any point in history

`cm cat` and `cm getfile` are the same command.

```
cm cat "serverpath:/src/Player.cs#br:/main/task001"
cm cat "revid:<id>@rep:<repo>@repserver:<server>" --file=/tmp/base.cs
```

## History and blame

See `history-and-annotate.md` for format tokens.

```
cm history /path/file.cs --format="{changesetid} {branch} {owner} {date}"
cm annotate /path/file.cs --format="{changeset}|{owner}|{content}"   # note: {changeset}, not {changesetid}
cm log cs:42 --csformat="{changesetid};{branch};{owner};{comment}"
```

## Labels and attributes

```
cm label create lb:v1.2.0 cs:42 -c "release 1.2.0"
cm find label "where name like 'v1.%' order by date desc limit 10" --format="{name} {changeset}" --nototal
cm attribute set att:status br:/main/task001 RESOLVED
cm find attribute "where srcobj='br:/main/task001'"        # reading = cm find, never cm attribute
```

## Merge requests and code reviews

A merge request is the UVCS pull request: it proposes merging a branch into another one. Code
reviews cover changesets and shelves. Both carry reviewers and a comment thread, inline comments
included. **Read `reviews-and-merge-requests.md` before any of this** — the subcommand groups
have their own grammar, comments are addressed by GUID, and `--status` means a different field
on create than on edit. The `reviewer`, `review` and `comment` subcommands and `--users`/`--groups` are **newer
than 11.0.16** (that release has only `--assignee`); the reference says how to detect them.

```
cm mergerequest create br:/main/task001 "MR title" --destination=br:/main --users=<user>
cm mr review <id> --reviewed -c="LGTM"
cm mr comment add <id> -c="Rename this" --path=/src/Player.cs --line=42
cm codereview cs:4207 "Review title" --users=<user>      # changesets and shelves (sh:)
cm find mergerequest "where target='br:/main/task001'" --format="{id} {title}" --nototal
cm find changereviewcomment "where reviewid=<id>" --format="{guid} {type} {comment}" --nototal
```
