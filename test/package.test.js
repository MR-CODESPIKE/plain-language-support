'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));

const toRegExp = (pattern) => new RegExp(pattern.replace(/\(\?i:/g, '(?:'), 'i');

test('the manifest points at files that exist', () => {
  assert.ok(fs.existsSync(path.join(root, pkg.main)));
  const contributed = [pkg.contributes.languages[0].configuration, pkg.contributes.grammars[0].path, pkg.contributes.snippets[0].path];
  for (const file of contributed) assert.ok(fs.existsSync(path.join(root, file)), file);
  assert.ok(fs.existsSync(path.join(root, 'LICENSE.txt')));
});

test('only .plain is associated with the language', () => {
  assert.deepEqual(pkg.contributes.languages[0].extensions, ['.plain']);
  assert.deepEqual(pkg.activationEvents, ['onLanguage:plain']);
});

test('the changelog and readme describe this version', () => {
  assert.match(read('CHANGELOG.md'), new RegExp('^# Changelog\\s+## ' + pkg.version.replace(/\./g, '\\.'), 'm'));
  assert.ok(read('README.md').includes('plain-language-support-' + pkg.version + '.vsix'));
});

test('every setting the code reads is declared', () => {
  const declared = Object.keys(pkg.contributes.configuration.properties);
  const code = read('src/extension.js');
  for (const key of ['compilerPath', 'checkOnOpen', 'checkOnSave']) {
    assert.ok(code.includes("'" + key + "'") || code.includes('get(\'' + key + '\')'), key + ' is used');
    assert.ok(declared.includes('plain.' + key), 'plain.' + key + ' is declared');
  }
});

test('snippets are well formed', () => {
  const snippets = JSON.parse(read('snippets/plain.json'));
  const prefixes = new Set();
  for (const [name, snippet] of Object.entries(snippets)) {
    assert.ok(snippet.prefix && snippet.description && Array.isArray(snippet.body), name);
    assert.ok(!prefixes.has(snippet.prefix), 'duplicate prefix ' + snippet.prefix);
    prefixes.add(snippet.prefix);
    const body = snippet.body.join('\n');
    assert.ok((body.match(/\$0/g) || []).length <= 1, name + ': at most one $0');
    let depth = 0;
    for (const c of body) {
      if (c === '{') depth += 1;
      if (c === '}') depth -= 1;
      assert.ok(depth >= 0, name + ': unbalanced braces');
    }
  }
  assert.ok(prefixes.has('class') && prefixes.has('classx') && prefixes.has('nn'));
});

test('indentation rules treat blocks the way the formatter does', () => {
  const rules = JSON.parse(read('language-configuration.json')).indentationRules;
  const increase = toRegExp(rules.increaseIndentPattern);
  const decrease = toRegExp(rules.decreaseIndentPattern);
  for (const line of ['IF x > 1', 'IF x > 1 THEN', '  ELSE IF y', 'ELSE', 'CLASS A EXTENDS B', 'REPEAT i FROM 1 TO 3', 'TRY', 'TO f a AS int', 'CATCH e']) assert.ok(increase.test(line), 'should indent after: ' + line);
  for (const line of ['SAY 1', 'END IF', 'LET x = 1']) assert.ok(!increase.test(line), 'should not indent after: ' + line);
  for (const line of ['END IF', 'END TO', 'ELSE', 'CATCH e']) assert.ok(decrease.test(line), 'should dedent: ' + line);
  assert.ok(!decrease.test('SAY 1'));
});

test('the built-in list used for completion and hover is complete', () => {
  const builtins = JSON.parse(read('src/builtins.json'));
  assert.ok(builtins.length >= 60);
  const names = new Set();
  for (const entry of builtins) {
    assert.match(entry.name, /^[A-Z][A-Z0-9_]*$/);
    assert.ok(entry.signature.startsWith(entry.name + '('), entry.name);
    assert.ok(entry.example.includes(entry.name), entry.name + ' needs an example that uses it');
    assert.ok(entry.description.length > 10 && entry.returns && entry.category, entry.name);
    assert.ok(!names.has(entry.name), 'duplicate ' + entry.name);
    names.add(entry.name);
  }
});
