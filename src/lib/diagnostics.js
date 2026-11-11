'use strict';
const fs = require('fs');
const path = require('path');

function realPath(p) {
  try {
    return fs.realpathSync(p);
  } catch (e) {
    return path.resolve(p);
  }
}

function samePath(a, b) {
  const x = realPath(a);
  const y = realPath(b);
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/**
 * Parses what `plain check` prints on failure. The compiler's format is
 *   error: <message>
 *     --> <file>:<line>:<column>
 * Returns [{ message, file, line, column, sameFile }] with 1-based line and column.
 * Any other failure text becomes one diagnostic at line 1.
 */
function parseCompilerOutput(output, documentPath) {
  const results = [];
  const pattern = /error: ([^\r\n]*)\r?\n\s*--> ([^\r\n]*?):(\d+):(\d+)/g;
  let match = pattern.exec(output);
  while (match !== null) {
    results.push({
      message: match[1],
      file: match[2],
      line: Math.max(1, Number(match[3])),
      column: Math.max(1, Number(match[4])),
      sameFile: samePath(match[2], documentPath),
    });
    match = pattern.exec(output);
  }
  if (results.length === 0) {
    const text = output.trim();
    if (text.length > 0) {
      results.push({ message: text.split(/\r?\n/)[0], file: documentPath, line: 1, column: 1, sameFile: true });
    }
  }
  return results;
}

/**
 * Converts the compiler's column (counted in UTF-8 bytes) to a UTF-16 index and finds the end of the
 * identifier or number at that position, so the squiggle covers the offending token.
 */
function rangeFor(lineText, column) {
  const bytes = Buffer.from(lineText, 'utf8');
  const start = Buffer.from(bytes.subarray(0, Math.max(0, column - 1))).toString('utf8').length;
  const clamped = Math.min(start, lineText.length);
  const word = /^[A-Za-z0-9_]+/.exec(lineText.slice(clamped));
  const end = word ? clamped + word[0].length : Math.min(lineText.length, clamped + 1);
  return { start: clamped, end: Math.max(end, clamped) };
}

module.exports = { parseCompilerOutput, rangeFor, samePath };
