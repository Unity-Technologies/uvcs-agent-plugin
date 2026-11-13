# Writing comments

Every text `cm` stores for people to read: check-in, shelve, branch and label comments
(`-c`, `-commentsfile`, `cm changeset editcomment`), merge request and code review titles, review
comments, replies and status comments.

## Where they show

- **Unity Version Control — Desktop** renders them as GitHub-flavored Markdown and turns object
  references into clickable chips showing the object's name and summary.
- **Every other client** (the legacy desktop GUI, `cm log`, the Unity plugin, the web) shows the raw
  text. So write Markdown sparingly: what reads well raw (backticks, `-` lists, `**bold**`, a fence)
  is fine; tables, nested structure and HTML are noise there.

## Rules

- **One paragraph is one line.** Line breaks are kept as written, as in a GitHub comment, so a
  paragraph wrapped at 80 or 100 columns shows broken mid-sentence. Separate paragraphs with a blank
  line; a list item is one line too.
- **The first line is the title.** Every list (changesets, shelves, branches, review threads)
  shows only that line: a short summary that stands alone. Details go after a blank line.
- **Objects as bare specs**, the way `cm` names them, so each becomes a chip and still pastes into
  `cm` from the raw text:

  | Write | For |
  |---|---|
  | `cs:4207`, `br:/main/task001`, `lb:v1.2.0`, `sh:12` | changeset, branch, label, shelve |
  | `cr:311` | a code review or merge request (Desktop's notation; `cm` does not take it) |
  | `serverpath:/src/Player.cs#cs:4207` | a file at a changeset (`#br:`, `#lb:`, `#sh:` too) |
  | any of these + `@<repo>` or `@<repo>@<server>` | the object in another repository |
  | `@<user>`, as `cm` names owners | a person |
  | `[apply-change:<8 hex>]` | the change request a check-in applies (`reviews-and-merge-requests.md`) |

  Prefixes are lower case. Trailing punctuation and bold are fine (`see cs:4207.`). **Never inside
  backticks or a markdown link**: neither is read as a reference, so `` `cs:4207` `` and
  `[cs:4207](plastic://…)` stay plain text or a link with no chip, and the link is punctuation soup
  in every other client. A name with spaces cannot be a spec: write its bare `plastic://` link,
  even in a Unity project (shapes and encoding: `deep-links.md`), which Desktop shows as the same
  chip; `unityhub://` makes none.
- **Code**: identifiers, paths, flags and constants in backticks, but never an object spec (above);
  code in a fence tagged with its language (or `suggestion`, see `reviews-and-merge-requests.md`).
  Links open only for `http(s)://`, `plastic://` and `uvcs://`; images show only from `http(s)://`.
- **In a review comment**: no headings (it shows whole, as a message), a list when there are items,
  bold for the one thing not to miss, a table only when the data is truly tabular.
