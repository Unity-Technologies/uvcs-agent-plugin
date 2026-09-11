## What and why

<!-- One or two sentences. Which skill, and what does it now do that it didn't before? -->

## Verification

- **`cm` version verified against:** <!-- output of `cm version` -->
- **Triggering smoke-tested in a second agent:** <!-- only if a skill was added/renamed or its description changed; otherwise N/A -->
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
- [ ] No `cm` syntax duplicated from the `uvcs-core` hub skill.
- [ ] No client-specific tool names, paths, or environment variables in `skills/`.
- [ ] Commands are labelled read-only / mutating / irreversible; user-confirmation policy lives
      in the workflow skills, not the hub.
- [ ] No secrets, internal hostnames, or real user/customer data.
- [ ] Reviewed against the checklist in `CLAUDE.md` and cut anything that didn't earn its tokens.
