'use strict';
const { endsInString, classifyLine } = require('./blocks');

/**
 * Re-indents Plain source: every block (IF, REPEAT, TRY, TO, CLASS) is indented one level,
 * ELSE and CATCH sit at the level of their opener, END closes the block.
 * Only leading whitespace and trailing whitespace change; text inside multi-line strings is untouched.
 * Formatting twice gives the same result.
 */
function formatText(text, options) {
  const settings = options || {};
  const unit = settings.insertSpaces === false ? '\t' : ' '.repeat(settings.tabSize > 0 ? settings.tabSize : 4);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const out = [];
  let depth = 0;
  let inString = false;
  for (const line of text.split(/\r?\n/)) {
    if (inString) {
      out.push(line);
      inString = endsInString(line, true);
      continue;
    }
    const content = line.replace(/^[ \t]+/, '');
    const stillInString = endsInString(content, false);
    const body = stillInString ? content : content.replace(/[ \t]+$/, '');
    const info = classifyLine(body);
    if (info.kind === 'blank') {
      out.push('');
      continue;
    }
    let level = depth;
    if (info.kind === 'close') {
      depth = Math.max(0, depth - 1);
      level = depth;
    } else if (info.kind === 'middle') {
      level = Math.max(0, depth - 1);
    }
    out.push(unit.repeat(level) + body);
    if (info.kind === 'open') depth += 1;
    inString = stillInString;
  }
  return out.join(eol);
}

module.exports = { formatText };
