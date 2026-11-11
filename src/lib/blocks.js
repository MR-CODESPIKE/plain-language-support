'use strict';
// Helpers shared by the formatter and the symbol scanner. They work on plain text (no VS Code API),
// so they can be unit-tested with Node.

/** Words that open a block when they start a line. Plain keywords are case-insensitive. */
const OPENERS = new Set(['IF', 'REPEAT', 'TRY', 'TO', 'CLASS']);

/**
 * Says whether the end of `line` is inside a string literal. Plain strings may contain newlines,
 * `\` escapes the next character, and `#` starts a comment (outside strings).
 */
function endsInString(line, startsInString) {
  let inString = startsInString;
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (inString) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
    } else {
      if (c === '#') break;
      if (c === '"') inString = true;
    }
    i += 1;
  }
  return inString;
}

/**
 * Classifies one source line by its first word:
 * blank, comment, open (IF/REPEAT/TRY/TO/CLASS), close (END), middle (ELSE/CATCH) or other.
 */
function classifyLine(line) {
  if (/^\s*$/.test(line)) return { kind: 'blank', word: '' };
  if (/^\s*#/.test(line)) return { kind: 'comment', word: '' };
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(line);
  const word = match ? match[1].toUpperCase() : '';
  if (word === 'END') return { kind: 'close', word };
  if (word === 'ELSE' || word === 'CATCH') return { kind: 'middle', word };
  if (OPENERS.has(word)) return { kind: 'open', word };
  return { kind: 'other', word };
}

module.exports = { OPENERS, endsInString, classifyLine };
