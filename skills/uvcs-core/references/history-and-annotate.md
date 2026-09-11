# History, log, and annotate

All read-only.

## File / directory history — `cm history`

```
cm history <path>
cm history <path> --format="{changesetid} {branch} {owner} {date}"
cm history <path> --long --limit=10
```

The path must exist in the workspace at its current location; for files that moved or were
deleted, query revisions instead: `cm find revision "where item='<repo path>'"`.

## Changeset details — `cm log`

```
cm log cs:42
cm log cs:42 --csformat="{changesetid};{branch};{owner};{comment}" --itemformat=""
cm log --from=cs:40 cs:45                 # a range of changesets
```

`--csformat` formats the changeset line; `--itemformat=""` suppresses the per-file lines —
useful for extracting a comment cleanly (e.g. to reuse via `-commentsfile`).

`cm log` takes a changeset or repository spec — **not** a branch spec — and has no `--limit`.
To list a branch's changesets, use `cm find changeset "where branch='...' order by changesetid
desc limit N"` (see below).

## Blame — `cm annotate`

```
cm annotate <path>
cm annotate <path> --format="{line} {changeset} {branch} {owner} {content}"
```

- The changeset token here is **`{changeset}`**, not `{changesetid}` (which `cm find` uses).
- Fast way to find which changeset introduced a line: annotate with
  `--format="{changeset}|{owner}|{content}"`, locate the line, then
  `cm find changeset "where changesetid=<id>" --format="{branch} {guid} {comment}" --nototal`
  for the introducing branch and comment.
- Annotating is comparatively slow on big files — reach for it when per-line attribution is
  actually needed, not for "when did this file last change" (use `cm history` or
  `cm find revision`).

## Walking a branch's history efficiently

```
# All changesets on a branch, oldest first
cm find changeset "where branch='/main/task001' order by changesetid asc" --format="{changesetid} {date} {owner} {comment}" --nototal

# Recent activity on /main — filter by comment pattern instead of walking parents
cm find changeset "where branch='/main' and comment like '%merged%' order by changesetid desc limit 30" --format="{changesetid} {date} {comment}" --nototal
```

A single filtered `cm find` runs in seconds regardless of repository size. Avoid loops that
follow `returnparent='true'` one changeset at a time — O(n) server round trips.

Changesets on `/main` with empty comments and no merge pattern are typically automated
(xlink pointer updates, maintenance) rather than task merges.
