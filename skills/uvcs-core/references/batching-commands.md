# Batching read-only `cm` commands in one process

`cm shell` keeps one `cm` process open and reads commands from its standard input, so a run of
commands pays the client's startup — and, against a cloud server, the connection handshake —
**once** instead of per command.

This is `cm`'s own shell mode, not the OS shell (whose quoting rules are in `shell-gotchas.md`).
There are no pipes or redirections inside a batch, so `--format` is the only way to shape output.

Batching is an optimization and nothing else. It changes the exit-code, error-stream and
process-state contract, so it is only safe inside the restrictions below. When a batch does not
fit them, run plain `cm` commands one at a time — that is always correct.

## When it pays

Measured, `cm` 11.0.16 on macOS:

| | local server | cloud server |
|---|---|---|
| one plain `cm` command (whole process) | 0.24s | 0.60s |
| `cm shell` startup, before any command | 0.97s | 0.97s |
| first command in the batch | ~0.07s | 0.51s |
| each command after it | 0.014–0.075s | 0.10–0.18s |
| 20 × `cm status` | 4.62s → 1.58s | 12.61s → 4.16s |
| 10 changesets × (`cm log` + `cm diff`) | — | 12.55s → 4.83s |

Startup does not depend on the server (no server contact until the first command runs), while
each *separate* process repeats the handshake — so the gain grows with how remote the server is.

**Batch only when all of these hold:**

1. **5 or more commands.** Below that the 0.97s startup loses: measured on cloud, 3 commands is
   slower batched (1.80s → 2.11s), 4 is a wash, 6 wins (3.74s → 2.51s). Break-even is ~4 on
   cloud and ~5 on local, and nothing in the output tells an agent which server it is on — so
   use 5.
2. **Every command is read-only** (the read-only list in `SKILL.md`). Never batch a mutating
   command: a batch runs blind to the end, so nothing can be checked between steps, a check-in
   or merge can land half-applied mid-batch, and the user gets no stopping point.
3. **No command can prompt.** In shell mode a command that reads standard input reads **the next
   line of the batch** and consumes it as the answer — the "were the inputs consumed?" check is a
   no-op there, so this fails silently and shifts every command after it.
4. **The whole list is known up front.** Batching cannot feed one command's output into the next.
   When step *n+1* depends on reading step *n*, run them plainly.
5. **No command can open a GUI window** (`cm diff` on a bare workspace path, `cm merge` without a
   headless mode). Blocked on a window, it hangs the entire batch, not one command.

## How to run a batch

Write one command per line — **without** the `cm` prefix — and give each its own output file.
End with `exit`.

```
status --header --shelloutputfile=/tmp/uvcs-batch/01.out
log cs:4207 --csformat={changesetid} --shelloutputfile=/tmp/uvcs-batch/02.out
diff cs:4207 --shelloutputfile=/tmp/uvcs-batch/03.out
exit
```

Feed that file to `cm shell`:

| Shell | Command |
|---|---|
| POSIX, cmd | `cm shell < /tmp/uvcs-batch/cmds.txt` |
| PowerShell | `Get-Content /tmp/uvcs-batch/cmds.txt \| cm shell` — `<` there fails with `The '<' operator is reserved for future use.` |

Then read each output file. Its **last line** is `CommandResult <n>` — `0` is success, anything
else is a failure. Everything before that line is the command's output, including its error
message.

- **Create the output directory first.** A missing one fails that command with
  `Error: Could not find a part of the path '<dir>/printer_<guid>.tmp'.`, writes no file, and
  prints the error on the shell's own stdout — where nothing is reading.
- A command that succeeded with **no results still writes its file**, containing only
  `CommandResult 0`. So inside a batch — unlike a plain `cm` command, where empty output is not
  proof of "nothing found" — an empty output plus a zero result *is* that proof.

### Ending the batch

**End of input closes the process**; `exit` is a courtesy. A file with no `exit` line, or one
whose last command failed, still ends `cm shell` cleanly (verified on 11.0.16). Write `exit`
anyway, so a batch fed from a terminal does not sit waiting for more.

So a `cm shell` process still alive after its input ended is **blocked** — on a stdin prompt or a
GUI window, the two things restrictions 3 and 5 keep out of a batch. Kill it; nothing rolls back,
because everything in the batch was read-only.

## Route output to files, never parse the stream

`cm shell` prints `CommandResult <n>` to stdout after every command, which looks like a usable
delimiter and is not one: any command whose *own output* contains such a line desyncs the parse,
and every later command's output is attributed to the wrong command. It is reachable from
ordinary data — a `--format` string, a diff or `cm cat` of a file containing that text, a
changeset comment:

```
$ printf 'find "changeset where changesetid = 234" --nototal --format="CommandResult 0"\nstatus --short\nexit\n' | cm shell
CommandResult 0        <- the command's output
CommandResult 0        <- the real delimiter
...
```

`--shelloutputfile=<path>` removes the hazard: that command's output *and* its `CommandResult`
line go to the file, stdout stays empty, and the result line is always appended **last** — so
reading the final line is unambiguous even when the output ends with a line that mimics it.
Use one file per command, always.

## What changes inside a batch

Every row is a real behavioral difference, not a style preference:

| Plain `cm` | Inside `cm shell` |
|---|---|
| process exit code per command | **the `cm shell` process always exits 0**, whatever failed inside. `$?` / `$LASTEXITCODE` is meaningless — read `CommandResult` |
| errors on stderr | errors go to **stdout** (so, into the output file). `cm shell --enablestderr` splits them, at the cost of having to read two places |
| current directory from the OS shell | `scd <dir>` as a batch line. OS `cd` does not exist inside; a relative path resolves against the directory `cm shell` was started in |
| pipes, globs, `$VAR`, redirection | none — there is no OS shell inside. Use `--format` and `--shelloutputfile` |
| a flag affects one command | `--stack` turns on stack traces for **every later command in the batch** (it flips process-wide client state that is never restored). Never put it in a batch |
| fresh client config per command | one process, one config snapshot. Do not span a config, credential or selector change — end the batch and start a new one |

## Handling failures — keep a batch as safe as N separate commands

- Check the last line of **every** output file, not just the last one. A batch reports each
  command independently; ignoring one is how a silent failure becomes a wrong answer.
- On any non-zero `CommandResult`, re-run **that single command** as a plain `cm` command and use
  its output. Do not reinterpret the batch, and do not retry the whole batch.
- If the number of output files does not match the number of commands, discard the batch and fall
  back to plain commands. Something desynced; a partial batch is not evidence.
- Keep a batch to one logical step (tens of commands, not hundreds). It bounds what one hung
  command costs and keeps the process short-lived.
- `cm fileshell <file>` is **not** a batch runner — it is a different mode that blocks waiting on
  its file. Do not use it.
