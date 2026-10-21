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

function commandLines(output) {
  const lines = [];
  for (const [, body] of String(output).matchAll(FENCE)) {
    // Join shell line continuations so a flag on the next line belongs to its command.
    for (let line of body.replace(/\\\n\s*/g, ' ').split('\n')) {
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

module.exports = { notRun, runs, commandLines };
