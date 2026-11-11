'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('child_process');
const { install, fakeDocument } = require('./vscode-mock');

const env = install();
delete require.cache[require.resolve('../src/extension')];
const extension = require('../src/extension');
const { vscode, registry } = env;
const originalExecFile = childProcess.execFile;
test.after(() => {
  childProcess.execFile = originalExecFile;
  env.uninstall();
});

const context = { subscriptions: [] };
extension.activate(context);
const api = extension.internals;

const CLASS_SOURCE = [
  'CLASS Animal',
  '    LET name AS string',
  '    TO NEW n AS string',
  '        SET name = n',
  '    END TO',
  '    TO speak GIVES string',
  '        self.',
  '    END TO',
  'END CLASS',
  'CLASS Dog EXTENDS Animal',
  '    TO bark GIVES string',
  '        SUPER.',
  '    END TO',
  'END CLASS',
  'TO TOTALS a AS int GIVES int',
  '    GIVE BACK a',
  'END TO',
  'LET value = 1',
  '',
  'LET kind AS ',
].join('\n');

const labels = (items) => items.map((i) => i.label);

test('activation registers every provider and command', () => {
  for (const name of ['completion', 'hover', 'definition', 'symbols', 'formatting']) assert.ok(registry.providers[name], name);
  assert.deepEqual(registry.providers.completion.triggers, ['.']);
  assert.deepEqual(registry.providers.formatting.selector, { language: 'plain' });
  assert.ok(registry.commands['plain.runFile'] && registry.commands['plain.checkFile']);
  assert.ok(registry.listeners.open && registry.listeners.save && registry.listeners.close);
  assert.ok(context.subscriptions.length >= 10);
  const pkg = require('../package.json');
  for (const command of pkg.contributes.commands) assert.ok(registry.commands[command.command], command.command + ' has a handler');
});

test('completion offers keywords, built-ins with placeholders, and your declarations', () => {
  const doc = fakeDocument(CLASS_SOURCE);
  const items = api.completionItems(doc, new vscode.Position(17, 0));
  const names = labels(items);
  for (const expected of ['LET', 'REPEAT', 'SUPER', 'TRIM', 'JSON_DECODE', 'Animal', 'TOTALS', 'value']) assert.ok(names.includes(expected), expected);
  const trim = items.find((i) => i.label === 'TRIM');
  assert.equal(trim.insertText.value, 'TRIM(${1:text})');
  assert.equal(items.find((i) => i.label === 'PI').insertText.value, 'PI()');
  assert.ok(!names.includes('speak'), 'methods are only offered after a dot');
});

test('self. and SUPER. complete with the right members', () => {
  const doc = fakeDocument(CLASS_SOURCE);
  const own = labels(api.completionItems(doc, new vscode.Position(6, 13)));
  assert.deepEqual(own.sort(), ['NEW', 'name', 'speak']);
  const inherited = labels(api.completionItems(doc, new vscode.Position(11, 14)));
  assert.deepEqual(inherited.sort(), ['NEW', 'name', 'speak']);
  const anyObject = fakeDocument(CLASS_SOURCE.replace('        self.', '        pet.'));
  assert.ok(labels(api.completionItems(anyObject, new vscode.Position(6, 12))).includes('bark'));
});

test('only types are offered after AS', () => {
  const doc = fakeDocument(CLASS_SOURCE);
  assert.deepEqual(labels(api.completionItems(doc, new vscode.Position(19, 12))), ['int', 'float', 'bool', 'string', 'dict', 'any']);
});

test('hover documents built-ins, keywords and your own declarations', () => {
  const doc = fakeDocument('SAY TRIM("x")\nrepeat i from 1 to 2\nEND REPEAT\nTO TOTALS a AS int GIVES int\nEND TO\nSAY self\nSAY nothing_special');
  const hover = (line, character) => api.hoverFor(doc, new vscode.Position(line, character));
  assert.match(hover(0, 6).contents.value, /TRIM\(text\)/);
  assert.match(hover(0, 6).contents.value, /```plain/);
  assert.match(hover(1, 2).contents.value, /REPEAT/);
  assert.match(hover(3, 5).contents.value, /function/);
  assert.match(hover(5, 5).contents.value, /current object/);
  assert.equal(hover(6, 8), undefined);
  assert.equal(hover(0, 9), undefined); // on a quote mark, not on a word
});

test('the outline nests members under their class and marks the constructor', () => {
  const roots = api.toDocumentSymbols(fakeDocument(CLASS_SOURCE));
  assert.deepEqual(roots.map((r) => r.name), ['Animal', 'Dog', 'TOTALS', 'value']);
  const animal = roots[0];
  assert.deepEqual(animal.children.map((c) => c.name), ['name', 'NEW', 'speak']);
  assert.equal(animal.children.find((c) => c.name === 'NEW').kind, vscode.SymbolKind.Constructor);
  assert.equal(animal.kind, vscode.SymbolKind.Class);
  for (const node of [...roots, ...animal.children]) {
    assert.ok(node.range.start.line <= node.selectionRange.start.line && node.selectionRange.end.line <= node.range.end.line, node.name);
  }
});

test('formatting returns one edit for a messy file and none for a tidy one', () => {
  const messy = fakeDocument('IF TRUE THEN\nSAY 1\nEND IF');
  const edits = api.formatDocument(messy, { insertSpaces: true, tabSize: 4 });
  assert.equal(edits.length, 1);
  assert.equal(edits[0].newText, 'IF TRUE THEN\n    SAY 1\nEND IF');
  assert.deepEqual([edits[0].range.start.line, edits[0].range.start.character], [0, 0]);
  assert.deepEqual([edits[0].range.end.line, edits[0].range.end.character], [2, 6]);
  assert.deepEqual(api.formatDocument(fakeDocument(edits[0].newText), { insertSpaces: true, tabSize: 4 }), []);
});

/** Replaces child_process.execFile with a stub that records calls and lets the test finish them. */
function stubCompiler() {
  const calls = [];
  childProcess.execFile = (file, args, options, callback) => calls.push({ file, args, options, callback });
  return calls;
}
const diagnosticsFor = (doc) => registry.collections[0].store.get(doc.uri.toString());
const failure = () => Object.assign(new Error('exit 1'), { code: 1 });

test('a clean file clears its diagnostics and the compiler is run with the right arguments', async () => {
  const calls = stubCompiler();
  registry.settings.compilerPath = '/opt/plain/bin/plain';
  const doc = fakeDocument('SAY 1', '/work/clean.plain');
  registry.listeners.save(doc);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, '/opt/plain/bin/plain');
  assert.deepEqual(calls[0].args, ['check', '/work/clean.plain']);
  assert.equal(calls[0].options.cwd, '/work');
  calls[0].callback(null, 'checked /work/clean.plain\n', '');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(diagnosticsFor(doc), []);
  delete registry.settings.compilerPath;
});

test('compiler errors become diagnostics on the right token', async () => {
  const calls = stubCompiler();
  const doc = fakeDocument('LET a = 1\nSAY inner', '/work/bad.plain');
  registry.listeners.open(doc);
  calls[0].callback(failure(), '', 'error: unknown variable `inner`\n  --> /work/bad.plain:2:5\n   |\n  2 | SAY inner\n   |     ^\n');
  await new Promise((resolve) => setImmediate(resolve));
  const found = diagnosticsFor(doc);
  assert.equal(found.length, 1);
  assert.equal(found[0].message, 'unknown variable `inner`');
  assert.equal(found[0].severity, vscode.DiagnosticSeverity.Error);
  assert.equal(found[0].source, 'plain');
  assert.deepEqual([found[0].range.start.line, found[0].range.start.character, found[0].range.end.character], [1, 4, 9]);
});

test('an error inside an imported file is reported on the importing file', async () => {
  const calls = stubCompiler();
  const doc = fakeDocument('USE "helpers.plain"\nSAY 1', '/work/main.plain');
  registry.listeners.save(doc);
  calls[0].callback(failure(), '', 'error: duplicate function `twice`\n  --> /work/helpers.plain:3:1\n   |\n  3 | TO twice\n   | ^\n');
  await new Promise((resolve) => setImmediate(resolve));
  const found = diagnosticsFor(doc);
  assert.match(found[0].message, /In helpers\.plain \(line 3\): duplicate function/);
  assert.equal(found[0].range.start.line, 0);
});

test('a missing compiler gives one hint, not an error on every save', async () => {
  const calls = stubCompiler();
  const doc = fakeDocument('SAY 1', '/work/nocompiler.plain');
  const before = registry.messages.length;
  registry.listeners.save(doc);
  calls[0].callback(Object.assign(new Error('spawn plain ENOENT'), { code: 'ENOENT' }), '', '');
  registry.listeners.save(doc);
  calls[1].callback(Object.assign(new Error('spawn plain ENOENT'), { code: 'ENOENT' }), '', '');
  await new Promise((resolve) => setImmediate(resolve));
  const hints = registry.messages.slice(before).filter(([, text]) => /was not found/.test(text));
  assert.equal(hints.length, 1);
  assert.equal(diagnosticsFor(doc), undefined);
});

test('a slow older check cannot overwrite a newer result', async () => {
  const calls = stubCompiler();
  const doc = fakeDocument('SAY 1', '/work/race.plain');
  registry.listeners.save(doc);
  registry.listeners.save(doc);
  calls[1].callback(null, '', ''); // the newer run finishes first and is clean
  calls[0].callback(failure(), '', 'error: old problem\n  --> /work/race.plain:1:1\n');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(diagnosticsFor(doc), []);
});

test('files that are not Plain files on disk are not checked, and closing clears problems', async () => {
  const calls = stubCompiler();
  const untitled = fakeDocument('SAY 1', '/work/x.plain');
  untitled.uri.scheme = 'untitled';
  registry.listeners.save(untitled);
  const other = fakeDocument('x', '/work/y.txt');
  other.languageId = 'plaintext';
  registry.listeners.open(other);
  assert.equal(calls.length, 0);
  const doc = fakeDocument('SAY 1', '/work/closing.plain');
  registry.listeners.save(doc);
  calls[0].callback(failure(), '', 'error: problem\n  --> /work/closing.plain:1:1\n');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(diagnosticsFor(doc).length, 1);
  registry.listeners.close(doc);
  assert.equal(diagnosticsFor(doc), undefined);
});

test('Run File saves, opens one reusable terminal and quotes the path', async () => {
  const doc = fakeDocument('SAY 1', '/work/my programs/run me.plain');
  let saved = false;
  doc.save = async () => { saved = true; return true; };
  vscode.window.activeTextEditor = { document: doc };
  await registry.commands['plain.runFile']();
  await registry.commands['plain.runFile']();
  assert.ok(saved);
  assert.equal(registry.terminals.length, 1);
  assert.deepEqual(registry.terminals[0].sent, ['plain "/work/my programs/run me.plain"', 'plain "/work/my programs/run me.plain"']);
  doc.isUntitled = true;
  const before = registry.messages.length;
  await registry.commands['plain.runFile']();
  assert.match(registry.messages[before][1], /save the file/i);
  vscode.window.activeTextEditor = undefined;
  await registry.commands['plain.runFile']();
  assert.match(registry.messages[before + 1][1], /open a Plain file/i);
});

test('paths are quoted only when they need it', () => {
  assert.equal(api.quote('/usr/bin/plain'), '/usr/bin/plain');
  assert.equal(api.quote('a b'), '"a b"');
  assert.equal(api.quote('it"s'), '"it\\"s"');
});
