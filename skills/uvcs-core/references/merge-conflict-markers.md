# Headless merge with conflict markers

`--conflict-markers` finishes a merge with no GUI and no external merge tool: every text file
conflict is merged in-process and the regions both contributors changed are written into the
workspace file surrounded by diff3 markers.

**Availability**: `cm` 11.0.16.10512 and newer; older clients do not have these flags. Probe
before relying on it (`cm merge --help` lists `--conflict-markers` only where
it exists); otherwise the flags fail as a usage error. Where it is missing, the headless
fallbacks are `--keepsource` / `--keepdestination`, which pick a whole contributor instead of
merging the text.

## What happens to a text conflict

| Invocation | Conflicted text file |
|---|---|
| `cm merge <src> --merge` | Launches the merge tool configured for that file type. The window opens on the user's desktop and the command blocks until it is closed — an agent cannot drive it, and killing the blocked process leaves the merge half-applied. |
| `cm merge <src> --merge --conflict-markers` | No tool is launched. Markers on disk, one line per file, exit 1. |

Writing markers does **not** oblige anyone to resolve them: it makes the merge stop cleanly and
visibly instead of blocking. Either way nothing is committed — a workspace merge stays pending
until `cm checkin` — so the marked state is recoverable with `cm undo`.

`cm merge <src>` without `--merge` is a read-only preview that lists the conflicts, so whether
a merge conflicts at all is knowable before touching the workspace.

## The three commands

| Command | Effect | Exit 0 | Exit 1 |
|---|---|---|---|
| `cm merge <source_spec> --merge --conflict-markers` | mutating | merge finished, nothing left to resolve | at least one file needs attention |
| `cm merge --list-conflict-markers` | read-only | no file has markers left | markers still pending |
| `cm merge --mark-resolved <path> [<path> ...]` | mutating (local marker list only) | entries dropped | error, naming the path |

Exit 1 means **"not finished"**, not "command failed". This 0/1 contract is specific to the
marker mode: plain `cm merge --merge` returns 0 even when it leaves the merge incomplete.

`--mark-resolved` and `--list-conflict-markers` reject every other merge option.
`--conflict-markers` combined with `--to`, `--destination` or `--shelve` is a usage error.

## Output lines

The marker merge and `--list-conflict-markers` print one prefixed, parseable line per pending
file. Paths are workspace-relative with a leading `/`:

```
CONFLICT_MARKERS <path>                       # markers written; resolve the file on disk
UNRESOLVED <path> (binary|symlink|recursive)  # markers impossible; choose a contributor
```

## Marker format

```
<<<<<<< destination: /src/Foo.cs@cs:57@/main (workspace)
    return Compute(x);
||||||| base: /src/Foo.cs@cs:50@/main (common ancestor, context only)
    return Calc(x);
=======
    return Compute(x, y);
>>>>>>> source: /src/Foo.cs@cs:58@/main/task001 (incoming)
```

- `destination` is the workspace / current branch, `source` is the incoming content, `base` is
  the common ancestor and is context only. A side that deleted the region gets an empty section.
- The separator is exactly `=======` (what editors match on), and marker lines take the end of
  line and the encoding of the file — CRLF and UTF-16 / UTF-8-BOM files survive unchanged.
- It is standard diff3, so any tool that reads that format resolves it.

## What does and does not get markers

- Only text files. Binary files, symlinks, and recursive merges whose intermediate merge has
  conflicts are reported `UNRESOLVED` and keep the merge in progress — a later `cm ci` then
  fails with the pre-existing merge-in-progress error, not the markers one.
- `--keepsource` / `--keepdestination` on such a path resolve it (they work on binaries) and are
  accepted while text markers are still pending elsewhere. Used **globally** they win over the
  markers: the contributor is taken, nothing is marked, exit code 0.
- `--mergetype=onlysrc|onlydst|onlyone` marks every region both contributors changed in a
  conflicting file, including regions that would have merged automatically.
- **No merge tool from `client.conf` is consulted**, UnityYAMLMerge and semanticmerge included —
  that is what guarantees no window can appear, and it trades semantic merge quality for a
  headless result. For `.unity` / `.prefab`, prefer `--keepsource` / `--keepdestination` per
  path. The restriction is on producing the merge only: once markers are on disk, any diff3
  tool can resolve them.
- Comparison follows `--comparisonmethod`, else the configured one (`mergetool.conf`, default
  ignores EOL and whitespace) — so a whitespace-only change on one side is not a conflict.
  `--comparisonmethod=recognizeall` shows every difference.

## Tracking and the check-in guard

Marked items are recorded in `.plastic/plastic.conflictmarkers`, per mount.

- `cm checkin` refuses while a marked file still contains markers and names the files
  (`Checkin operation cannot be started because N file(s) merged with conflict markers still
  contain them`). Nothing else about check-in changes.
- A **new** `cm merge` is refused while markers are pending, so an unresolved merge cannot be
  buried under the next one. The merge already in progress and the completed one are exempt, so
  a mixed text + binary merge does not deadlock.
- Nothing needs manual cleanup: every command that reads the pending list re-scans the files
  first and drops entries whose markers are gone. **Removing the markers is the whole job.** A
  deleted file has nothing left to resolve and does not block the check-in.
- `cm merge --mark-resolved <path>` drops an entry without looking at the content — for a file
  whose correct content legitimately contains marker text (a test fixture, a parser constant).
- Re-running the marker merge leaves already-marked files untouched, so in-progress edits are
  never clobbered.
- Files marked inside a writable xlink are tracked and reported too.
- `cm status` lists the pending files under "Files merged with conflict markers pending to
  resolve", and `cm status --machinereadable` emits `CONFLICT_MARKERS <path>` as a raw field.
  `cm status --xml` does **not** include them.
- `cm undocheckout <path>` drops the entries for the paths it undoes.
  `cm undocheckout --keepchanges` also drops them while the markers stay on disk: the undo ends
  the merge, so the marker text becomes ordinary local content and the check-in is no longer
  refused.
- `cm update` has no marker mode. Merge incoming changes with
  `cm merge cs:<head> --merge --conflict-markers` instead.

## The loop

```
cm merge br:/main/task001 --merge --conflict-markers    # exit 1 = there is work to do
# resolve every CONFLICT_MARKERS file; choose a side for every UNRESOLVED one
cm merge --list-conflict-markers                        # exit 0 = clean
cm checkin --all -c "merged /main/task001"
```
