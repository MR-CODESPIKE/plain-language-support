'use strict';
// A minimal stand-in for the `vscode` module, enough to run the extension's activation code and providers.
const Module = require('module');

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(a, b, c, d) {
    if (typeof a === 'number') {
      this.start = new Position(a, b);
      this.end = new Position(c, d);
    } else {
      this.start = a;
      this.end = b;
    }
  }
}

class Uri {
  constructor(fsPath) {
    this.fsPath = fsPath;
    this.scheme = 'file';
  }
  toString() {
    return 'file://' + this.fsPath;
  }
}

class MarkdownString {
  constructor() {
    this.value = '';
  }
  appendMarkdown(text) {
    this.value += text;
    return this;
  }
  appendCodeblock(code, language) {
    this.value += '\n```' + (language || '') + '\n' + code + '\n```\n';
    return this;
  }
}

class SnippetString {
  constructor(value) {
    this.value = value;
  }
}

class CompletionItem {
  constructor(label, kind) {
    this.label = label;
    this.kind = kind;
  }
}

class Diagnostic {
  constructor(range, message, severity) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}

class DocumentSymbol {
  constructor(name, detail, kind, range, selectionRange) {
    Object.assign(this, { name, detail, kind, range, selectionRange });
    this.children = [];
  }
}

const enumOf = (...names) => Object.fromEntries(names.map((n, i) => [n, i]));

function createVscode() {
  const registry = { providers: {}, commands: {}, listeners: {}, collections: [], messages: [], settings: {}, terminals: [] };
  const disposable = () => ({ dispose() {} });
  const provider = (name) => (selector, impl, ...triggers) => {
    registry.providers[name] = { selector, impl, triggers };
    return disposable();
  };
  const listener = (name) => (callback) => {
    registry.listeners[name] = callback;
    return disposable();
  };
  const vscode = {
    Position,
    Range,
    Uri,
    MarkdownString,
    SnippetString,
    CompletionItem,
    Diagnostic,
    DocumentSymbol,
    Location: class Location {
      constructor(uri, position) {
        this.uri = uri;
        this.range = position;
      }
    },
    Hover: class Hover {
      constructor(contents, range) {
        this.contents = contents;
        this.range = range;
      }
    },
    TextEdit: { replace: (range, newText) => ({ range, newText }) },
    DiagnosticSeverity: enumOf('Error', 'Warning', 'Information', 'Hint'),
    CompletionItemKind: enumOf('Text', 'Method', 'Function', 'Constructor', 'Field', 'Variable', 'Class', 'Keyword', 'TypeParameter'),
    SymbolKind: enumOf('File', 'Module', 'Namespace', 'Package', 'Class', 'Method', 'Property', 'Field', 'Constructor', 'Enum', 'Interface', 'Function', 'Variable'),
    env: { shell: '/bin/bash' },
    languages: {
      createDiagnosticCollection: () => {
        const store = new Map();
        const collection = {
          store,
          set: (uri, diagnostics) => store.set(uri.toString(), diagnostics),
          delete: (uri) => store.delete(uri.toString()),
          dispose() {},
        };
        registry.collections.push(collection);
        return collection;
      },
      registerCompletionItemProvider: provider('completion'),
      registerHoverProvider: provider('hover'),
      registerDefinitionProvider: provider('definition'),
      registerDocumentSymbolProvider: provider('symbols'),
      registerDocumentFormattingEditProvider: provider('formatting'),
    },
    commands: {
      registerCommand: (name, callback) => {
        registry.commands[name] = callback;
        return disposable();
      },
    },
    workspace: {
      textDocuments: [],
      getConfiguration: () => ({ get: (key) => registry.settings[key] }),
      findFiles: async () => [],
      onDidOpenTextDocument: listener('open'),
      onDidSaveTextDocument: listener('save'),
      onDidCloseTextDocument: listener('close'),
    },
    window: {
      activeTextEditor: undefined,
      terminals: registry.terminals,
      showWarningMessage: (message) => registry.messages.push(['warning', message]),
      showInformationMessage: (message) => registry.messages.push(['info', message]),
      createTerminal: (name) => {
        const terminal = { name, sent: [], show() {}, sendText(text) { this.sent.push(text); } };
        registry.terminals.push(terminal);
        return terminal;
      },
    },
  };
  return { vscode, registry };
}

/** A document backed by a string. */
function fakeDocument(text, fileName) {
  const lines = text.split(/\r?\n/);
  const uri = new Uri(fileName || '/work/example.plain');
  return {
    uri,
    fileName: uri.fsPath,
    languageId: 'plain',
    isUntitled: false,
    lineCount: lines.length,
    getText(range) {
      if (!range) return text;
      return lines[range.start.line].slice(range.start.character, range.end.character);
    },
    lineAt(lineOrPosition) {
      const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
      return { text: lines[line], range: new Range(line, 0, line, lines[line].length) };
    },
    positionAt(offset) {
      let remaining = offset;
      for (let line = 0; line < lines.length; line += 1) {
        if (remaining <= lines[line].length) return new Position(line, remaining);
        remaining -= lines[line].length + 1;
      }
      return new Position(lines.length - 1, lines[lines.length - 1].length);
    },
    getWordRangeAtPosition(position, pattern) {
      const text = lines[position.line];
      const global = new RegExp(pattern.source, 'g');
      let match = global.exec(text);
      while (match !== null) {
        if (match.index <= position.character && position.character <= match.index + match[0].length) {
          return new Range(position.line, match.index, position.line, match.index + match[0].length);
        }
        match = global.exec(text);
      }
      return undefined;
    },
  };
}

function install() {
  const { vscode, registry } = createVscode();
  const original = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'vscode') return vscode;
    return original.call(this, request, ...rest);
  };
  return { vscode, registry, uninstall: () => { Module._load = original; } };
}

module.exports = { install, fakeDocument };
