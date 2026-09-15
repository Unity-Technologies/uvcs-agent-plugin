# Merge requests and code reviews

A **merge request** (MR) is the UVCS equivalent of a GitHub pull request: a server object that
proposes merging a **source branch** into a **destination branch**, carrying reviewers, a review
status, and a comment thread. A **code review** is the same object without the merge proposal,
and it targets a **changeset or a shelve**.

> **Pick by target.** Branch → merge request. Changeset or shelve → code review. A branch code
> review created with `cm codereview br:...` still works, but the MR is the intended workflow for
> a branch and the only one the GUI surfaces merge actions for.

An MR **is** a review: same id, same object in `cm find review`, same `comment` and `reviewer`
subcommands. `cm mergerequest <id> ...` and `cm codereview <id> ...` are interchangeable on an
MR's id — the two spellings exist so each workflow reads naturally.

**Availability.** The `comment` and `reviewer` subcommand groups, and `--users` / `--groups` in
place of `--assignee`, are **newer than `cm` 11.0.16.10371** and are not in a public release yet.
Detect before use: `cm mergerequest --usage` lists `comment` and `reviewer` on a client that has
them. The server must also be 11.0.16.8321 or newer, otherwise commands fail with *"You need to
upgrade the server to version 11.0.16.8321 or higher to use the new code review system."* —
never silently. `cm mergerequest` additionally needs `MergeRequestEnabled` on the server.

Aliases: `cm mergerequest` = `cm mr`, `cm codereview` = `cm cr`.

## Merge request lifecycle

`create` / `mk` is **mandatory** — there is no implicit-create form. All of these are **mutating**.

```
cm mergerequest create br:/main/task001 "<title>" --destination=br:/main \
    [--mergerequeststatus=Draft] [--codereviewstatus="Under review"] \
    [--users=<user>,<user>] [--groups=<group>] [--format="{id}"] [--repository=<repo>@<server>]

cm mergerequest edit <id|guid> [--destination=<brspec>] [--mergerequeststatus=<status>] \
    [--mergechangeset=cs:<id>] [--codereviewstatus=<status>] [--repository=<repo>@<server>]

cm mergerequest delete <id> [<id> ...]        # irreversible
```

- `--destination` is required on create. Prints the new id (`--format` tokens: `{id}`, `{guid}`).
- **MR status** (`--mergerequeststatus`): `Draft`, `Open` (default), `Closed`, `Merged`. `None` is
  rejected.
- **Review status** (`--codereviewstatus`): `"Under review"` (default), `Reviewed`,
  `"Rework required"`. On `edit` it sets **the calling user's own reviewer status**, not a
  review-wide field — `cm mergerequest <id> reviewer status` is the clearer spelling and is the
  only one that takes a status-change comment.
- `--mergechangeset=cs:<id>` is only valid together with `--mergerequeststatus=Merged`, and links
  the MR to its merge changeset in the timeline. The server sets `Merged` by itself when the
  source branch lands in the destination; do not set it by hand otherwise.
- Withdraw an MR with `--mergerequeststatus=Closed`. `delete` destroys the object and its whole
  comment thread.
- `--repository` targets a server other than the workspace's (e.g. an xlinked sub-repo).

## Reviewers

Same group under both commands; substitute `cm codereview <review_id>` for `cm mr <mr_id>`.
`list` is **read-only**, the rest are **mutating**.

```
cm mr <id> reviewer list                                   # or: ls
cm mr <id> reviewer list --format="{user}#{status}"
cm mr <id> reviewer add --users=<user>,<user> --groups=<group>
cm mr <id> reviewer remove --users=me
cm mr <id> reviewer status --status=Reviewed -c="<comment>"
cm mr <id> reviewer rerequest [--users=<user>] [--groups=<group>]
```

- Reviewers are a **list**, not a single assignee: `add` is additive and keeps the existing ones.
  Users and groups are separate comma-separated options because a user and a group can share a
  name; `add` / `remove` require at least one of them, and an option holding no name is an error.
- `me` resolves to the current user in `--users`.
- `list` tokens: `{user}`, `{status}`, `{type}` (`user` or `group`), plus `{tab}` and `{newline}`;
  the positional forms `{0} {1} {2}` are the same fields. With no `--format` (or `--format=TABLE`)
  it prints those three in columns. **An MR with no reviewers prints nothing at all** — empty
  output is not an error.
- `reviewer status` always sets **your own** status; there is no way to set someone else's. You
  must be a reviewer, in a reviewer group, or a server admin.
- `rerequest` puts reviewers back to `Under review` for a new round; with no `--users`/`--groups`
  it re-requests from every reviewer.
- Passing reviewers on `create` instead of adding them afterwards produces a single batched
  timeline comment rather than one per reviewer.

## Comments

Same group under both commands. All **mutating**; reading is `cm find changereviewcomment`.

```
cm mr <id> comment add -c="<text>"                                  # conversation comment
cm mr <id> comment add -c="<text>" --path=/src/Player.cs --line=42  # inline comment
cm mr <id> comment add -c="<text>" --path=/src/Player.cs --line=42 \
    --type=Question --changeset=cs:4207
cm mr <id> comment reply <comment_guid> -c="<text>" [--discard]
cm mr <id> comment edit <comment_guid> -c="<text>"
cm mr <id> comment delete <comment_guid> [<guid> ...]
```

- **Two kinds.** No `--path` → a *conversation* comment on the review as a whole. `--path` +
  `--line` → an *inline* comment on that file and line.
- `--path` is a **server path** (`/src/Player.cs`), never a workspace path. `--path` requires
  `--line`, and `--line`, `--type` and `--changeset` each require `--path`.
- `--line` is **1-based**, like an editor and like the `line` query field. The stored `location`
  is 0-based — see the `changereviewcomment` fields in `find-queries.md`.
- `--type`: `Change` (default) requests a change and stays pending until applied or discarded;
  `Question` asks something; `Comment` is a plain note.
- `--changeset=cs:<id>` files the comment under that one changeset's diff instead of the whole
  branch diff; the revision the comment points at is unchanged. The changeset must belong to the
  reviewed branch (or equal the reviewed changeset), otherwise the command errors.
  Without it, an inline comment on a branch review resolves the revision at the **branch head**.
- Text sources, in order: `-c=`, `-commentsfile=<path>`, `-commentsfile=-` or piped stdin, then
  `$PLASTICEDITOR`. For generated text prefer `-commentsfile` — see `shell-gotchas.md`. A
  trailing newline from a pipe is stripped. Stdin is unavailable in `cm shell` mode and fails
  loudly there.
- `add` and `reply` print the new comment **GUID** (`--format` tokens `{0}` id, `{1}` guid).
  That GUID is what `reply` / `edit` / `delete` take — a numeric id is rejected with
  *"The comment must be identified by its GUID"*.
- `reply --discard` marks a `Change` request as one you will not make, so it stops counting as
  pending. A reply inherits the parent's file, line and changeset.
- **A reply is a comment in its own right**, carrying the parent's **numeric id** in its `parent`
  field (not the parent's GUID). Its `type` records what the reply did: answering a `question`
  yields a `comment`, and `reply --discard` yields a **`discarded`** comment — the parent stays
  `change`. So "was this addressed?" is a question about the *children*, not about the parent.
- Editing keeps type, file, line and changeset — only the text changes. **Anyone with change
  permission on the reviewed branch or changeset can edit or delete any comment**, not just its
  author.

## Closing a change request from a check-in: `[apply-change:]`

A `Change` comment stays pending until something applies or discards it. The applying half is a
**check-in comment tag** — no review command is involved:

```
cm checkin --all -c "[apply-change:8123d65a] <what the fix does>"
```

- `8123d65a` is the **first 8 hex characters of the comment GUID** — the part before the first
  `-`. Short enough to scan in `cm find changeset` output, unique enough within one review.
- The server matches the tag at check-in and sets the comment's `appliedinchangeset` to the new
  changeset id, decrementing the review's pending count. This is the whole mechanism; there is no
  follow-up command.
- **`Change` comments only.** On a `question`, `comment`, `conversation` or a reply, the tag
  matches nothing and `cm checkin` exits **1** with *"The following review change requests
  (specified in the checkin comment) cannot be found or are already applied in a previous
  changeset"* — the same error a mistyped or already-applied GUID produces. **The changeset is
  still created**, so never re-run the check-in on this error: only the link is missing. Mark
  those comments by replying in the thread instead.
- Several tags in one comment (`[apply-change:abc12345] [apply-change:def67890] ...`) are each
  matched independently, in any position.
- Verify rather than assume — the tag is silent on success:

  ```
  cm find changereviewcomment "where reviewid=<id> and guid='<full-guid>'" \
      --format="{appliedinchangeset}" --nototal
  ```

  `-1` means nothing matched.

A **shelve comment links nothing**: `cm shelveset create -c "[apply-change:...]"` is just text,
because only a check-in triggers the server-side match. Putting the tag in the shelve comment is
still useful — it becomes the ready-made check-in comment when the shelve is applied.

## Code reviews (changesets and shelves)

```
cm codereview cs:4207 "<title>" [--status=<status>] [--users=<user>] [--groups=<group>] \
    [--format="{id} -> {guid}"] [--repository=<repo>@<server>]
cm codereview sh:12 "<title>" --users=<user>
cm codereview -e <id|guid> --status=Reviewed         # sets YOUR reviewer status
cm codereview -d <id> [<id> ...]                     # irreversible
```

`--status` (alias `--codereviewstatus`) means two different things: **on create** it is the
review's own status, **on `-e`** it is the calling user's reviewer status, exactly like
`cm codereview <id> reviewer status`. Prefer the explicit subcommand.

`--users` / `--groups` are accepted **only on create**; after that use the `reviewer` group.

## Finding merge requests and reviews

Read-only. Full field lists and query grammar: `find-queries.md`.

```bash
# The MR for a branch — target is the source branch under review
cm find mergerequest "where target='br:/main/task001'" --format="{id} {title} {destination}" --nototal

# Open MRs into /main
cm find mergerequest "where mergerequeststatus='Open' and destination='br:/main'" --nototal

# Waiting on me
cm find mergerequest "where assignee='me' and status='Under review'" --format="{id} {title}" --nototal

# The review or MR on a branch — the reliable lookup from the author's side
cm find review "where target='br:/main/task001'" \
    --format="{id}|{title}|{targettype}|{status}|{owner}" --nototal

# Read a review's whole thread (conversation + inline + replies + timeline)
cm find changereviewcomment "where reviewid=<id>" --xml --nototal

# Just the pending change requests
cm find changereviewcomment "where reviewid=<id> and type='change'" --nototal
```

- **Prefer `--xml` for reading a thread.** Comment text is free-form and may contain newlines, so
  `--format` output is not one record per line and cannot be parsed positionally. The XML element
  names are the field names upper-cased (`<APPLIEDINCHANGESET>`, `<LOCATION>`, `<PARENT>`).
- **`-1` is the "unset" value on every numeric comment field** — `parent` (top-level),
  `appliedinchangeset` (not applied), `changeset` (not filed under one), `revisionid` and
  `location` (not anchored to a file and line). Never read `-1` as a real id.
- `{type}` renders **lower-case**: `change`, `question`, `comment`, `conversation`, `discarded`,
  `timeline` — and a `where` clause matches that spelling (`type='change'`), not the `--type`
  flag's `Change`.
- `cm find mergerequest` returns only reviews that are MRs; `cm find review` returns both — and a
  branch can carry a plain code review rather than an MR, so **query `review` when you need
  whatever review exists** on a branch and `mergerequest` only when you specifically need MRs.
- Format-token quirks of `review` / `mergerequest` (`{status}` prints its field name, `{target}`
  prints an internal id, `{guid}` is not a token) are under *Review and merge request quirks* in
  `find-queries.md`.

## Deep links

`[merge request <id>](plastic://<server>/repos/<repo>/merge-requests/<id>)` — see `deep-links.md`
for the code review shape, the `@` → `.` server rewrite, encoding, and when the markdown wrapper
comes off. Merge requests and code reviews have no `unityhub://` form, so they stay `plastic://`
even in a Unity project.
