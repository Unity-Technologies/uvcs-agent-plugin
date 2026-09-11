# `plastic://` deep links

The UVCS GUI registers the `plastic://` URL scheme on Windows and macOS. A link opens the GUI
directly on the target object — useful in review comments, tickets, chat, and release notes.

## URL shapes

| Object | URL |
|---|---|
| Code review (default tab) | `plastic://<server>/repos/<repo>/code-reviews/<id>` |
| Code review (Review Changes tab) | `plastic://<server>/repos/<repo>/code-reviews/<id>/reviewchanges` |
| Branch | `plastic://<server>/repos/<repo>/branches/<branch-path>/diff` |
| Changeset | `plastic://<server>/repos/<repo>/changesets/<id>/diff` |
| Changeset range | `plastic://<server>/repos/<repo>/changesets/<src>..<dst>/diff` |
| Label | `plastic://<server>/repos/<repo>/labels/<name>/diff` |
| Label range | `plastic://<server>/repos/<repo>/labels/<src>..<dst>/diff` |
| Shelveset | `plastic://<server>/repos/<repo>/shelvesets/<positive-id>/diff` |

Trailing `/diff` is **required** for branches, changesets, labels, and shelvesets; code
reviews take none. Shelvesets use the **positive** id even where an API exposed a negative
changeset id.

## Server segment: `@` becomes `.`

The URL server form differs from the `cm` CLI form:

| cm CLI form | URL form |
|---|---|
| `myorg@cloud` | `myorg.cloud` |
| `myorg@cloud.cn` | `myorg.cloud.cn` |
| `host:9095` (on-prem) | `host:9095` (unchanged) |
| `local` | `local` (unchanged) |
| `ssl://host:port` | unchanged (yields `plastic://ssl://host:port/...`) |

## Encoding

- Repo names are URL-encoded (space → `+`, `+` → `%2b`, ...).
- Branch paths: strip the leading `/`, keep the `/` separators, URL-encode each segment:
  `/main/task001` → `branches/main/task001`;
  `/main/My branch` → `branches/main/My+branch`.

## Worked example

Branch `/main/task001` in repo `mygame` on `myorg@cloud`, head `cs:4207`, review `311`:

```
plastic://myorg.cloud/repos/mygame/branches/main/task001/diff
plastic://myorg.cloud/repos/mygame/changesets/4207/diff
plastic://myorg.cloud/repos/mygame/code-reviews/311
```
