# Status, checkin, and undo

## Reading pending changes

```
cm status --header        # one line: branch@repo@server (cs:<head> - head)
cm status                 # human-readable pending changes
cm status --machinereadable --all --includeRevId --fieldseparator="|"
```

Machine-readable output shape:

```
STATUS|<workspace head changeset>|<repo>|<server>
<CODE>|<workspace path>|<is_dir>|<base_revid>|...
```

Change codes: `CH` changed (edited without checkout — the common case), `CO` checked-out,
`AD` added, `DE` deleted, `MV` moved, `CP` copied, `RP` replaced, `PR` private (uncontrolled),
`IG` ignored. `cm help status` lists the full set and the matching `--<type>` filter flags.

`--all` expands to `--controlledchanged --changed --localdeleted --localmoved --private`.

## Diffing pending changes as text

Do **not** run `cm diff <path>` — it opens the GUI diff tool. To compare a locally modified
file against its base revision:

1. Get `<base_revid>` and `<repo>@<server>` from the machine-readable status line.
2. `cm cat "revid:<base_revid>@rep:<repo>@repserver:<server>" --file=<tmp>`
3. Compare `<tmp>` with the workspace file using a local diff tool.

## Checkin

```
cm checkin <path1> <path2> -c "comment"
cm checkin --all -c "comment"              # entire pending set, any cwd
cm checkin --all --private -c "comment"    # also add untracked files
cm checkin <paths> -commentsfile=<file>    # comment from a file (avoids shell quoting)
```

Gotchas, all verified:

- **The no-path form is scoped to the current working directory**, not the workspace. From the
  workspace root it can report `There are no changes in the workspace` while `cm status` lists
  changes in subdirectories. Pass explicit paths or `--all`.
- **`CH` files bundled with a `DE` (removed) item in one checkin** can be mis-detected as
  unchanged: with explicit paths the checkin aborts (`The item ... is not changed`); with the
  cwd form it may silently commit **only the deletion**. Fix: `cm checkout <files>` the
  modified files first (turning `CH` into `CO`), then check in everything together. If a
  checkin misbehaves, stop and fix the cause — do not fragment one logical change across
  changesets.
- **Checkin refused because conflict markers are pending** (`... file(s) merged with conflict
  markers still contain them`): a merge run with `--conflict-markers` left markers in those
  files. Remove them, or `cm merge --mark-resolved <path>` when the marker text is intentional
  — see `merge-conflict-markers.md`.
- Multi-line comments: `-c "line1\nline2"` or `-commentsfile`. To rewrite a changeset comment
  afterwards: `cm changeset editcomment cs:<id> "<new comment>"` (branch comments and review
  titles have **no** edit command — get them right at creation).

## Checkout

`cm checkout <paths>` marks files as being edited (`CO`). Only required by lock/exclusive-
checkout workflows or the `CH`+`DE` fix above; plain edits are picked up as `CH` without it.

## Undoing local changes

All of these discard uncommitted work irreversibly — no `cm` command recovers it (shelving
before undoing is the only preservation mechanism).

| Command | Reverts | Notes |
|---|---|---|
| `cm undochange <paths>` (`unc`) | `CH` files | No-op on `CO`-only files. |
| `cm undocheckout <paths>` (`unco`) | `CO` files | Silently no-op on plain `CH` files. |
| `cm undocheckout --keepchanges <paths>` | the checkout only | Keeps on-disk edits; `CO` becomes `CH`. |
| `cm undocheckout -a <paths>` | checkouts **and** local edits | |
| `cm undo <paths>` | any pending change on the paths | Broadest form; `-r` recurses. |

All accept `.` and `-r`/`--recursive`. The commands are state-specific (`CH` vs `CO`), so run
`cm status` first to know which one applies to each file.

## Ignore / hidden / cloaked conf files

Three workspace-root conf files control visibility. There is no `cm ignore`-style command —
edit the files:

| File | Affects | Effect |
|---|---|---|
| `ignore.conf` | uncontrolled paths | Excluded from pending changes (like `.gitignore`). Rules: bare names (`obj`), repo paths (`/bin`), `*` wildcards (`*.log`). |
| `hidden_changes.conf` | controlled files | Modified files kept out of the default pending list (long-lived local tweaks). Reveal with `cm status --hiddenchanged`. **`--all` does NOT include them** — add the flag explicitly. |
| `cloaked.conf` | controlled paths | Excluded from updates and status entirely. Check with `cm status --cloaked`. |

If expected files are missing from `cm status`, check `--ignored`, `--hiddenchanged`, and
`--cloaked` before concluding they are unchanged. A rule in `ignore.conf` never affects a file
that is already under version control.
