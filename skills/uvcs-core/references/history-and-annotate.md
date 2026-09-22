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

Both list the item's revisions on **every branch**, in changeset-id order — including branches
that were never merged into the one the workspace is on. A row's neighbour is not its parent.

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
cm annotate <path> --format="{line} {changeset} {branch} {owner} {ismergerev} {content}"
cm annotate "<path>#cs:<N>"               # the file as it was at changeset N
```

- The changeset token here is **`{changeset}`**, not `{changesetid}` (which `cm find` uses).
  `{branch}` prints **with** the `br:` prefix, where `cm find changeset`'s `{branch}` does not.
- `{ismergerev}` is `Yes` / `No`: `Yes` means the line arrived on this branch through a merge,
  not through an edit made here.
- `{changeset}` is **`-1`** (and `{rev}` prints `local`) on lines with uncommitted local changes —
  a pending edit in the workspace, not a historical change.
- `<path>#cs:<N>` annotates the file as of **any** changeset, not only the ones that touched it.
- Fast way to find which changeset introduced a line: annotate with
  `--format="{changeset}|{owner}|{content}"`, locate the line, then
  `cm find changeset "where changesetid=<id>" --format="{branch} {guid} {comment}" --nototal`
  for the introducing branch and comment.
- Annotating is comparatively slow on big files — reach for it when per-line attribution is
  actually needed, not for "when did this file last change" (use `cm history` or
  `cm find revision`).

## Previous version: the state before a changeset

```
cm find changeset "where changesetid=<N>" --format="{parent}" --nototal
cm annotate "<path>#cs:<parent>"                           # the file just before cs:<N>
cm cat "serverpath:/<path in repo>#cs:<parent>"            # its content
```

- **"State before changeset `<N>`" is the file at `<N>`'s parent changeset**, whether or not the
  parent touched the file. Never derive it from the file's history — the row before `<N>` in
  `cm history`, or the highest `changeset < <N>` in `cm find revision`, can be a revision on
  another branch (see above).
- A merge changeset's `{parent}` is the previous changeset on the **destination** branch, so this
  gives the state before the merge landed.
- `cm find revision`'s `item` is resolved **through the workspace**: pass the path as it exists
  locally (absolute or relative to the current directory). A server path matches nothing, and
  `like` is rejected on `item` (it is an integer field that accepts a path as a convenience).

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
