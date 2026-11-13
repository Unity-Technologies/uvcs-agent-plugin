// Assertions on the text of a comment the response writes for UVCS to store (check-in, shelve,
// review comment, reply) — skills/uvcs-core/references/writing-comments.md.
//
// Like commands.cjs, they read only what the response writes, never its explanation: the prose
// around a comment may well quote "`cs:4207`" to say it is written bare, and a whole-answer
// string check fails exactly the answers that follow the rule.
//
// Usage in a test:
//   - type: javascript
//     value: file://assertions/comments.cjs:bareSpec
//     config: { spec: "cs:4207", noLink: true }   # noLink: no plastic:// or unityhub:// URL either
//
//   - type: javascript
//     value: file://assertions/comments.cjs:unwrappedParagraphs

const OPENING_FENCE = /^\s*(`{3,}|~{3,})/;

// The text of every fenced block, read line by line as CommonMark does: a block closes only on a
// fence of its own character, at least as long, with no info string — so a ```csharp line inside
// a comment's own code does not end the block that shows the comment.
function fenced(output) {
  const kept = [];
  let open = null;
  for (const line of String(output).split('\n')) {
    if (open === null) {
      const fence = OPENING_FENCE.exec(line);
      if (fence) open = fence[1];
      continue;
    }
    const closing = line.trim();
    if (closing[0] === open[0] && closing.length >= open.length && /^(`+|~+)$/.test(closing)) open = null;
    else kept.push(line);
  }
  return kept.join('\n');
}

// The spec is written, and never inside backticks or as a markdown link's text: either way the
// desktop client reads no reference, so it shows no chip. With `noLink`, the object's URL is not
// written next to it either: the spec is the chip, and the URL is a second copy of it.
function bareSpec(output, context) {
  const { spec, noLink } = context.config;
  const text = fenced(output);
  if (!text.includes(spec)) return { pass: false, score: 0, reason: `${spec} is not in any code block` };
  if (text.includes('`' + spec + '`')) return { pass: false, score: 0, reason: `${spec} is in backticks` };
  if (text.includes('[' + spec + '](')) return { pass: false, score: 0, reason: `${spec} is a markdown link` };
  if (noLink && /(plastic|unityhub):\/\//i.test(text)) return { pass: false, score: 0, reason: 'a link is written too' };
  return { pass: true, score: 1, reason: `${spec} is written bare` };
}

// In the first heredoc, no paragraph continues on the next line: the desktop client keeps a
// comment's line breaks, so a wrapped paragraph shows broken mid-sentence. The heredoc is found in
// the whole response, up to its own terminator, so a code fence inside the comment cannot cut it.
// The first line is the title and may run straight into the body; list items, table rows,
// headings, quotes and fences are lines of their own, and code inside a fence is not prose.
const HEREDOC = /<<-?\s*['"]?(\w+)['"]?[^\n]*\n([\s\S]*?)\n\s*\1\s*(?:\n|$)/;
const OWN_LINE = /^(?:[-*+] |\d+\. |\||#|>)/;

function unwrappedParagraphs(output) {
  const heredoc = HEREDOC.exec(String(output));
  if (!heredoc) return { pass: false, score: 0, reason: 'no heredoc writes the comment' };
  const lines = heredoc[2].split('\n').map((line) => line.trim());
  let inFence = false;
  for (let i = 0; i < lines.length - 1; i++) {
    if (OPENING_FENCE.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence || i === 0) continue;
    const next = lines[i + 1];
    if (lines[i] && next && !OWN_LINE.test(next) && !OPENING_FENCE.test(next)) {
      return { pass: false, score: 0, reason: `the paragraph is wrapped after: ${lines[i]}` };
    }
  }
  return { pass: true, score: 1, reason: 'every paragraph is one line' };
}

module.exports = { bareSpec, unwrappedParagraphs };
