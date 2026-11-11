'use strict';
const { endsInString, classifyLine } = require('./blocks');

/**
 * Finds the declarations in Plain source.
 * Each symbol is { name, kind, line, character, endLine, container, parent, detail }.
 * kind is one of: class, function, method, field, variable, extern.
 * `container` is the enclosing class name for methods and fields. Lines are 0-based.
 */
function scanSymbols(text) {
  const symbols = [];
  const stack = []; // open blocks: { kind: 'class' | 'function' | 'method' | 'block', symbol? }
  let inString = false;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (inString) {
      inString = endsInString(line, true);
      return;
    }
    inString = endsInString(line, false);
    const info = classifyLine(line);
    if (info.kind === 'close') {
      const closed = stack.pop();
      if (closed && closed.symbol) closed.symbol.endLine = index;
      return;
    }
    if (info.kind === 'open') {
      if (info.word === 'CLASS') {
        const m = /^\s*CLASS\s+([A-Za-z_]\w*)(?:\s+EXTENDS\s+([A-Za-z_]\w*))?/i.exec(line);
        if (m) {
          const symbol = { name: m[1], kind: 'class', line: index, character: line.indexOf(m[1]), endLine: index, container: '', parent: m[2] || '', detail: m[2] ? 'extends ' + m[2] : '' };
          symbols.push(symbol);
          stack.push({ kind: 'class', symbol });
          return;
        }
      } else if (info.word === 'TO') {
        const m = /^\s*TO\s+([A-Za-z_]\w*)\b(.*)$/i.exec(line);
        if (m) {
          const enclosing = stack.length > 0 ? stack[stack.length - 1] : null;
          const inClass = enclosing !== null && enclosing.kind === 'class';
          const detail = m[2].replace(/#.*$/, '').trim();
          const symbol = { name: m[1], kind: inClass ? 'method' : 'function', line: index, character: line.indexOf(m[1], line.search(/\S/) + 2), endLine: index, container: inClass ? enclosing.symbol.name : '', parent: '', detail };
          symbols.push(symbol);
          stack.push({ kind: symbol.kind, symbol });
          return;
        }
      }
      stack.push({ kind: 'block' });
      return;
    }
    if (info.kind !== 'other') return;
    const top = stack.length > 0 ? stack[stack.length - 1] : null;
    if (info.word === 'LET') {
      const m = /^\s*LET\s+([^=]+)/i.exec(line);
      if (m && (top === null || top.kind === 'class')) {
        const names = m[1].split(',');
        names.forEach((part) => {
          const n = /^\s*([A-Za-z_]\w*)(?:\s+AS\s+(.+?))?\s*$/i.exec(part);
          if (n) {
            symbols.push({ name: n[1], kind: top === null ? 'variable' : 'field', line: index, character: line.indexOf(n[1], line.search(/\S/) + 3), endLine: index, container: top === null ? '' : top.symbol.name, parent: '', detail: n[2] ? n[2].trim() : '' });
          }
        });
      }
    } else if (info.word === 'EXTERN') {
      const m = /^\s*EXTERN\s+"[^"]*"\s+FUNCTION\s+([A-Za-z_]\w*)\s*\(([^)]*)\)(?:\s+GIVES\s+(\S+))?/i.exec(line);
      if (m) {
        symbols.push({ name: m[1], kind: 'extern', line: index, character: line.indexOf(m[1]), endLine: index, container: '', parent: '', detail: '(' + m[2].trim() + ')' + (m[3] ? ' gives ' + m[3] : '') });
      }
    }
  });
  return symbols;
}

/** The class that contains a 0-based line, or undefined. */
function classAtLine(symbols, line) {
  return symbols.find((s) => s.kind === 'class' && s.line <= line && line <= s.endLine);
}

/** Fields and methods of a class including those it inherits (child declarations first). */
function membersOf(symbols, className) {
  const result = [];
  const seen = new Set();
  let current = className;
  for (let guard = 0; current && guard < 50 && !seen.has(current); guard += 1) {
    seen.add(current);
    for (const s of symbols) {
      if (s.container === current && (s.kind === 'method' || s.kind === 'field')) result.push(s);
    }
    const klass = symbols.find((s) => s.kind === 'class' && s.name === current);
    current = klass ? klass.parent : '';
  }
  return result;
}

module.exports = { scanSymbols, classAtLine, membersOf };
