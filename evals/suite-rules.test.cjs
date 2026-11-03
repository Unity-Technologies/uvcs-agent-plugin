// node --test evals/suite-rules.test.cjs   (no API calls; CI runs it before selecting the evals)
//
// The rules from CLAUDE.md, "Writing evals that do not flake", that a machine can check. The
// rest need a measurement, which is the burn-in (run-evals.sh --burn-in).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const EVALS_DIR = __dirname;
const config = yaml.load(fs.readFileSync(path.join(EVALS_DIR, 'promptfooconfig.yaml'), 'utf8'));
const tests = config.tests.flatMap((entry) => {
  const file = entry.replace(/^file:\/\//, '');
  return (yaml.load(fs.readFileSync(path.join(EVALS_DIR, file), 'utf8')) ?? []).map((t) => ({
    ...t,
    where: `${file}: ${t.description}`,
  }));
});
const assertions = tests.flatMap((t) => (t.assert ?? []).map((a) => ({ ...a, where: t.where })));

test('every test has a one-line description no other test uses', () => {
  // CI selects, retries and burns in by description: a shared one merges two tests' rates.
  const seen = new Set();
  for (const t of tests) {
    assert.ok(typeof t.description === 'string' && /^[^\r\n]+$/.test(t.description), t.where);
    assert.ok(!seen.has(t.description), `duplicate description: ${t.where}`);
    seen.add(t.description);
  }
});

test('every test asserts something', () => {
  for (const t of tests) assert.ok((t.assert ?? []).length > 0, t.where);
});

test('a forbidden command is checked on the command lines, not anywhere in the answer', () => {
  // `not-icontains: "--discard"` fails "I will not use --discard". Use commands.cjs:notRun.
  for (const a of assertions.filter((a) => /^not-i?contains$/.test(a.type))) {
    assert.ok(
      !/^\s*(cm\s|-)/i.test(String(a.value)),
      `${a.where}: ${a.type} "${a.value}" — use file://assertions/commands.cjs:notRun`,
    );
  }
});

test('every command check has a pattern that compiles', () => {
  for (const a of assertions.filter((a) => String(a.value).includes('assertions/commands.cjs'))) {
    const pattern = a.config && a.config.pattern;
    assert.ok(typeof pattern === 'string' && pattern.length > 0, `${a.where}: no config.pattern`);
    assert.doesNotThrow(() => new RegExp(pattern, 'i'), a.where);
  }
});

test('a rubric judges behavior, not the explanation', () => {
  // A rubric that requires prose grades what the skill does not teach, and fails a right
  // command with a thin explanation. Name the command or fact instead; say the rest is not judged.
  // "Must explain THAT -1 is not a changeset" names a fact and is fine; "why" grades prose.
  const asksForProse = /\b(must|should)\s+(also\s+)?(explain\s+(why|how)|justify|give\s+(a|the)\s+reason)/i;
  for (const a of assertions.filter((a) => a.type === 'llm-rubric')) {
    assert.ok(!asksForProse.test(String(a.value)), `${a.where}: rubric requires an explanation`);
  }
});
