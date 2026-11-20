// Assertions on the commands a response *runs*, as opposed to the words it uses.
//
// A plain `not-icontains: "--discard"` fails a correct answer that says "I will not use
// --discard", and the better the model, the more it explains itself — so string checks on the
// whole response grow less reliable as models improve. These helpers look only at the command
// lines inside fenced code blocks, which is where the prompt template tells the model to put
// every command it would run.
//
// Usage in a test:
//   - type: javascript
//     value: file://assertions/commands.cjs:notRun
//     config: { pattern: "cm mr review \\d+ --re-request" }
//
// `pattern` is a case-insensitive regular expression matched against each command line.

const FENCE = /```[^\n]*\n([\s\S]*?)```/g;

// Unescaped double quotes; an odd count leaves a quoted argument open at the end of the line.
const openQuote = (s) => (s.replace(/\\./g, '').match(/"/g) || []).length % 2 === 1;

function commandLines(output) {
  const lines = [];
  for (const [, body] of String(output).matchAll(FENCE)) {
    // Join shell line continuations so a flag on the next line belongs to its command.
    const raw = body.replace(/\\\n\s*/g, ' ').split('\n');
    for (let i = 0; i < raw.length; i++) {
      let line = raw[i];
      // `cm mr comment add 311 -c="[Q1] …<newline>…" --type=Question` is one command: keep the
      // flags after a multi-line quoted argument on its line. Only for a cm/gh line, so an
      // apostrophe-free stray quote in a heredoc body cannot swallow the commands after it.
      if (/^\s*(?:\$\s+)?(?:cm|gh)\s/.test(line)) {
        while (openQuote(line) && i + 1 < raw.length) line += ' ' + raw[++i];
      }
      line = line
        .replace(/^\s*(?:\$|>|PS>)\s+/, '') // prompt markers
        .replace(/\s+#\s.*$/, '') // trailing shell comment
        .trim();
      if (line && !line.startsWith('#') && !line.startsWith('//')) lines.push(line);
    }
  }
  return lines;
}

function matcher(context) {
  const pattern = context && context.config && context.config.pattern;
  if (!pattern) throw new Error('commands.cjs: set config.pattern on the assertion');
  return new RegExp(pattern, 'i');
}

// Passes when no command line matches the pattern.
function notRun(output, context) {
  const re = matcher(context);
  const hits = commandLines(output).filter((l) => re.test(l));
  return hits.length === 0
    ? { pass: true, score: 1, reason: `No command matches /${re.source}/` }
    : { pass: false, score: 0, reason: `Runs a forbidden command: ${hits.join(' | ')}` };
}

// Passes when at least one command line matches the pattern.
function runs(output, context) {
  const re = matcher(context);
  const lines = commandLines(output);
  const hit = lines.find((l) => re.test(l));
  return hit
    ? { pass: true, score: 1, reason: `Runs: ${hit}` }
    : { pass: false, score: 0, reason: `No command matches /${re.source}/ (${lines.length} command lines)` };
}

// Passes unless a command line matching `pattern` comes before the last one matching
// `config.after` — "no re-request until the last check-in". With no `after` line at all, any
// match fails. For an order rule, where notRun would also fail a right answer that lists the
// command as the last step.
function onlyAfter(output, context) {
  const re = matcher(context);
  const after = new RegExp(context.config.after, 'i');
  const lines = commandLines(output);
  const last = lines.map((l) => after.test(l)).lastIndexOf(true);
  const early = lines.filter((l, i) => re.test(l) && i < last);
  const orphan = last === -1 ? lines.filter((l) => re.test(l)) : [];
  const bad = [...early, ...orphan];
  return bad.length === 0
    ? { pass: true, score: 1, reason: `No /${re.source}/ before the last /${after.source}/` }
    : { pass: false, score: 0, reason: `Runs too early: ${bad.join(' | ')}` };
}

module.exports = { notRun, runs, onlyAfter, commandLines };
