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
  `'<n> months ago'`, `'<n> years ago'`, or a literal date in the machine locale
  (`'2026/01/15'`).

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
| `review` | `date`, `modifieddate`, `status` |

To find a branch head, prefer `order by changesetid desc limit 1` over `date` (dates can tie
within a second).

## Objects and their filter fields

All objects also have `GUID` and `ID` (internal object id — not the user-visible number).

| Object | Filter fields |
|---|---|
| `branch` | `name`, `date`, `changesets` (date of its changesets), `attribute`, `attrvalue`, `owner`, `parent` (brspec), `comment`, `hidden` |
| `changeset` | `branch`, `changesetid`, `date`, `owner`, `comment`, `attribute`, `attrvalue`, `parent` (cset id), `returnparent` (`'true'` returns the parent instead), `onlywithrevisions`, `ignorehidden` |
| `label` | `name`, `date`, `owner`, `branch`, `changeset` (cset id), `comment`, `attribute`, `attrvalue` |
| `shelve` | `shelveid`, `owner`, `date`, `comment`, `parent`, `attribute`, `attrvalue` |
| `review` | `status`, `assignee`, `title`, `target` (objspec), `targetid`, `targettype` (`'branch'`/`'changeset'`), `date`, `owner` |
| `attribute` | `type`, `value`, `date`, `owner`, `comment`, `srcobj` (objspec of the object holding the attribute) |
| `attributetype` | `name`, `value`, `date`, `owner`, `comment`, `source` |
| `revision` | `branch`, `changeset`, `item` (path), `itemid`, `date`, `owner`, `size`, `type` (`'txt'`/`'bin'`/`'dir'`), `parent`, `returnparent`, `shelve`, `archived`, `comment` |
| `merge` | `srcbranch`, `srcchangeset`, `dstbranch`, `dstchangeset`, `date`, `owner`, `type` (`'merge'`, `'cherrypick'`, `'interval'`, ...) |
| `replicationlog` | `branch`, `repositoryname`, `owner`, `date`, `server`, `package` |

Useful `--format` tokens (per object; unknown tokens print literally, so verify):
branch `{name} {date} {owner} {comment} {parent}` · changeset `{changesetid} {branch} {date}
{owner} {comment} {guid} {parent}` · label `{name} {date} {owner} {changeset} {comment}` ·
shelve `{shelveid} {date} {owner} {comment} {parent}` · review `{id} {status} {assignee}
{target} {date}` · revision `{id} {item} {changeset} {branch} {size} {type}`.

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
cm find review "where assignee='me' and status='Under review'" --format="{id} {target} {title}" --nototal

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
