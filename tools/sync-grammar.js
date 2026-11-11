#!/usr/bin/env node
'use strict';
// Regenerates the keyword and built-in function patterns of the TextMate grammar from the lists in
// src/lib/docs.js and src/builtins.json, so highlighting never drifts from the compiler.
//   node tools/sync-grammar.js           rewrites syntaxes/plain.tmLanguage.json
//   node tools/sync-grammar.js --check   exits with 1 when the grammar is out of date
const fs = require('fs');
const path = require('path');
const { KEYWORD_DOCS, TYPES, builtinList } = require('../src/lib/docs');

const GRAMMAR_PATH = path.join(__dirname, '..', 'syntaxes', 'plain.tmLanguage.json');
const NOT_HIGHLIGHTED_AS_KEYWORD = new Set(['TRUE', 'FALSE', 'SUPER']);

function buildGrammar(grammar) {
  const keywords = Object.keys(KEYWORD_DOCS).filter((k) => !NOT_HIGHLIGHTED_AS_KEYWORD.has(k));
  const builtins = builtinList.map((e) => e.name).sort((a, b) => b.length - a.length || a.localeCompare(b));
  const repository = grammar.repository;
  repository.declarations = {
    patterns: [
      {
        match: '(?i)^\\s*(TO)\\s+([A-Za-z_][A-Za-z0-9_]*)',
        captures: { 1: { name: 'keyword.control.plain' }, 2: { name: 'entity.name.function.plain' } },
      },
      {
        match: '(?i)\\b(CLASS|EXTENDS|NEW|IS)\\s+([A-Za-z_][A-Za-z0-9_]*)',
        captures: { 1: { name: 'keyword.control.plain' }, 2: { name: 'entity.name.type.class.plain' } },
      },
    ],
  };
  repository.selfAndSuper = {
    patterns: [{ name: 'variable.language.plain', match: '(?i:\\b(?:SELF|SUPER)\\b)' }],
  };
  repository.keywords = {
    patterns: [
      { name: 'keyword.control.plain', match: '(?i:\\b(?:' + keywords.join('|') + ')\\b)' },
      { name: 'constant.language.plain', match: '(?i:\\b(?:TRUE|FALSE)\\b)' },
    ],
  };
  repository.types = { patterns: [{ name: 'storage.type.plain', match: '(?i:\\b(?:' + TYPES.join('|') + ')\\b)' }] };
  repository.builtins = {
    patterns: [{ name: 'support.function.builtin.plain', match: '\\b(?:' + builtins.join('|') + ')\\b' }],
  };
  grammar.patterns = ['comments', 'strings', 'numbers', 'declarations', 'selfAndSuper', 'keywords', 'types', 'builtins', 'functions', 'operators'].map((name) => ({ include: '#' + name }));
  return grammar;
}

function render() {
  const current = JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf8'));
  return JSON.stringify(buildGrammar(current), null, 2) + '\n';
}

if (require.main === module) {
  const next = render();
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(GRAMMAR_PATH, 'utf8') !== next) {
      console.error('The grammar is out of date. Run: npm run sync');
      process.exit(1);
    }
    console.log('The grammar is up to date.');
  } else {
    fs.writeFileSync(GRAMMAR_PATH, next);
    console.log('Updated ' + path.relative(process.cwd(), GRAMMAR_PATH));
  }
}

module.exports = { buildGrammar, render };
