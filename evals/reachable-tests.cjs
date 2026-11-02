#!/usr/bin/env node
//
// Which eval tests can a change reach? CI runs only those (CLAUDE.md, "Workflow for changes
// here", step 3), because every test is one independent prompt built from its own `vars`: a
// test whose prompt carries no changed file cannot pass or fail differently because of the
// change. Re-rolling the other ~100 only samples their noise, and that noise used to eject
// README-only pull requests from the merge queue.
//
//   node reachable-tests.cjs <changed path>...     (paths relative to the repository root)
//
// Prints one line:
//   all        a change to what every prompt carries (the config, the runner, an assertion,
//              the workflow, the install): run the whole suite
//   none       nothing any test loads changed: run nothing, and pass
//   <regex>    a `--filter-pattern` matching exactly the reachable tests' descriptions
//
'use strict';

const fs = require('node:fs');
const path = require('node:path');
// promptfoo's own YAML parser, from its pinned install: evals/ has no other dependency.
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

function loadSuite() {
  const config = yaml.load(fs.readFileSync(CONFIG, 'utf8'));
  const defaultVars = config.defaultTest?.vars ?? {};
  return config.tests.flatMap((entry) => {
    const testFile = toRepoPath(path.resolve(EVALS_DIR, entry.replace(/^file:\/\//, '')));
    const tests = yaml.load(fs.readFileSync(path.join(REPO_DIR, testFile), 'utf8')) ?? [];
    return tests.map((test) => ({
      description: test.description,
      testFile,
      // A var the test leaves out is the default's, so the hub SKILL.md reaches every test
      // that does not load another skill.
      loads: new Set(filesNamedIn({ ...defaultVars, ...test.vars, assert: test.assert })),
    }));
  });
}

// What every prompt or every grading carries: the config and the runner (prompt template,
// providers, judge), the assertion modules, the install, this selection, and the workflow.
function reachesEveryTest(changed) {
  return (
    changed === WORKFLOW ||
    (changed.startsWith('evals/') && !changed.startsWith(TEST_FILES_DIR))
  );
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reachableTests(changedPaths, suite) {
  if (changedPaths.some(reachesEveryTest)) return 'all';
  const changed = new Set(changedPaths);
  const reached = suite.filter(
    (test) => changed.has(test.testFile) || [...test.loads].some((file) => changed.has(file)),
  );
  if (reached.length === 0) return 'none';
  const descriptions = [...new Set(reached.map((test) => escapeRegExp(test.description)))];
  return `^(?:${descriptions.join('|')})$`;
}

module.exports = { reachableTests, loadSuite };

if (require.main === module) {
  console.log(reachableTests(process.argv.slice(2), loadSuite()));
}
