'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCompilerOutput, rangeFor } = require('../src/lib/diagnostics');

// Exactly the layout of Source::diagnostic in compiler/src/source.rs.
const compilerError = (file, line, column, message, code) =>
  `error: ${message}\n  --> ${file}:${line}:${column}\n   |\n${String(line).padStart(3)} | ${code}\n   | ${' '.repeat(column - 1)}^\n`;

test('the compiler diagnostic format is parsed', () => {
  const found = parseCompilerOutput(compilerError('/work/a.plain', 4, 9, 'unknown variable `inner`', 'SAY inner'), '/work/a.plain');
  assert.equal(found.length, 1);
  assert.deepEqual({ message: found[0].message, line: found[0].line, column: found[0].column, sameFile: found[0].sameFile }, { message: 'unknown variable `inner`', line: 4, column: 9, sameFile: true });
});

test('errors in other files are flagged so they can be shown on the importing file', () => {
  const found = parseCompilerOutput(compilerError('/work/lib/helpers.plain', 2, 1, 'duplicate function `twice`', 'TO twice'), '/work/a.plain');
  assert.equal(found[0].sameFile, false);
  assert.equal(found[0].file, '/work/lib/helpers.plain');
});

test('text that is not in the diagnostic format still becomes one problem', () => {
  const found = parseCompilerOutput('cannot open /missing.plain: No such file or directory (os error 2)\n', '/work/a.plain');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /cannot open/);
  assert.equal(found[0].line, 1);
  assert.deepEqual(parseCompilerOutput('', '/work/a.plain'), []);
});

test('columns count UTF-8 bytes and the range covers the whole token', () => {
  assert.deepEqual(rangeFor('SAY inner', 5), { start: 4, end: 9 });
  assert.deepEqual(rangeFor('x = (1', 5), { start: 4, end: 5 }); // punctuation: one character
  // "é" is two bytes, so byte column 8 is character index 6 in `SAY "é" + bad`.
  assert.deepEqual(rangeFor('SAY "é" + bad', 12), { start: 10, end: 13 });
  assert.deepEqual(rangeFor('abc', 99), { start: 3, end: 3 }); // past the end of the line
});
