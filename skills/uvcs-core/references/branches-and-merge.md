# Branches, switch, shelves, labels, merge

## Branches

```
cm branch create /main/task001 -c "short description"      # child of /main, from its head
cm branch create /main/task001 --changeset=<id> -c "..."   # from a specific base changeset
cm branch create /main/task001/fix2 -c "..."               # nested child branch
cm branch rename br:/main/task001 task001-old
cm branch delete br:/main/task001                          # IRREVERSIBLE; non-empty branches
                                                           # need --delete-changesets
```

- Branch paths are absolute and include `/main`: `/main/task001`, `/main/release/hotfix1`.
- `cm branch` cannot list branches or read their metadata — use `cm find branch` (see
  `find-queries.md`).
- Branch comments cannot be edited after creation.

## Switch — moving the workspace selector

```
cm switch /main/task001      # branch (most common)
cm switch cs:42              # changeset — detached; checkin not possible
cm switch lb:v1.2.0          # label — same detached behavior
cm switch sh:12              # workspace tree becomes the shelve's contents
```

`cm switch sh:` vs `cm shelveset apply sh:`: switch **replaces** the workspace with the shelve;
apply keeps the current selector and layers the shelve's changes on top as pending changes.

`cm update` brings the workspace up to date with the head of its current selector.

### Switching with pending changes

What `cm switch` does when the workspace is dirty is **not fixed** — it is read from
`<PendingChangesOnSwitchAction>` in `client.conf`, which the GUIs write when the user enables
"switch and shelve". Unset means `None`.

| Value | `cm switch` with pending changes |
|---|---|
| `None` (default) | `CH` edits are carried onto the new branch — the file is left alone (`... has been changed in the workspace. Won't overwrite.`), exit 0, and its base is now a changeset it was never edited against. Any *controlled* change (`CO`, `AD`, `MV`, `DE`) instead fails, exit 1. |
| `Fail` | Always fails, exit 1: `Cannot perform the switch to branch/label/changeset/shelve since there are pending changes. Please review the pending changes and retry the operation again.` |
| `Warn` | Asks on stdin whether to continue. |
| `Shelve` | Asks on stdin: `Please enter your choice (s/b/c) [default is 'Cancel']:` — shelve, bring, or cancel. |

Both questions read stdin. **With no terminal the answer is the default and `cm` still exits 0**:
for `Shelve` that default is *Cancel*, so the workspace is untouched and nothing says the switch
did not happen. Never issue a bare `cm switch` without checking `cm status` first.

`--noinput` answers the question without a terminal: it shelves, undoes, switches, and then
applies the shelve back if it merges cleanly — but when the shelve conflicts it stops and prints
`You can manually apply the shelveset running the following command: cm shelveset apply sh:<id>`,
leaving the shelve behind. (`cm help switch` says `--noinput` disables bringing the changes; it
does not — verified against 11.0.16.) `--xml` forces the action to `Fail` regardless of the
configured value, so machine-readable output never has a prompt in it.

Driving this explicitly instead — shelve, undo, switch, and optionally merge the shelve back — is
the `uvcs-switch` workflow.

### Automatic shelves

The shelve the GUIs (and `--noinput`) create before a switch is an ordinary shelve marked by its
comment, which is how they recognize and overwrite it later:

```
Automatic shelve created during switch operation (from br:<branch id>)
```

`<branch id>` is the **internal object id** of the branch being left (`{id}` in `cm find branch`,
not the changeset or the path). `cs:<n>` / `lb:<id>` replace `br:<id>` when the workspace is
pinned to a changeset or a label instead. Matching this format keeps agent-made shelves legible
to the GUIs; any other comment is just a normal shelve.

```
cm find branch "where name='task001'" --format="{id}" --nototal          # the branch's id
cm find shelve "where owner='me' and comment='Automatic shelve created during switch operation (from br:21)'" \
    --format="{shelveid} {date}" --nototal                               # previous ones
```

## Shelves

```
cm shelveset create --all -c "WIP: description"            # --all required to include CH files
cm shelveset create <paths> --all -c "..."                 # subset of files
cm shelveset apply sh:12 --preview                         # list what would change (server paths)
cm shelveset apply sh:12                                   # apply everything
cm shelveset apply sh:12 /src/A.cs /src/B.cs               # apply selected files (server paths,
                                                           # as printed by --preview)
cm shelveset apply sh:12 --dontcheckout                    # applied files stay CH, not CO
cm shelveset delete sh:12                                  # IRREVERSIBLE; owner only
```

Without `--all`, `cm shelveset create` only picks up checked-out (`CO`) items and reports
"There are no changes in the workspace" even when `cm status` shows `CH` files.

Shelving does **not** clear the workspace — the shelved files stay pending (`CO`). Emptying it is
a separate, irreversible `cm undo`. Private files are never shelved and `cm undo` does not delete
them, so they survive both steps and follow the workspace onto the next branch; an `AD` file
that was shelved reverts to `PR` and stays on disk too.

`cm shelveset apply` is itself a forced merge from the shelve, so it hits the same conflicts
`cm merge` would — but it rejects `--conflict-markers`, leaving the configured merge tool (a GUI)
as its only conflict path. Where a shelve can collide with the workspace, `cm merge sh:<id>` is
the form with headless modes and a free preview.

Shelve ids are positive in the CLI and in `cm find shelve`. Internally a shelve is stored as a
negative changeset (`cs:-12`) — relevant only when reading raw API output or building GUI deep
links, never when typing `sh:` specs.

## Labels

```
cm label create lb:v1.2.0 cs:42 -c "release 1.2.0"
cm label create lb:v1.2.0 cs:42 -c "..." --allxlinkedrepositories   # label sub-repos too
cm label rename lb:v1.2.0 v1.2.1
cm label delete lb:v1.2.0                                  # IRREVERSIBLE
```

Listing/searching labels is `cm find label` (see `find-queries.md`).

## Attributes

```
cm attribute set att:status br:/main/task001 RESOLVED
cm attribute unset att:status br:/main/task001             # may require extra permissions;
                                                           # setting a different value is the
                                                           # portable alternative
```

`cm attribute` has no read form — query with
`cm find attribute "where srcobj='br:/main/task001'"` or filter branches with
`attribute='...' and attrvalue='...'`.

## Merge and cherry-pick

```
cm merge br:/main/task001 --merge                # merge that branch into the current one
cm merge br:/main/task001                        # dry run: prints what the merge would do
cm merge cs:42 --merge --cherrypicking           # cherry-pick a single changeset
```

- Merging creates a merge changeset on the **destination** (current) branch. Merge direction:
  you stand on the destination and pull from the source.
- Without `--merge` the command only previews.
- **`cm merge` refuses to run while the workspace has pending changes** (private files aside): it
  prints a recommendation to check in first, lists the pending changes, and exits 0 without
  merging — so check `cm status` rather than the exit code. Users who have set
  `<MergeWithPendingChanges>yes</MergeWithPendingChanges>` in `client.conf` do not see this.
- Merge history is queryable: `cm find merge "where srcbranch='br:/main/task001'"` (no
  `order by` support — see `find-queries.md`).
- File conflicts are otherwise handed to the configured merge tool (a GUI an agent cannot
  drive), or left with the merge in progress. The headless options are `--keepsource` /
  `--keepdestination` (take one contributor whole, per path or globally) and, on newer `cm`
  builds, `--conflict-markers` — see `merge-conflict-markers.md`.

### Reading the preview

`cm merge <src> --machinereadable` prefixes every line with a stable token. The ones that
decide what to do next:

| Line | Meaning |
|---|---|
| `STATUS NO_MERGES_DETECTED` | Nothing to merge (human text: `No merges detected`). |
| `FILE_CONFLICT <path> <baseCs> <srcCs> <dstCs> <itemId>` | Both contributors changed this file, so its content must be merged. |
| `ADD` / `RM` / `MV` / `CHG` `<path> ...` | Operation the merge will apply on its own. |
| `DIR_CONFLICT`, `EVIL`, `CHG_RM`, `RM_CHG`, `MV_RM`, `DIV_MV`, `CYCLE`, `ADD_MV`, `MV_ADD`, `TWICE`, `MV_EVIL`, `XLINK` | Directory-level conflicts, resolvable with `--automaticresolution=<type>-src\|-dst`. |

`FILE_CONFLICT` means "both sides touched it", **not** "this will conflict": most such files
merge automatically. Whether any region truly collides is only known once the merge runs. In
human output the same thing reads `The file <path> needs to be merged from <src> to <dst> base
<base>. Changed by <user>`.

## No rebase

There is **no rebase command**. The idiomatic ways to get up-to-date parent code into a task
branch:

1. Merge down: `cm merge br:/main --merge` while standing on the task branch (history keeps the
   merge changeset). This is the normal UVCS workflow.
2. True history rewrite does not exist; recreating a branch changeset-by-changeset with
   `cm merge cs:<id> --merge --cherrypicking` onto a fresh branch is possible but involved,
   and cleaning up afterwards requires irreversible deletes (`cm branch delete
   --delete-changesets`).
