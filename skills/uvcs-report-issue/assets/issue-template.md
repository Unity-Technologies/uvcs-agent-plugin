<!--
Body of a plugin issue filed from the uvcs-report-issue skill. Fill every section; write
"unknown" rather than deleting one. Redact before filing (SKILL.md, step 4). For an
enhancement, "What happened" is what the agent did without the recipe, and "What should have
happened" is the recipe or workflow itself: the cm commands actually run, in order, verified.
-->

**Skill:** `uvcs-<name>` — `skills/uvcs-<name>/<file>`
**Kind:** bug | enhancement

## Environment

| | |
|---|---|
| Agent | <client and version, or unknown> |
| Plugin | <`version` from `plugin.json`, or install route> |
| cm | <output of `cm version`> |
| OS / shell | <os> / <shell cm ran in> |
| Also seen in another agent | yes / no / not tried |

## What was asked

> <the user's request, verbatim, redacted>

## What the skill says

Quoted from `skills/uvcs-<name>/<file>`:

> <the exact lines the agent followed>

## What happened

```
<each command run, followed by its output — trimmed to the relevant part, never paraphrased>
```

## What should have happened

<the correct command or behaviour, and the evidence: `cm help` output, another reference, what
the GUI does>

## Reproduction (eval shape)

**Skill loaded:** `skills/uvcs-<name>/SKILL.md` (+ `skills/uvcs-core/references/<file>.md`)

**User message:**

> <one request, with the command output it rests on pasted in, and any decision the user made
> stated in it>

**Must contain:** <command or fact>

**Must not contain:** <command or fact>
