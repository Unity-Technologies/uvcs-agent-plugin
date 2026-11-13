// Assertions on the text of a comment the response writes for UVCS to store (check-in, shelve,
// review comment, reply) — skills/uvcs-core/references/writing-comments.md.
//
// Like commands.cjs, they read only the fenced code blocks, where the template puts the comment
// file and the command: the explanation around them may well quote "`cs:4207`" to say it is
// written bare, and a whole-answer string check fails exactly the answers that follow the rule.
//
// Usage in a test:
//   - type: javascript
//     value: file://assertions/comments.cjs:bareSpec
//     config: { spec: "cs:4207" }
//
//   - type: javascript
//     value: file://assertions/comments.cjs:unwrappedParagraphs

const FENCE = /```[^\n]*\n([\s\S]*?)```/g;
const fenced = (output) => [...String(output).matchAll(FENCE)].map((m) => m[1]).join('\n');

// The spec is written, and never inside backticks or as a markdown link's text: either way the
// desktop client reads no reference, so it shows no chip.
function bareSpec(output, context) {
  const spec = context.config.spec;
  const text = fenced(output);
  if (!text.includes(spec)) return { pass: false, score: 0, reason: `${spec} is not in any code block` };
  if (text.includes('`' + spec + '`')) return { pass: false, score: 0, reason: `${spec} is in backticks` };
  if (text.includes('[' + spec + '](')) return { pass: false, score: 0, reason: `${spec} is a markdown link` };
  return { pass: true, score: 1, reason: `${spec} is written bare` };
}

// In the first heredoc, no paragraph continues on the next line: the desktop client keeps a
// comment's line breaks, so a wrapped paragraph shows broken mid-sentence. The first line is the
// title and may run straight into the body; list items, table rows and fences are their own lines.
const HEREDOC = /<<-?\s*['"]?(\w+)['"]?[^\n]*\n([\s\S]*?)\n\s*\1\s*(?:\n|$)/;
const OWN_LINE = /^(?:[-*+] |\d+\. |\||```)/;

function unwrappedParagraphs(output) {
  const heredoc = HEREDOC.exec(fenced(output));
  if (!heredoc) return { pass: false, score: 0, reason: 'no heredoc writes the comment' };
  const lines = heredoc[2].split('\n').map((line) => line.trim());
  for (let i = 1; i < lines.length - 1; i++) {
    if (lines[i] && lines[i + 1] && !OWN_LINE.test(lines[i + 1])) {
      return { pass: false, score: 0, reason: `the paragraph is wrapped after: ${lines[i]}` };
    }
  }
  return { pass: true, score: 1, reason: 'every paragraph is one line' };
}

module.exports = { bareSpec, unwrappedParagraphs };
