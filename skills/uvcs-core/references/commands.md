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
```

## Querying: `cm find`

`cm find` is the query tool for every UVCS object — branches, changesets, labels, shelves,
revisions, attributes, merges, reviews:

```
cm find branch "where owner='me' order by date desc limit 5" --format="{name} {date}" --nototal
cm find changeset "where branch='/main/task001'" --format="{changesetid} {owner} {comment}" --nototal
```

The query language has fixed clause order, per-object field names, distinct sort-field names, and
objects that reject `order by` entirely. **Before composing any non-trivial query, read
`find-queries.md`** — do not improvise from SQL or memory, and do not retry a failed query with
speculative syntax.

Listing changesets ("recent history", "the last N commits") is a **`cm find changeset`** query
with `order by changesetid desc limit N`. `cm log` only details one changeset (or a `--from`
range) and accepts neither branch specs nor a limit.

## Branches

See `branches-and-merge.md`.

```
cm branch create /main/task001 -c "short description"     # child of /main
cm switch /main/task001                                   # also accepts cs:, lb:, sh: specs
```

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
cm merge br:/main/task001                        # dry run: what the merge would do
cm merge br:/main/task001 --merge                # merge into the current branch
```

The dry run is read-only and lists the conflicts — run it first. A conflicted file otherwise
launches the configured merge tool, which blocks the command on a window no agent can drive.
Newer `cm` builds add `--conflict-markers` for a merge that never launches a tool.

## What changed

See `diff-and-patch.md` — including the `--integration` flag, which answers "what would land in
the parent if merged now", the GitHub-PR-style diff.

```
cm diff br:/main/task001 --format="{status} {path} {baserevid} {revid} {repository}"
cm patch br:/main/task001        # unified diff; also takes cs: and sh: specs
```

Never run `cm diff` on a bare workspace path or with no arguments — it launches the GUI diff tool
and returns nothing on stdout.

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

## Code reviews

The CLI cannot add inline comments.

```
cm codereview br:/main/task001 "Review title" --assignee=<user>
cm codereview -e <id> --status=Reviewed          # statuses: "Under review", "Reviewed", "Rework required"
cm find review "where assignee='me' and status='Under review'" --nototal
```
