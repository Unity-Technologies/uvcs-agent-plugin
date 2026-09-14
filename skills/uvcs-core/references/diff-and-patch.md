# Diff, patch, and revision extraction

Both commands take `br:`, `cs:`, and `sh:` specs. A branch spec diffs the branch against its
base; a changeset spec diffs one changeset against its parent; a shelve spec diffs the shelve
against the changeset it was taken from. Two specs (`cs:4100 cs:4207`) diff the second against
the first — the range form; `cm diff` also accepts `lb:` there.

## List changed files — `cm diff`

```
cm diff br:/main/task001 --format="{status} {path} {baserevid} {revid} {repository}"
```

- `{status}` is a single letter (`C` changed, `A` added, `D` deleted, `M` moved...).
- `{repository}` is the full `repo@server` owning each file — in workspaces with xlinks,
  changed files can belong to a sub-repo. Xlink mount-point directories themselves show
  `-1 -1` revids.
- Never run `cm diff` with a bare workspace path or no arguments: it launches the configured
  GUI diff tool and produces no stdout (exit 0), which reads as "no changes".

## Unified text patch — `cm patch`

```
cm patch br:/main/task001          # emits `diff -rauN --binary` unified output
cm patch cs:42
cm patch cs:40 cs:45               # everything between two changesets
cm patch sh:12
```

Requires GNU `diff` on PATH; if it fails with "Diff not found", ask the user to install
diffutils (Windows: `choco install -y diffutils`), or fall back to per-file `cm cat` + local
diff using the revids from `cm diff --format`.

### Capture to a file, then read the whole file

Patch output can contain binary-ish content and odd line terminators that garble a console and
read as empty. Always redirect to a temp file with stderr merged, then read that file:

```bash
cm patch "br:/main/task001" > /tmp/branch.patch 2>&1
```

If the file is empty, check the exit status — an error is not "no changes". When reasoning
about the patch content, read it **completely** (in sequential chunks if large). Never sample
it with grep/head/tail and reason from the sample: that silently drops everything past the
cutoff.

Known failure modes that produce an empty/aborted patch:
- `Error: diff: a/<path>: No such file or directory` — a dangling symlink in the branch's file
  set aborts the whole patch. Fall back to per-file `cm cat` + local diff for the paths you
  care about.
- `Unable to read data from the transport connection` — server timeout on a big branch. Retry
  or patch per changeset (`cm patch cs:<id>`).
- Non-ASCII glyphs (arrows, check marks) may render as blanks in patch output; the underlying
  file is fine — cross-check with `cm cat` before flagging content issues.

## `--integration` — exclude merge noise (branch specs only)

A branch that merged from its parent shows the parent's changes mixed into its plain diff.
`--integration` (valid on both `cm diff` and `cm patch`) computes the true common ancestor and
shows only what is **pending to integrate into the parent** — the same as the GUI's "show
pending to integrate", and the closest equivalent to a GitHub PR diff. Use it when the question
is "what would land in the parent if this merged now" (code review, release notes).

```
cm diff br:/main/task001 --integration --format="{status} {path}"
cm patch br:/main/task001 --integration
```

Caveats (verified):
- **On an already-merged branch it returns an empty patch** — nothing is pending. If an
  `--integration` patch is empty, re-run without the flag before concluding anything.
- It is accepted but a **no-op on `cs:` and `sh:` specs** — only meaningful with `br:`.
- Noticeably slower on large branches (ancestor calculation).
- Do **not** add `--clean`: it filters by provenance and drops content that arrived via any
  merge — on a branch that aggregates sub-task branches it hides most of the real work.

## Extracting file revisions — `cm cat` / `cm getfile`

Same command, two names. Without `--file` the content goes to stdout.

```
cm cat "serverpath:/src/Player.cs#br:/main/task001"            # head of a branch
cm cat "serverpath:/src/Player.cs#cs:42"                       # at a changeset
cm cat "revid:<id>@rep:<repo>@repserver:<server>" --file=/tmp/f.cs
```

Typical review flow without `cm patch`: get `{baserevid} {revid} {repository}` per file from
`cm diff --format`, `cm cat` both sides, diff locally. The `{repository}` column is the
`repo@server` form — split on the first `@` to build the `rep:` / `repserver:` halves of a
`revid:` spec (revids are per-repository; qualify them when crossing xlinks).

## Xlinks and patches

`cm diff` lists changes across all repos from anywhere in the workspace, but `cm patch` covers
the repo of the workspace directory it runs from. If `{repository}` shows files in a sub-repo,
run `cm patch` again from inside that xlink directory to get their text diff.
