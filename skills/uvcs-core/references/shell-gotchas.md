# Shell gotchas when running `cm`

`cm` runs on Windows (PowerShell, cmd, Git Bash), macOS, and Linux. Prefer a single `cm`
command with `--format="..."` over pipes and post-processing — the output is already
structured, and one plain command is portable across all shells.

## PowerShell: backticks in comments are eaten

PowerShell's escape character is `` ` ``. Any `-c "..."` comment containing backticked tokens
(`` `br:` ``, `` `cm find` ``) silently loses the backtick and the first character after it —
in the stored changeset/branch/shelve comment, not in file content. Also applies to `$var`
expansion inside double quotes.

Safe patterns:
- Land the checkin with a plain single-line comment, then rewrite it:
  `cm changeset editcomment cs:<id> $comment` where `$comment` is a **single-quoted here-string**
  (`@' ... '@`) — PowerShell passes it verbatim.
- Or sidestep quoting entirely with `-commentsfile=<path>` — supported by `cm checkin`,
  `cm shelveset create`, and `cm branch create`.
- Branch comments and code review titles have **no** edit command — for those, get the quoting
  right at creation time (here-string, or run from a shell where backticks are literal).
- `cm codereview` takes the title as a positional argument (no `-c`, no `-commentsfile`), and
  its edit form cannot change the title.

## Git Bash on Windows: MSYS path conversion

MSYS rewrites any positional argument that starts with a bare `/` into a Windows path before
`cm` sees it: `/main/task001` becomes `C:/Program Files/Git/main/task001`. Single quotes do
not prevent it. This breaks `cm branch create /main/...`, `cm switch /main/...`, and the
server-path arguments of `cm shelveset apply`.

Safe: arguments with an object-spec prefix (`br:`, `cs:`, `serverpath:` ...) and query strings
starting with `where`. Workarounds: prefix the command with `MSYS_NO_PATHCONV=1`, use `br:`
prefixed specs, or run from PowerShell/cmd.

## Don't mix shell dialects

The classic failure is PowerShell cmdlets in a POSIX shell (`| Select-Object -First 1` →
"command not found") or POSIX redirects in PowerShell. Pick one shell per command. When
post-processing is genuinely needed, keep it in that one shell.

## Quoting queries

`cm find` queries must reach `cm` as a single argument. Double-quote the whole query and use
single quotes for string values inside it:

```
cm find branch "where name like 'task%'" --nototal
```

In PowerShell this exact form also works (single quotes inside double quotes are literal).
