---
name: uvcs-root-cause
description: >-
  Trace a bug, regression, crash or failing test back to the UVCS / Plastic SCM changeset that
  most likely introduced it: bound the history window, expand from the symptom file to what it
  depends on, rank only changesets with concrete evidence, and confirm the top suspect at line
  level with cm annotate. Read-only end to end. Use when the user asks why something broke, what
  changeset or cset broke it, which change introduced a bug, who broke a file or a line, when a
  feature last worked, how to bisect or blame a regression in UVCS, or hands you a stack trace,
  error message or failing test and wants the culprit changeset. Not for reviewing what a branch
  changed and not for performing a merge. All cm syntax comes from the uvcs-core skill — load it
  first.
compatibility: Requires the cm CLI (Unity Version Control client) on PATH
---

# Root cause analysis with `cm`

This skill owns the *decisions*: how far back to look, which files can plausibly be at fault, and
what counts as evidence. Every `cm` flag and output token it names belongs to the **`uvcs-core`**
skill — load it first, and read `uvcs-core/references/history-and-annotate.md` (annotate tokens,
state before a changeset) and `uvcs-core/references/find-queries.md` (date
constants, which objects accept `order by`) rather than guessing.

The failure mode this workflow exists to prevent is a confident wrong answer. History always
offers *some* recent changeset to blame, so the work is in bounding the search and refusing to
name a changeset you cannot connect to the symptom.

## 1. Capture the symptom, bound the window

```
cm status --header          # current branch@repo@server and head changeset — the upper bound
```

Extract three things from the user's report: **what is broken**, **which file or symbol** it
happens in, and **when it last worked**. A stack trace, compiler error or failing assertion is
the best anchor there is — it names a file *and* a line, which step 5 can confirm against.

If no file or symbol is named and none can be derived, ask for one. A symptom with no anchor
cannot be bounded, and starting from a guessed file wastes the entire investigation.

Lower bound, best available first:

| The user gave you | Lower bound |
|---|---|
| a known-good changeset | that id |
| a known-good date ("it worked last Tuesday") | resolve the date to an id, and bound on the id — below |
| nothing | the last 4 weeks |

A date is not a usable bound on its own: resolve it to the last changeset that predates it, then
bound every later query on that id. A bare date literal means 00:00 that day, so a day the user
says was *fine* has to be included whole — "fine on the 15th" is `date < '<the 16th>'`.

```
cm find changeset "where branch='<branch>' and date < '<day after the known-good day>' order by changesetid desc limit 1" --format="{changesetid}" --nototal
```

**Never query unbounded history.** A long-lived file has hundreds of revisions and every one of
them looks plausible at a distance. If the bounded window turns up nothing, widen it deliberately
— to three months — and say that you did.

## 2. Expand the suspect set *before* touching history

A bug whose cause sits in the file that throws is the easy case, and rarely the one the user
needs help with. Expanding from the symptom file to **what it depends on** is what makes
cross-file root cause possible: a change in a dependency breaks its dependents.

This step is not a `cm` step, and it is not optional: **the suspect set comes before the first
`cm find`** — in what you run and in what you report. Going straight from the symptom file to
`cm find revision` is the single most common way this workflow fails, and it fails silently: the
answer looks complete while it can only ever blame the file that threw. Mentioning the expansion
afterwards, as a next step or a caveat, is the same failure — by then the queries are already
narrowed to one file.

1. Read the symptom file — the imports/includes/`using` it declares, the base classes and
   interfaces it derives from, and the types and functions the failing code actually calls. A
   stack trace narrows this to the failing method; without one, read the whole file.
2. Resolve each of those names to a file. Best tool first: a project index or language server if
   there is one, otherwise plain text search across the repo for the symbol — which is also the
   only thing that catches reflection, string lookups, config and generated code.
3. **List the set, then query it.** The list is the first thing you output, ahead of any `cm`
   command, one line per path and the reason it is in:

   ```
   Suspect set
   - Assets/Scripts/EnemyAI.cs      symptom (line 34)
   - Assets/Scripts/Perception.cs   EnemyAI.Update() calls Perception.FindTarget()
   - Assets/Scripts/TargetCache.cs  references the `ITarget` interface EnemyAI declares
   ```

   Ending up with only the symptom file is a legitimate outcome; say that you looked and found
   nothing else, never that you skipped looking.

Keep the direction *outgoing*: what the symptom file uses, not everything that uses it.

Cap the set at ~20 files. Above ~10, ask the user to confirm or narrow before querying — a 40-file
set produces a candidate list nobody can act on. At or below that, proceed without asking.

## 3. Query history, per suspect file, inside the bounds

Once step 1 produced an id — including when it came from a date, which step 1 already resolved —
bound on the id. The date form is only for the case where there was no reference at all:

```
cm find revision "where item='<path>' and changeset > <lower_cs>" --format="{changeset} {date}" --nototal
cm find revision "where item='<path>' and date > '4 weeks ago'" --format="{changeset} {date}" --nototal
```

Pass the path as it exists in the workspace, and run this for **every** file in the suspect set,
not just the symptom file. Deduplicate into one changeset list while keeping **which suspect
files each changeset touched** — that mapping is the evidence for step 4, so losing it means
redoing the work. Then fetch metadata in one query rather than one per id:

```
cm find changeset "where changesetid=<a> or changesetid=<b>" --format="{changesetid}|{branch}|{owner}|{date}|{comment}" --nototal
```

## 4. Rank on evidence, never on recency

Every candidate carries a stated connection to the symptom, in one line, or it does not appear
at all:

- it touched a symptom file;
- it touched a dependency the failing code uses — and touched the part that is used;
- it last modified the exact line the error names (step 5, the strongest signal available).

"Touched a related file" is not a connection. A changeset whose only claim is that it is recent
is noise: drop it, rather than listing it as a weak suspect and letting the user chase it. Cap
the list at 10, strongest connection first, and say how many you dropped.

Two cheap things sharpen the ranking a lot:

- **The comment.** A changeset comment naming the symbol from the stack trace outranks any
  amount of file-level proximity.
- **What actually changed.** `cm patch cs:<id> > /tmp/cs<id>.patch 2>&1` (read-only) before
  calling anything "most likely" — a rename, a reformat or a comment edit in the symptom file is
  not a cause.

**Report the branch, not just the id.** The candidate's `{branch}` says whether the change was
made on the branch the user is on or arrived from elsewhere in a merge. "Introduced on
`/main/task001`" and "merged into your branch from `/main`" are different stories with different
fixes, and the user cannot tell them apart from a changeset number.

## 5. Confirm at line level

When the symptom names a line, check the top suspect against it:

```
cm annotate <path> --format="{line}|{changeset}|{branch}|{owner}|{ismergerev}|{content}"
```

The changeset on that line is the one that last modified it. If it is your top suspect, say so —
that is the strongest evidence this workflow can produce. Annotate is slow on large files, so run
it on the symptom file around the line you care about, not across the suspect set.

Two readings change the answer entirely:

- **The line's changeset predates your window.** The bug is older than assumed. Say that
  explicitly and offer to widen the search — do not promote the best in-window candidate instead.
- **`{changeset}` is `-1`.** That line has an uncommitted local edit, so no changeset caused it:
  the user's own pending change did. Stop and tell them.

## 6. Report

A compact table, strongest evidence first:

| Changeset | Author | Date | Evidence |
|---|---|---|---|
| `cs:1205` on `/main` | `<user>` | 2026-04-16 | Dropped the null guard in `Cache.Get()`, which `SessionStore.cs:118` calls |

Follow `uvcs-core`'s reporting conventions: full object names, each a markdown link on that name
once repo and server are known (`uvcs-core/references/deep-links.md`) — the table cells included,
that is where a link most often goes missing — and nothing — id, author, date, branch — that no
command printed. If no candidate
qualifies, say so and offer a wider window: "not found in the last 4 weeks" is a useful answer,
an unsupported guess is not.

Then offer the follow-ups; the ids are already in hand, so they cost one command each — the full
diff of a suspect, blame on another file or line (step 5), or the file as it was *before* a
suspect touched it:

```
cm patch cs:<id> > /tmp/cs<id>.patch 2>&1                        # what a suspect changed
cm find changeset "where changesetid=<id>" --format="{parent}" --nototal
cm annotate "<path>#cs:<parent>"                                 # the state before it
```

## Stay read-only

`cm status`, `cm find`, `cm annotate`, `cm patch`, `cm log` and `cm cat` are the whole toolkit,
and all of them are read-only — an investigation has no reason to leave a trace.

So: do not `cm switch` the workspace to a suspect changeset "to check", do not undo or revert the
suspected change, and never present a switch, undo or revert as a casual next step. Those replace
the user's working tree or discard their pending work, and neither is recoverable with `cm`.
Finding the cause and fixing it are separate decisions: hand the fix back to the user, and if
they ask for one, treat it as a new task with its own confirmation.

Never fabricate a `cm` flag — check `uvcs-core` or `cm help <command>`.
