'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { render } = require('../tools/sync-grammar');
const { KEYWORD_DOCS, builtinList, TYPES } = require('../src/lib/docs');

const grammarPath = path.join(__dirname, '..', 'syntaxes', 'plain.tmLanguage.json');
const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));

/** Oniguruma's (?i) and (?i:...) are translated for JavaScript's RegExp (enough for these patterns). */
function toRegExp(pattern) {
  const insensitive = pattern.startsWith('(?i)') || pattern.includes('(?i:');
  return new RegExp(pattern.replace(/^\(\?i\)/, '').replace(/\(\?i:/g, '(?:'), insensitive ? 'gi' : 'g');
}

const rule = (name, index) => toRegExp(grammar.repository[name].patterns[index || 0].match);
const matches = (regex, text) => {
  regex.lastIndex = 0;
  return [...text.matchAll(regex)];
};

test('the committed grammar is what the generator produces', () => {
  assert.equal(fs.readFileSync(grammarPath, 'utf8'), render(), 'run `npm run sync` to regenerate the grammar');
});

test('every keyword is highlighted, in any letter case, as a whole word only', () => {
  const keywordRule = rule('keywords', 0);
  for (const keyword of Object.keys(KEYWORD_DOCS)) {
    if (['TRUE', 'FALSE', 'SUPER'].includes(keyword)) continue;
    assert.equal(matches(keywordRule, keyword.toLowerCase()).length, 1, keyword);
    assert.equal(matches(keywordRule, keyword).length, 1, keyword);
  }
  assert.equal(matches(keywordRule, 'isolated thing_to').length, 0, 'identifiers that merely contain a keyword are not keywords');
  assert.equal(matches(rule('keywords', 1), 'true False').length, 2);
  assert.equal(matches(rule('selfAndSuper'), 'self.name SUPER.NEW(n)').length, 2);
});

test('every built-in function is highlighted and nothing else', () => {
  const builtinRule = rule('builtins');
  assert.ok(builtinList.length >= 60);
  for (const entry of builtinList) {
    const found = matches(builtinRule, entry.name + '(1)');
    assert.equal(found.length, 1, entry.name);
    assert.equal(found[0][0], entry.name);
  }
  assert.equal(matches(builtinRule, 'trim(1) MyTRIM(1) TRIMMED').length, 0, 'built-ins are upper case and whole words');
});

test('types are highlighted', () => {
  assert.equal(matches(rule('types'), TYPES.join(' ')).length, TYPES.length);
});

test('function and class declarations are captured', () => {
  const declaration = rule('declarations', 0);
  assert.equal(matches(declaration, 'TO add a AS int')[0][2], 'add');
  assert.equal(matches(declaration, '    to NEW n AS string')[0][2], 'NEW');
  assert.equal(matches(declaration, 'REPEAT i FROM 1 TO n').length, 0, 'TO inside a REPEAT is not a function');
  const classes = rule('declarations', 1);
  assert.deepEqual(matches(classes, 'CLASS Dog EXTENDS Animal').map((m) => m[2]), ['Dog', 'Animal']);
  assert.equal(matches(classes, 'LET pet = NEW Dog("Rex")')[0][2], 'Dog');
  assert.equal(matches(classes, 'SAY pet IS Animal')[0][2], 'Animal');
});

test('the top-level pattern list includes every rule', () => {
  const included = grammar.patterns.map((p) => p.include.replace('#', ''));
  for (const name of Object.keys(grammar.repository)) assert.ok(included.includes(name), name + ' is defined but never used');
});
