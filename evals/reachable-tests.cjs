#!/usr/bin/env node
//
// Which eval tests can a change reach? CI runs only those (CLAUDE.md, "Workflow for changes
// here", step 3), because every test is one independent prompt built from its own `vars`: a
// test whose prompt carries no changed file cannot pass or fail differently because of the
// change. Re-rolling the other ~100 only samples their noise, and that noise used to eject
// README-only pull requests from the merge queue.
//
//   node reachable-tests.cjs <changed path>...     (paths relative to the repository root)
//   node reachable-tests.cjs --edited-since <rev>  tests added or edited since <rev>
//
// Prints one line:
//   all        a change to what every prompt carries (the config, the runner, an assertion,
//              the workflow, the install), or no changed path at all — a diff that came back
//              empty is more likely a failed diff than an empty change, so it fails closed
//   none       nothing any test loads changed: run nothing, and pass
//   <regex>    a `--filter-pattern` matching exactly the reachable tests' descriptions
//
// --edited-since prints `none` or the regex of the tests whose definition is new or differs
// from <rev>'s. CI burns those in (run-evals.sh --burn-in) even on a whole-suite run, so a
// scenario without margin is caught on the pull request that writes it, not in the queue.
//
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
// Declared in evals/package.json; the same version promptfoo uses, so it adds no install.
const yaml = require('js-yaml');

const EVALS_DIR = __dirname;
const REPO_DIR = path.dirname(EVALS_DIR);
const CONFIG = path.join(EVALS_DIR, 'promptfooconfig.yaml');
const WORKFLOW = '.github/workflows/skill-evals.yml';
const TEST_FILES_DIR = 'evals/tests/';

function toRepoPath(absolute) {
  return path.relative(REPO_DIR, absolute).split(path.sep).join('/');
}

// Every `file://` a value names, as a repository path. Test files resolve them against evals/,
// as promptfoo does; `file://x.cjs:fn` names a function in x.cjs.
function filesNamedIn(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return [...text.matchAll(/file:\/\/([^\s"':]+)/g)].map((m) =>
    toRepoPath(path.resolve(EVALS_DIR, m[1])),
  );
}

const readWorkingTree = (repoPath) => fs.readFileSync(path.join(REPO_DIR, repoPath), 'utf8');

// A file as it was at <rev>; a file that did not exist then has no tests.
const readAt = (rev) => (repoPath) => {
  try {
    return execFileSync('git', ['show', `${rev}:${repoPath}`], {
      cwd: REPO_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20,
    });
  } catch {
    return '';
  }
};

// The test files are the working tree's list either way: a test file new since <rev> reads
// as empty there, so every test in it counts as added.
function loadSuite(read = readWorkingTree) {
  const config = yaml.load(fs.readFileSync(CONFIG, 'utf8'));
  const defaultTest = config.defaultTest ?? {};
  return config.tests.flatMap((entry) => {
    const testFile = toRepoPath(path.resolve(EVALS_DIR, entry.replace(/^file:\/\//, '')));
    const tests = yaml.load(read(testFile)) ?? [];
    return tests.map((test) => ({
      description: test.description,
      testFile,
      definition: JSON.stringify(test),
      // A var the test leaves out is the default's, so the hub SKILL.md reaches every test
      // that does not load another skill. The whole test is scanned, not only vars and
      // assert: a file named anywhere in it (a transform, a provider) is one it loads.
      loads: new Set(
        filesNamedIn({ ...defaultTest, ...test, vars: { ...defaultTest.vars, ...test.vars } }),
      ),
    }));
  });
}

// What every prompt or every grading carries: the config and the runner (prompt template,
// providers, judge), the assertion modules, the install, this selection, and the workflow.
// Not evals/ docs, which no prompt carries.
function reachesEveryTest(changed) {
  return (
    changed === WORKFLOW ||
    (changed.startsWith('evals/') && !changed.startsWith(TEST_FILES_DIR) && !changed.endsWith('.md'))
  );
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reachableTests(changedPaths, suite) {
  if (changedPaths.length === 0 || changedPaths.some(reachesEveryTest)) return 'all';
  const changed = new Set(changedPaths);
  const reached = suite.filter(
    (test) => changed.has(test.testFile) || [...test.loads].some((file) => changed.has(file)),
  );
  return patternFor(reached);
}

function patternFor(tests) {
  if (tests.length === 0) return 'none';
  const descriptions = [...new Set(tests.map((test) => escapeRegExp(test.description)))];
  return `^(?:${descriptions.join('|')})$`;
}

// Tests whose definition is new or changed. Matched by description, so a renamed test is new.
function editedTests(baseSuite, headSuite) {
  const before = new Map(baseSuite.map((test) => [test.description, test.definition]));
  return patternFor(headSuite.filter((test) => before.get(test.description) !== test.definition));
}

module.exports = { reachableTests, editedTests, loadSuite };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--edited-since') {
    if (!args[1]) throw new Error('--edited-since needs a revision');
    console.log(editedTests(loadSuite(readAt(args[1])), loadSuite()));
  } else {
    console.log(reachableTests(args, loadSuite()));
  }
}
