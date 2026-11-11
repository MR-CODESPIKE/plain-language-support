'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { scanSymbols, classAtLine, membersOf } = require('../src/lib/symbols');

const SOURCE = [
  'USE "helpers.plain"',
  'EXTERN "plain_ml" FUNCTION plain_nn_create(layers AS any, seed AS int) GIVES any',
  'LET total, count = 0, 1',
  'CLASS Animal',
  '    LET name AS string',
  '    LET legs AS int = 4',
  '    TO NEW n AS string',
  '        LET local = 1',
  '        SET name = n',
  '    END TO',
  '    TO speak GIVES string',
  '        GIVE BACK name',
  '    END TO',
  'END CLASS',
  'CLASS Dog EXTENDS Animal',
  '    TO bark GIVES string',
  '        GIVE BACK "woof"',
  '    END TO',
  'END CLASS',
  'TO TOTALS a AS int GIVES int',
  '    GIVE BACK a',
  'END TO',
].join('\n');

test('declarations are found with their kind, container and extent', () => {
  const symbols = scanSymbols(SOURCE);
  const byName = (name) => symbols.find((s) => s.name === name);
  assert.equal(byName('plain_nn_create').kind, 'extern');
  assert.equal(byName('total').kind, 'variable');
  assert.equal(byName('count').kind, 'variable');
  assert.equal(byName('Animal').kind, 'class');
  assert.equal(byName('Animal').endLine, 13);
  assert.equal(byName('Dog').parent, 'Animal');
  assert.equal(byName('name').kind, 'field');
  assert.equal(byName('name').container, 'Animal');
  assert.equal(byName('legs').detail, 'int');
  assert.equal(byName('NEW').kind, 'method');
  assert.equal(byName('speak').container, 'Animal');
  assert.equal(byName('bark').container, 'Dog');
  assert.equal(byName('TOTALS').kind, 'function');
  assert.equal(byName('TOTALS').character, 3);
  assert.equal(symbols.find((s) => s.name === 'local'), undefined, 'locals are not outline symbols');
});

test('class lookup and inherited members', () => {
  const symbols = scanSymbols(SOURCE);
  assert.equal(classAtLine(symbols, 16).name, 'Dog');
  assert.equal(classAtLine(symbols, 19), undefined);
  const names = membersOf(symbols, 'Dog').map((s) => s.name);
  assert.deepEqual(names, ['bark', 'name', 'legs', 'NEW', 'speak']);
});

test('inheritance cycles do not hang the scanner', () => {
  const symbols = scanSymbols('CLASS A EXTENDS B\nLET x AS int\nEND CLASS\nCLASS B EXTENDS A\nLET y AS int\nEND CLASS');
  assert.ok(membersOf(symbols, 'A').length >= 2);
});

test('the real example programs are scanned without errors', () => {
  const examples = path.join(__dirname, '..', '..', 'plain-ecosystem', 'examples');
  if (!fs.existsSync(examples)) return; // the extension may be packaged on its own
  for (const file of fs.readdirSync(examples).filter((f) => f.endsWith('.plain'))) {
    const symbols = scanSymbols(fs.readFileSync(path.join(examples, file), 'utf8'));
    assert.ok(Array.isArray(symbols), file);
  }
  const oop = scanSymbols(fs.readFileSync(path.join(examples, 'oop.plain'), 'utf8'));
  assert.deepEqual(oop.filter((s) => s.kind === 'class').map((s) => s.name), ['Animal', 'Bird', 'Dog']);
});
