// node --test evals/reachable-tests.test.cjs   (no API calls; CI runs it before selecting the evals)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reachableTests, loadSuite } = require('./reachable-tests.cjs');

const suite = [
  {
    description: 'A hub test (default skill)',
    testFile: 'evals/tests/queries.yaml',
    loads: new Set(['skills/uvcs-core/SKILL.md', 'evals/assertions/commands.cjs']),
  },
  {
    description: 'A review test (1/2)',
    testFile: 'evals/tests/code-review.yaml',
    loads: new Set([
      'skills/uvcs-code-review/SKILL.md',
      'skills/uvcs-core/references/reviews-and-merge-requests.md',
    ]),
  },
  {
    description: 'A merge test',
    testFile: 'evals/tests/merge.yaml',
    loads: new Set(['skills/uvcs-merge/SKILL.md']),
  },
];

const selected = (pattern) =>
  suite.map((t) => t.description).filter((d) => new RegExp(pattern).test(d));

test('a change no test loads runs nothing', () => {
  assert.equal(
    reachableTests(['README.md', 'evals/README.md', 'skills/uvcs-merge/scripts/tool.sh'], suite),
    'none',
  );
});

test('an empty change list fails closed: the whole suite', () => {
  assert.equal(reachableTests([], suite), 'all');
});

test('a non-ASCII path is matched as written', () => {
  const accented = [{ description: 'Accented', testFile: 'evals/tests/x.yaml', loads: new Set(['skills/uvcs-core/references/café.md']) }];
  assert.equal(reachableTests(['skills/uvcs-core/references/café.md'], accented), '^(?:Accented)$');
});

test('a skill file runs exactly the tests whose prompt carries it', () => {
  assert.deepEqual(selected(reachableTests(['skills/uvcs-merge/SKILL.md'], suite)), [
    'A merge test',
  ]);
  assert.deepEqual(
    selected(reachableTests(['skills/uvcs-core/references/reviews-and-merge-requests.md'], suite)),
    ['A review test (1/2)'],
  );
});

test('a test file runs the tests in it', () => {
  assert.deepEqual(selected(reachableTests(['evals/tests/queries.yaml'], suite)), [
    'A hub test (default skill)',
  ]);
});

test('descriptions are matched literally, regex characters and all', () => {
  const pattern = reachableTests(['skills/uvcs-code-review/SKILL.md'], suite);
  assert.ok(new RegExp(pattern).test('A review test (1/2)'));
  assert.ok(!new RegExp(pattern).test('A review test 1/2'));
  assert.ok(!new RegExp(pattern).test('A review test (1/2) and more'));
});

test('what every prompt or grading carries runs the whole suite', () => {
  for (const changed of [
    'evals/promptfooconfig.yaml',
    'evals/run-evals.sh',
    'evals/assertions/commands.cjs',
    'evals/package-lock.json',
    'evals/reachable-tests.cjs',
    '.github/workflows/skill-evals.yml',
  ]) {
    assert.equal(reachableTests(['README.md', changed], suite), 'all', changed);
  }
});

test('the real suite: the hub reaches its default-skill tests, the README reaches none', () => {
  const real = loadSuite();
  assert.ok(real.length > 50);
  // One line each: the selection travels as one line of GITHUB_OUTPUT.
  assert.ok(real.every((t) => typeof t.description === 'string' && /^[^\r\n]+$/.test(t.description)));
  assert.equal(reachableTests(['README.md', 'CLAUDE.md'], real), 'none');
  const hub = new RegExp(reachableTests(['skills/uvcs-core/SKILL.md'], real));
  const reached = real.filter((t) => hub.test(t.description));
  assert.ok(reached.some((t) => t.testFile === 'evals/tests/queries.yaml'));
  assert.ok(!reached.some((t) => t.testFile === 'evals/tests/code-review.yaml'));
});
