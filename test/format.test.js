'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatText } = require('../src/lib/format');

test('blocks are indented, ELSE and CATCH sit at their opener, END closes', () => {
  const messy = ['IF x > 1 THEN', 'SAY 1', 'ELSE IF x = 0 THEN', 'SAY 2', 'ELSE', 'SAY 3', 'END IF', 'TRY', 'LET a = 1', 'CATCH e', 'SAY e', 'END TRY'].join('\n');
  assert.equal(
    formatText(messy),
    ['IF x > 1 THEN', '    SAY 1', 'ELSE IF x = 0 THEN', '    SAY 2', 'ELSE', '    SAY 3', 'END IF', 'TRY', '    LET a = 1', 'CATCH e', '    SAY e', 'END TRY'].join('\n')
  );
});

test('classes, methods and loops nest', () => {
  const source = ['CLASS A', 'LET n AS int', 'TO NEW', 'SET n = 1', 'END TO', 'TO get GIVES int', 'REPEAT i FROM 1 TO 3', 'IF i = 2 THEN', 'GIVE BACK i', 'END IF', 'END REPEAT', 'GIVE BACK n', 'END TO', 'END CLASS'].join('\n');
  const expected = ['CLASS A', '    LET n AS int', '    TO NEW', '        SET n = 1', '    END TO', '    TO get GIVES int', '        REPEAT i FROM 1 TO 3', '            IF i = 2 THEN', '                GIVE BACK i', '            END IF', '        END REPEAT', '        GIVE BACK n', '    END TO', 'END CLASS'].join('\n');
  assert.equal(formatText(source), expected);
});

test('keywords are case-insensitive and a TO inside REPEAT is not a function', () => {
  assert.equal(formatText('if x then\nrepeat i from 1 to 3\nsay i\nend repeat\nend if'), 'if x then\n    repeat i from 1 to 3\n        say i\n    end repeat\nend if');
});

test('formatting is idempotent and keeps comments, blank lines and the end-of-line style', () => {
  const source = 'IF TRUE THEN\r\n# note\r\n\r\n   SAY 1   \r\nEND IF\r\n';
  const once = formatText(source);
  assert.equal(once, 'IF TRUE THEN\r\n    # note\r\n\r\n    SAY 1\r\nEND IF\r\n');
  assert.equal(formatText(once), once);
});

test('text inside a multi-line string is left alone', () => {
  const source = 'IF TRUE THEN\nSAY "line one\n   keep   this  \nEND"\nEND IF';
  assert.equal(formatText(source), 'IF TRUE THEN\n    SAY "line one\n   keep   this  \nEND"\nEND IF');
});

test('a # inside a string does not start a comment, and quotes in comments are ignored', () => {
  const source = 'SAY "a # b"\n# it\'s "fine\nIF TRUE THEN\nSAY 1\nEND IF';
  assert.equal(formatText(source), 'SAY "a # b"\n# it\'s "fine\nIF TRUE THEN\n    SAY 1\nEND IF');
});

test('tab and width options are honoured and unbalanced END does not go negative', () => {
  assert.equal(formatText('IF x THEN\nSAY 1\nEND IF', { insertSpaces: false }), 'IF x THEN\n\tSAY 1\nEND IF');
  assert.equal(formatText('IF x THEN\nSAY 1\nEND IF', { insertSpaces: true, tabSize: 2 }), 'IF x THEN\n  SAY 1\nEND IF');
  assert.equal(formatText('END IF\nSAY 1'), 'END IF\nSAY 1');
});
