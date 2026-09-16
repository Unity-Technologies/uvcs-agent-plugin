<!--
Body of a plugin issue filed from the uvcs-report-issue skill. The headings are the field
labels of the repository's issue forms (.github/ISSUE_TEMPLATE/bug_report.yml and
skill_request.yml), in their order, because GitHub renders a form submission as exactly this
markdown: an agent-filed issue and a form-filed one then look the same in the tracker. Change
the form and this file together. This copy exists because an installed plugin never carries
.github/, and gh issue create posts a markdown body — a YAML form is web-only.

Fill every field; write "unknown" rather than deleting one. Redact first (SKILL.md, step 4).
Use the first body for a bug, the second for an enhancement.
-->

### Which skill

`uvcs-<name>` — `skills/uvcs-<name>/<file>`

### Agent and version

<client and version, or unknown>

### Plugin version

<`version` from `plugin.json`, or the install route>

### cm version

<output of `cm version`>

### OS and shell

<os> / <shell cm ran in>

### What you asked the agent

> <the user's request, verbatim, redacted>

### What the skill says

Quoted from `skills/uvcs-<name>/<file>`:

> <the exact lines the agent followed>

### What the agent did

```
<each command run, followed by its output — trimmed to the relevant part, never paraphrased>
```

### What should have happened

<the correct command or behaviour, and the evidence: `cm help` output, another reference, what
the GUI does>

### Reproduction, as a test

**Skill loaded:** `skills/uvcs-<name>/SKILL.md` (+ `skills/uvcs-core/references/<file>.md`)

**User message:**

> <one request, with the command output it rests on pasted in, and any decision the user made
> stated in it>

**Must contain:** <command or fact>

**Must not contain:** <command or fact>

### Does it also happen in another agent?

yes / no / not tried

---

<!-- Enhancement body: the fields of skill_request.yml. -->

### The workflow

<what the user needed an agent to do with UVCS, and which skill it fits — or `[new skill]`>

### How you do it today

```
<the cm commands actually run, in order, verified against cm version <x>>
```

### Gotchas

<flags, quoting, platform differences, error messages and their fix — or "none seen">

### What an agent gets wrong without help

<what the agent did instead, quoted from the session, redacted>
