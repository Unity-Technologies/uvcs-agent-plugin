---
name: code-review-rules
description: >-
  This project's code review rules. Read by the uvcs-code-review skill and merged into its
  general review rules whenever it reviews changes in this project — these rules win where the
  two conflict. Not a review workflow on its own.
---

# Code review rules for <project>

Only what a reviewer cannot infer from the code. Delete every section you do not need; an empty
section costs tokens and teaches nothing.

## Never accept

- <a rule whose violation is always a BLOCKER — e.g. "Blocking I/O on the main thread">
- <e.g. "A public API change without a corresponding entry in `docs/api/`">

## Always check

- <something the diff will not show and the reviewer must look up — e.g. "Every new
  `ScriptableObject` field has a default that survives an old serialized asset">
- <e.g. "A migration is reversible and has a `down` step">

## Conventions that count as findings

- <a style or naming rule that no formatter enforces — e.g. "Async methods end in `Async`">
- <e.g. "Log messages are English, no trailing period, no user data">

## Out of scope

- <what reviewers must not comment on — e.g. "Generated code under `Gen/`", "Unity `.meta` files">

## Severity scheme

<Delete this section to keep BLOCKER / IMPORTANT / SUGGESTION / NIT. Otherwise list your names,
in descending order, each with one line on what puts a finding there; the id letter is the
initial.>
