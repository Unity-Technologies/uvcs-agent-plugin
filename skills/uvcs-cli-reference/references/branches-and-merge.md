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
- Merge history is queryable: `cm find merge "where srcbranch='br:/main/task001'"` (no
  `order by` support — see `find-queries.md`).
- File conflicts are otherwise handed to the configured merge tool (a GUI an agent cannot
  drive), or left with the merge in progress. The headless options are `--keepsource` /
  `--keepdestination` (take one contributor whole, per path or globally) and, on newer `cm`
  builds, `--conflict-markers` — see `merge-conflict-markers.md`.

## No rebase

There is **no rebase command**. The idiomatic ways to get up-to-date parent code into a task
branch:

1. Merge down: `cm merge br:/main --merge` while standing on the task branch (history keeps the
   merge changeset). This is the normal UVCS workflow.
2. True history rewrite does not exist; recreating a branch changeset-by-changeset with
   `cm merge cs:<id> --merge --cherrypicking` onto a fresh branch is possible but involved,
   and cleaning up afterwards requires irreversible deletes (`cm branch delete
   --delete-changesets`).
