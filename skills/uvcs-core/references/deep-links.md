# Deep links to UVCS objects

Two URL schemes open a UVCS object straight from a link — useful in review comments, tickets,
chat, and release notes. Which one to emit depends on the workspace, and only one is emitted:

| Workspace | Scheme | A click opens |
|---|---|---|
| A Unity project | `unityhub://` | the object in that project's Unity Editor, routed by the Hub |
| Anything else | `plastic://` | the object in the UVCS desktop GUI (Windows, macOS) |

## Render it as a markdown link

Where markdown is rendered — chat answers, reports, tickets, PR and MR bodies — every object is
`[<object name>](<url>)`, assembled in two steps:

1. **Link text** = the object's `cm` name, exactly as the *Reporting UVCS objects* rules give it:
   `cs:4207`, `br:/main/task001`, `lb:v1.2.0`, `sh:12`, or `merge request 312` / `code review 311`
   for the objects with no spec prefix.
2. **Target** = the URL for that object *from the tables in this file*, in the scheme the
   workspace selects above — never a shape recalled from memory or copied from another object.

```
[cs:4207](plastic://myorg.cloud/repos/mygame/changesets/4207/diff)          # non-Unity workspace
```

- **Link every object that has a shape below, every time it is named** — changesets, branches,
  labels, shelves, ranges, code reviews, merge requests — not just the first mention and not just
  the headline object. A table cell, a list item and a sentence all take a link.
- **In markdown, never emit the name and its URL as two separate pieces** — not `cs:4207` followed
  by a bare `plastic://...`, not a trailing list of links. One of the two is redundant.
- **Link text is the object's name, never prose**: `[br:/main/task001](...)`, not `[the branch](...)`.
- **Bare URL where markdown is not rendered**: text published into UVCS itself (review and
  check-in comments) or any plain-text destination. Unrendered, `[cs:4207](plastic://...)` shows
  both pieces as punctuation soup, so when the destination is unknown the bare URL is the safe
  form — it loses the link text, not the address.
- A URL that contains `)` (a branch or label name can) ends the markdown target early. Wrap that
  target in angle brackets: `[lb:fix(2)](<plastic://myorg.cloud/repos/mygame/labels/fix(2)/diff>)`.
- The scheme is chosen per object, so one report can mix them: in a Unity project a changeset
  gets `unityhub://` while the label or merge request next to it stays `plastic://`.

## Is this workspace a Unity project?

A Unity project root holds both `Assets/` and `ProjectSettings/ProjectVersion.txt`. Check the
workspace root — `cm gwp . --format="{wkpath}"` (read-only) — and, since a workspace can hold the
project in a subdirectory, otherwise walk up from the directory the work is about, stopping at the
workspace root. Decide once per task and reuse the answer.

The project's cloud id is the `cloudProjectId` value in `ProjectSettings/ProjectSettings.asset`:

```
  cloudProjectId: 0f1e2d3c-4b5a-4697-8877-665544332211
```

It is empty in a project that is not linked to Unity Cloud — then use the prefix-less form below.

## `unityhub://` shapes

```
unityhub://editor/project/<cloudProjectId>/Unity.PlasticSCM.Editor/<action>?repo=<repo>%40<server>
unityhub://editor/Unity.PlasticSCM.Editor/<action>?repo=<repo>%40<server>
```

Prefer the first: the cloud project id routes the link to the Editor that has *that* project open.
The prefix-less form goes to whichever Editor is running, whatever project it is on.

| Object | `<action>` |
|---|---|
| Changeset | `show/changeset/<id>` |
| Branch | `show/branch/<branch-path-without-leading-slash>` |
| Shelve | `show/shelve/<positive-id>` |

- Branch paths **drop the leading `/`** and keep the rest: `/main/task001` → `show/branch/main/task001`.
- `repo=` carries the repo spec in **`cm` form** (`<repo>@<server>`, `@` kept), URL-encoded, so
  every `@` becomes `%40` — the opposite of the `plastic://` rewrite below. The Editor checks it
  against the workspace it has open and warns on a mismatch; leave it out and the link acts on
  whatever workspace that Editor is in, silently. Always include it.
- Percent-encode the rest of the action too (space → `%20`), and quote the whole URL in a shell:
  `&` in an unquoted URL backgrounds the command.
- The Hub also carries `merge/...` actions that launch a merge or a shelve apply in the Editor.
  Never put one in a report: a link that someone else clicks must be read-only.
- **No hub form exists** for labels, changeset or label ranges, code reviews, or merge requests.
  Emit their `plastic://` link even in a Unity project.

## `plastic://` shapes

| Object | URL |
|---|---|
| Code review (default tab) | `plastic://<server>/repos/<repo>/code-reviews/<id>` |
| Code review (Review Changes tab) | `plastic://<server>/repos/<repo>/code-reviews/<id>/reviewchanges` |
| Merge request (default tab) | `plastic://<server>/repos/<repo>/merge-requests/<id>` |
| Merge request (Review Changes tab) | `plastic://<server>/repos/<repo>/merge-requests/<id>/reviewchanges` |
| Branch | `plastic://<server>/repos/<repo>/branches/<branch-path>/diff` |
| Changeset | `plastic://<server>/repos/<repo>/changesets/<id>/diff` |
| Changeset range | `plastic://<server>/repos/<repo>/changesets/<src>..<dst>/diff` |
| Label | `plastic://<server>/repos/<repo>/labels/<name>/diff` |
| Label range | `plastic://<server>/repos/<repo>/labels/<src>..<dst>/diff` |
| Shelveset | `plastic://<server>/repos/<repo>/shelvesets/<positive-id>/diff` |

Trailing `/diff` is **required** for branches, changesets, labels, and shelvesets; code reviews
and merge requests take none. Shelvesets use the **positive** id even where an API exposed a
negative changeset id.

A merge request and the code review it wraps share one id, so the two URLs differ only in the
segment. Use `merge-requests` when the object is a merge request — the GUI opens the merge
request window, with its merge actions, instead of the plain review.

### Server segment: `@` becomes `.`

The URL server form differs from the `cm` CLI form:

| cm CLI form | URL form |
|---|---|
| `myorg@cloud` | `myorg.cloud` |
| `myorg@cloud.cn` | `myorg.cloud.cn` |
| `host:9095` (on-prem) | `host:9095` (unchanged) |
| `local` | `local` (unchanged) |
| `ssl://host:port` | unchanged (yields `plastic://ssl://host:port/...`) |

### Encoding

- Repo names are URL-encoded (space → `+`, `+` → `%2b`, ...).
- Branch paths: strip the leading `/`, keep the `/` separators, URL-encode each segment:
  `/main/task001` → `branches/main/task001`;
  `/main/My branch` → `branches/main/My+branch`.

## Worked example

Branch `/main/task001` in repo `mygame` on `myorg@cloud`, head `cs:4207`, shelve `sh:12`,
review `311`, merge request `312`.

Not a Unity project:

```
[br:/main/task001](plastic://myorg.cloud/repos/mygame/branches/main/task001/diff)
[cs:4207](plastic://myorg.cloud/repos/mygame/changesets/4207/diff)
[sh:12](plastic://myorg.cloud/repos/mygame/shelvesets/12/diff)
[code review 311](plastic://myorg.cloud/repos/mygame/code-reviews/311)
[merge request 312](plastic://myorg.cloud/repos/mygame/merge-requests/312)
```

A Unity project with `cloudProjectId: 0f1e2d3c-4b5a-4697-8877-665544332211` — the reviews have no
hub form, so they keep `plastic://`:

```
[br:/main/task001](unityhub://editor/project/0f1e2d3c-4b5a-4697-8877-665544332211/Unity.PlasticSCM.Editor/show/branch/main/task001?repo=mygame%40myorg%40cloud)
[cs:4207](unityhub://editor/project/0f1e2d3c-4b5a-4697-8877-665544332211/Unity.PlasticSCM.Editor/show/changeset/4207?repo=mygame%40myorg%40cloud)
[sh:12](unityhub://editor/project/0f1e2d3c-4b5a-4697-8877-665544332211/Unity.PlasticSCM.Editor/show/shelve/12?repo=mygame%40myorg%40cloud)
[code review 311](plastic://myorg.cloud/repos/mygame/code-reviews/311)
[merge request 312](plastic://myorg.cloud/repos/mygame/merge-requests/312)
```

Published as a review comment instead, the same changeset is
`cs:4207 plastic://myorg.cloud/repos/mygame/changesets/4207/diff` — bare, because that text is
not rendered.
