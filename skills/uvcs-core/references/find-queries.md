# `cm find` query language

```
cm find <object> "where <conditions> [order by <field> [asc|desc]] [limit N] [offset N]" \
    [--format="..."] [--dateformat="..."] [--nototal] [--xml] [--file=<output>]
```

- Clause order is **mandatory**: `where` → `order by` → `limit` → `offset`. `find branch limit 5
  order by date desc` is rejected.
- Queries are **case-sensitive**. String values go in single quotes. Singular and plural object
  names both work (`branch` / `branches`).
- The whole query is **one shell argument** — keep it inside one pair of double quotes.
- `--nototal` suppresses the trailing `Total: N` line (a `cm find`-only flag — other commands
  reject it). Use it whenever output will be parsed.
- `--format="{field1} {field2}"` selects output columns; `--dateformat` uses .NET patterns, e.g.
  `--dateformat="yyyy-MM-dd HH:mm:ss"`.
- `cm showfindobjects` prints the authoritative object/field list for the installed version.

## Querying another repository

`on repository '<repo>@<server>'` goes **inside the quoted query string**, after all other
clauses — not as a separate shell argument (that fails with `mismatched input expecting STRING`).
This is how you query an xlinked sub-repo without leaving the workspace; the working directory
does not influence which repo `cm find` targets.

```
cm find changeset "where branch='/main/task001' order by changesetid desc limit 1 on repository 'other-repo@myorg@cloud'" --format="{changesetid} {guid}" --nototal
```

## Operators and values

| Operator | Example |
|---|---|
| `=` `!=` `>` `<` `>=` `<=` | `owner != 'me'` |
| `like` (`%` wildcard) | `name like 'task%'` |
| `between ... and ...` | `date between '3 days ago' and 'today'` |
| `and` / `or` | combine conditions |

- `'me'` = current user, valid in `owner` / `assignee` fields.
- Booleans: `'true'` / `'false'`.
- Date constants for any date field: `'today'`, `'yesterday'`, `'this week'`, `'this month'`,
  `'this year'`, `'one day ago'`, `'one week ago'`, `'one month ago'`, `'<n> days ago'`,
  `'<n> weeks ago'`, `'<n> months ago'`, `'<n> years ago'`, or a literal date in the machine
  locale (`'2026/01/15'`). An unknown constant is rejected with *"The value '...' is not valid
  for field 'date'"*, so an empty result never means the constant was wrong.

## Sorting — the rules that bite

1. **Only `branch`, `changeset`, `label`, and `review` support `order by`.** `shelve`, `merge`,
   `attribute`, `attributetype`, `revision`, and `replicationlog` reject it (e.g. *"The object
   type shelve cannot order by date"*). To get the newest shelve, fetch unsorted and pick the
   max `shelveid` yourself.
2. **Sort field names differ from filter field names.** You filter branches by `name` but sort
   by `branchname`:

| Object | Sort fields |
|---|---|
| `branch` | `date`, `branchname` |
| `changeset` | `date`, `changesetid` |
| `label` | `date`, `labelname` |
| `review` / `mergerequest` | `date`, `modifieddate`, `status`, `mergerequeststatus` |

3. **`asc` or `desc` is required.** A bare `order by branchname` is a syntax error — *"Query
   error: line 1:60 no viable alternative at input '<EOF>'"* — with no hint that the direction is
   what is missing.

To find a branch head, prefer `order by changesetid desc limit 1` over `date` (dates can tie
within a second).

## Objects and their filter fields

All objects also have `GUID` and `ID` (internal object id — not the user-visible number).

| Object | Filter fields |
|---|---|
| `branch` | `name` (**leaf only** — `name='task001'`, never `'/main/task001'`, which matches nothing; `{name}` still *prints* the full path, and two branches can share a leaf, so compare the printed path), `date`, `changesets` (date of its changesets), `attribute`, `attrvalue`, `owner`, `parent` (brspec), `comment`, `hidden` |
| `changeset` | `branch`, `changesetid`, `date`, `owner`, `comment`, `attribute`, `attrvalue`, `parent` (cset id), `returnparent` (`'true'` returns the parent instead), `onlywithrevisions`, `ignorehidden` |
| `label` | `name`, `date`, `owner`, `branch`, `changeset` (cset id), `comment`, `attribute`, `attrvalue` |
| `shelve` | `shelveid`, `owner`, `date`, `comment`, `parent`, `attribute`, `attrvalue` |
| `review` / `mergerequest` | `status` (= `codereviewstatus`), `assignee` (= `reviewer`), `title`, `comment`, `target` (objspec), `targetid`, `targettype` (`'branch'`/`'changeset'`), `mergerequeststatus` (`'Draft'`/`'Open'`/`'Closed'`/`'Merged'`), `destination` (brspec), `date`, `modifieddate`, `owner` |
| `changereviewcomment` | `reviewid` (= `review`), `type`, `line`, `location`, `parent`, `changeset`, `appliedinchangeset`, `revisionid`, `comment`, `owner`, `date`, `modifieddate` |
| `attribute` | `type`, `value`, `date`, `owner`, `comment`, `srcobj` (objspec of the object holding the attribute) |
| `attributetype` | `name`, `value`, `date`, `owner`, `comment`, `source` |
| `revision` | `branch`, `changeset`, `item` (path), `itemid`, `date`, `owner`, `size`, `type` (`'txt'`/`'bin'`/`'dir'`), `parent`, `returnparent`, `shelve`, `archived`, `comment` |
| `merge` | `srcbranch`, `srcchangeset`, `dstbranch`, `dstchangeset`, `date`, `owner`, `type` (`'merge'`, `'cherrypick'`, `'interval'`, ...) |
| `replicationlog` | `branch`, `repositoryname`, `owner`, `date`, `server`, `package` |

Useful `--format` tokens (per object; unknown tokens print literally, so verify):
branch `{name} {date} {owner} {comment} {parent}` · changeset `{changesetid} {branch} {date}
{owner} {comment} {guid} {parent}` · label `{name} {date} {owner} {changeset} {comment}` ·
shelve `{shelveid} {date} {owner} {comment} {parent}` · review/mergerequest `{id} {title}
{status} {codereviewstatus} {mergerequeststatus} {assignee} {target} {targettype} {destination}
{owner} {date}` · changereviewcomment `{id} {guid} {reviewid} {type} {line} {location} {parent}
{changeset} {appliedinchangeset} {revisionid} {comment} {owner} {date}` · revision `{id} {item}
{changeset} {branch} {size} {type}`.

### Review and merge request quirks

- `mergerequest` is the **same object** as `review`, filtered to the reviews that are merge
  requests. Everything above applies to both names.
- `{mergerequeststatus}` and `{status}` print their field name inline — `MergeRequestStatus Open`,
  `Status Reviewed` — not a bare value. Strip the prefix when parsing.
- `{target}` prints an internal `id:<n>`, **not** a branch name or spec, so it is useless as
  output; as a *filter* it takes a normal spec (`target='br:/main/task001'`) and is the reliable
  way to find the merge request for a branch.
- `{guid}` is **not** a valid format token here, though `guid` works in a `where`.
- `changereviewcomment`'s `location` is the **0-based** stored position, kept as text — quote it
  (`location='105'`). `line` is its **1-based** alias, matching the `--line` flag and text
  editors; it accepts only `=` and `!=`, rejects values below 1, and is empty when the comment is
  not anchored to a line. `reviewcomment` is an older object exposing a subset of the same
  comments — prefer `changereviewcomment`.
- **`line` is newer than `cm` 11.0.16.10371**, which rejects it with *"The object type 'line' is
  not valid on performed query."*; `location` works on both. Reading `{location}` and adding 1
  needs no version probe and is the portable choice — but then the **+1 is mandatory**, and
  `location` is `-1`, not empty, when the comment is not anchored.
- `revisionid` is a real revision id: feed it to `cm find revision` for the file it points at
  (recipe below). It is *not* a changeset — `appliedinchangeset` and `changeset` are.

## Recipes

```bash
# Branches I created recently
cm find branch "where owner='me' and date > 'one week ago' order by date desc" --format="{name} {date}" --nototal

# Head changeset (id + GUID) of a branch
cm find changeset "where branch='/main/task001' order by changesetid desc limit 1" --format="{changesetid} {guid}" --nototal

# Base changeset of a branch = {parent} of its first changeset (needs >= 1 cset on the branch)
cm find changeset "where branch='/main/task001' order by changesetid asc limit 1" --format="{changesetid} {parent}" --nototal

# Branch comment (task title convention in many orgs)
cm find branch "where name='task001'" --format="{comment}" --nototal

# Does this branch have attribute status=RESOLVED?
cm find branch "where name='task001' and attribute='status' and attrvalue='RESOLVED'" --nototal

# All attributes on a branch (cm attribute cannot read — only cm find can)
cm find attribute "where srcobj='br:/main/task001'" --nototal

# My shelves (no order by allowed — pick the highest shelveid client-side)
cm find shelve "where owner='me'" --format="{shelveid} {date} {comment}" --nototal

# Reviews waiting on me
cm find review "where assignee='me' and status='Under review'" --format="{id} {title}" --nototal

# The merge request for a branch (target filters on the source branch; don't print it)
cm find mergerequest "where target='br:/main/task001'" --format="{id} {title} {destination}" --nototal

# Pending change requests on a review ({location} is 0-based: add 1 for the editor line)
cm find changereviewcomment "where reviewid=311 and type='change'" --format="{guid} {location} {comment}" --nototal

# A revision id -> the file it is a revision of, and where that revision lives
# ({item} is the workspace path when the repo is mapped; the changeset dates the anchor)
cm find revision "where id=5501234" --format="{item}|{changeset}|{branch}" --nototal

# Recent merges into /main via changeset comments (fast at any repo size)
cm find changeset "where branch='/main' and comment like 'merged%' order by changesetid desc limit 30" --format="{changesetid} {date} {comment}" --nototal
```

## Known limitations

- `merge` and `shelve` accept no `order by` and `merge` accepts no date constants for `date` —
  for recent-merge history, query `changeset` comments on the destination branch instead
  (comment patterns vary per org: automated merges usually embed the source branch name).
- Avoid walking parents one query at a time (`returnparent='true'` in a loop): O(n) round
  trips. A single filtered query with `limit` is almost always available.
- A fully-qualified cross-repo spec inside a `where` (e.g.
  `target='br:/main/task001@repo@server'`) often matches nothing; use the plain spec plus
  `on repository '...'` instead.
