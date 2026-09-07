## What and why

<!-- One or two sentences. Which skill, and what does it now do that it didn't before? -->

## Verification

- **`cm` version verified against:** <!-- output of `cm version` -->
- **Agents tested in:** <!-- e.g. Claude Code 2.x, Codex CLI, Cursor — at least two for non-trivial changes -->
- **Format validated:** `skills-ref validate ./skills/<name>` <!-- paste result, or N/A -->

## Transcript

<!--
Paste a short transcript of the skill doing the thing (trimmed, anonymized).
This is the real review artifact.
-->

## Checklist

- [ ] Every `cm` command was run against a real CLI — none invented or remembered.
- [ ] `name` in frontmatter matches the skill directory name.
- [ ] `description` says what + when, uses real user vocabulary, and does not overlap a sibling skill.
- [ ] `SKILL.md` is well under 500 lines; detail lives in `references/`.
- [ ] No `cm` syntax duplicated from the `uvcs-cm` hub skill.
- [ ] No client-specific tool names, paths, or environment variables in `skills/`.
- [ ] Mutating commands are labelled and require user confirmation.
- [ ] No secrets, internal hostnames, or real user/customer data.
- [ ] Reviewed against the checklist in `CLAUDE.md` and cut anything that didn't earn its tokens.
