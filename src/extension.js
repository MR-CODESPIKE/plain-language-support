'use strict';
// Editor features for Plain: live diagnostics from the compiler, completion, hover, go to definition,
// outline, formatting and a "Run File" command. It uses only the VS Code API and Node's standard
// library (no npm dependencies). The logic that does not need VS Code lives in ./lib and is unit-tested.
const vscode = require('vscode');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');
const { formatText } = require('./lib/format');
const { scanSymbols, classAtLine, membersOf } = require('./lib/symbols');
const { parseCompilerOutput, rangeFor } = require('./lib/diagnostics');
const { KEYWORDS, BUILTINS, TYPES, SELF_DOC } = require('./lib/docs');
const { builtinList } = require('./lib/docs');

const LANGUAGE = 'plain';
const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/;

function settings() {
  const config = vscode.workspace.getConfiguration('plain');
  return {
    compilerPath: String(config.get('compilerPath') || 'plain'),
    checkOnOpen: config.get('checkOnOpen') !== false,
    checkOnSave: config.get('checkOnSave') !== false,
  };
}

// ------------------------------------------------------------------------------------------ diagnostics

function toDiagnostic(document, found) {
  if (!found.sameFile) {
    const range = document.lineAt(0).range;
    const diagnostic = new vscode.Diagnostic(range, 'In ' + path.basename(found.file) + ' (line ' + found.line + '): ' + found.message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = 'plain';
    return diagnostic;
  }
  const lineIndex = Math.min(found.line - 1, document.lineCount - 1);
  const r = rangeFor(document.lineAt(lineIndex).text, found.column);
  const diagnostic = new vscode.Diagnostic(new vscode.Range(lineIndex, r.start, lineIndex, r.end), found.message, vscode.DiagnosticSeverity.Error);
  diagnostic.source = 'plain';
  return diagnostic;
}

/** Runs `plain check <file>` and shows what the compiler reports. Only saved files are checked. */
function createChecker(collection) {
  const generation = new Map();
  let warnedMissing = false;
  return function check(document, announce) {
    if (document.languageId !== LANGUAGE || document.uri.scheme !== 'file') return Promise.resolve();
    const key = document.uri.toString();
    const run = (generation.get(key) || 0) + 1;
    generation.set(key, run);
    const compilerPath = settings().compilerPath;
    return new Promise((resolve) => {
      const options = { cwd: path.dirname(document.fileName), timeout: 30000, maxBuffer: 4 * 1024 * 1024 };
      childProcess.execFile(compilerPath, ['check', document.fileName], options, (error, stdout, stderr) => {
        if (generation.get(key) !== run) {
          resolve();
          return;
        }
        if (error && error.code === 'ENOENT') {
          collection.delete(document.uri);
          if (!warnedMissing) {
            warnedMissing = true;
            vscode.window.showWarningMessage('Plain: the compiler "' + compilerPath + '" was not found. Build it with cargo and set "plain.compilerPath".');
          }
          resolve();
          return;
        }
        if (error && error.killed) {
          resolve();
          return;
        }
        if (!error) {
          collection.set(document.uri, []);
          if (announce) vscode.window.showInformationMessage('Plain: no problems found.');
          resolve();
          return;
        }
        const found = parseCompilerOutput(String(stderr || '') + String(stdout || ''), document.fileName);
        collection.set(document.uri, found.map((item) => toDiagnostic(document, item)));
        resolve();
      });
    });
  };
}

// ------------------------------------------------------------------------------------------ completion

const SYMBOL_ITEM_KINDS = () => ({
  class: vscode.CompletionItemKind.Class,
  function: vscode.CompletionItemKind.Function,
  method: vscode.CompletionItemKind.Method,
  field: vscode.CompletionItemKind.Field,
  variable: vscode.CompletionItemKind.Variable,
  extern: vscode.CompletionItemKind.Function,
});

function symbolItem(symbol) {
  const item = new vscode.CompletionItem(symbol.name, SYMBOL_ITEM_KINDS()[symbol.kind]);
  item.detail = symbol.kind + (symbol.container ? ' of ' + symbol.container : '') + (symbol.detail ? ' ' + symbol.detail : '');
  return item;
}

function builtinItem(entry) {
  const item = new vscode.CompletionItem(entry.name, vscode.CompletionItemKind.Function);
  const inner = /\((.*)\)/.exec(entry.signature);
  const parameters = inner && inner[1].trim().length > 0 ? inner[1].split(',').map((p) => p.trim()) : [];
  item.insertText = new vscode.SnippetString(entry.name + '(' + parameters.map((p, i) => '${' + (i + 1) + ':' + p + '}').join(', ') + ')');
  item.detail = entry.signature + ' -> ' + entry.returns;
  item.documentation = new vscode.MarkdownString(entry.description);
  return item;
}

function completionItems(document, position) {
  const prefix = document.lineAt(position.line).text.slice(0, position.character);
  const symbols = scanSymbols(document.getText());
  const items = [];
  const member = /\b(self|super)\.[A-Za-z0-9_]*$/i.exec(prefix);
  if (member) {
    const klass = classAtLine(symbols, position.line);
    const start = klass ? (member[1].toLowerCase() === 'super' ? klass.parent : klass.name) : '';
    for (const symbol of start ? membersOf(symbols, start) : []) items.push(symbolItem(symbol));
    return items;
  }
  if (/\.[A-Za-z0-9_]*$/.test(prefix)) {
    const seen = new Set();
    for (const symbol of symbols) {
      if ((symbol.kind === 'method' || symbol.kind === 'field') && symbol.name.toUpperCase() !== 'NEW' && !seen.has(symbol.name)) {
        seen.add(symbol.name);
        items.push(symbolItem(symbol));
      }
    }
    return items;
  }
  if (/\bAS\s+[A-Za-z]*$/i.test(prefix)) {
    return TYPES.map((name) => new vscode.CompletionItem(name, vscode.CompletionItemKind.TypeParameter));
  }
  for (const [name, doc] of KEYWORDS) {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
    item.documentation = new vscode.MarkdownString(doc);
    items.push(item);
  }
  for (const entry of builtinList) items.push(builtinItem(entry));
  const seenNames = new Set();
  for (const symbol of symbols) {
    if (symbol.kind === 'method' || symbol.kind === 'field' || seenNames.has(symbol.name)) continue;
    seenNames.add(symbol.name);
    items.push(symbolItem(symbol));
  }
  return items;
}

// ------------------------------------------------------------------------------------------ hover

function hoverFor(document, position) {
  const range = document.getWordRangeAtPosition(position, IDENTIFIER);
  if (!range) return undefined;
  const word = document.getText(range);
  const markdown = new vscode.MarkdownString();
  let found = false;
  const builtin = BUILTINS.get(word);
  if (builtin) {
    markdown.appendMarkdown('**' + builtin.signature + '** -> ' + builtin.returns + '\n\n' + builtin.description + '\n\n');
    markdown.appendCodeblock(builtin.example, 'plain');
    found = true;
  }
  const keyword = KEYWORDS.get(word.toUpperCase());
  if (keyword) {
    markdown.appendMarkdown('**' + word.toUpperCase() + '** - ' + keyword);
    found = true;
  } else if (word.toLowerCase() === 'self') {
    markdown.appendMarkdown(SELF_DOC);
    found = true;
  }
  for (const symbol of scanSymbols(document.getText())) {
    if (symbol.name === word) {
      markdown.appendMarkdown((found ? '\n\n' : '') + '_' + symbol.kind + (symbol.container ? ' of ' + symbol.container : '') + '_ **' + symbol.name + '** ' + symbol.detail);
      found = true;
      break;
    }
  }
  return found ? new vscode.Hover(markdown, range) : undefined;
}

// ------------------------------------------------------------------------------------------ navigation

async function symbolsInWorkspace(current) {
  const result = [{ uri: current.uri, symbols: scanSymbols(current.getText()) }];
  const seen = new Set([current.uri.fsPath]);
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === LANGUAGE && doc.uri.scheme === 'file' && !seen.has(doc.uri.fsPath)) {
      seen.add(doc.uri.fsPath);
      result.push({ uri: doc.uri, symbols: scanSymbols(doc.getText()) });
    }
  }
  const files = await vscode.workspace.findFiles('**/*.{pl,plain}', '**/{node_modules,target}/**', 200);
  for (const uri of files) {
    if (seen.has(uri.fsPath)) continue;
    seen.add(uri.fsPath);
    try {
      result.push({ uri, symbols: scanSymbols(fs.readFileSync(uri.fsPath, 'utf8')) });
    } catch (e) {
      // An unreadable file is simply skipped.
    }
  }
  return result;
}

async function definitionFor(document, position) {
  const range = document.getWordRangeAtPosition(position, IDENTIFIER);
  if (!range) return [];
  const word = document.getText(range);
  const locations = [];
  for (const entry of await symbolsInWorkspace(document)) {
    for (const symbol of entry.symbols) {
      if (symbol.name === word && symbol.kind !== 'variable') {
        locations.push(new vscode.Location(entry.uri, new vscode.Position(symbol.line, symbol.character)));
      }
    }
  }
  return locations;
}

function toDocumentSymbols(document) {
  const symbols = scanSymbols(document.getText());
  const kinds = {
    class: vscode.SymbolKind.Class,
    function: vscode.SymbolKind.Function,
    method: vscode.SymbolKind.Method,
    constructor: vscode.SymbolKind.Constructor,
    field: vscode.SymbolKind.Field,
    variable: vscode.SymbolKind.Variable,
    extern: vscode.SymbolKind.Function,
  };
  const make = (symbol) => {
    const endLine = Math.min(symbol.endLine, document.lineCount - 1);
    const range = new vscode.Range(symbol.line, 0, endLine, document.lineAt(endLine).text.length);
    const selection = new vscode.Range(symbol.line, symbol.character, symbol.line, symbol.character + symbol.name.length);
    const kind = symbol.kind === 'method' && symbol.name.toUpperCase() === 'NEW' ? 'constructor' : symbol.kind;
    return new vscode.DocumentSymbol(symbol.name, symbol.detail, kinds[kind], range, selection);
  };
  const roots = [];
  const classes = new Map();
  for (const symbol of symbols) {
    if (symbol.kind === 'class') {
      const node = make(symbol);
      classes.set(symbol.name, node);
      roots.push(node);
    }
  }
  for (const symbol of symbols) {
    if (symbol.kind === 'class') continue;
    const node = make(symbol);
    const parent = symbol.container ? classes.get(symbol.container) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

// ------------------------------------------------------------------------------------------ formatting and commands

function formatDocument(document, options) {
  const text = document.getText();
  const formatted = formatText(text, options);
  if (formatted === text) return [];
  const everything = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
  return [vscode.TextEdit.replace(everything, formatted)];
}

function quote(argument) {
  if (/^[A-Za-z0-9_./:\\-]+$/.test(argument)) return argument;
  if (process.platform === 'win32') return '"' + argument.replace(/"/g, '""') + '"';
  return '"' + argument.replace(/(["\\$`])/g, '\\$1') + '"';
}

function commandLine(compilerPath, file) {
  const shell = vscode.env && vscode.env.shell ? String(vscode.env.shell) : '';
  const prefix = /powershell|pwsh/i.test(shell) ? '& ' : '';
  return prefix + quote(compilerPath) + ' ' + quote(file);
}

async function runFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== LANGUAGE) {
    vscode.window.showInformationMessage('Plain: open a Plain file first.');
    return;
  }
  if (editor.document.isUntitled) {
    vscode.window.showWarningMessage('Plain: save the file before running it.');
    return;
  }
  await editor.document.save();
  let terminal = vscode.window.terminals.find((t) => t.name === 'Plain');
  if (!terminal) terminal = vscode.window.createTerminal('Plain');
  terminal.show(true);
  terminal.sendText(commandLine(settings().compilerPath, editor.document.fileName));
}

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection('plain');
  const check = createChecker(collection);
  const selector = { language: LANGUAGE };
  const subscriptions = context.subscriptions;
  subscriptions.push(collection);
  subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, { provideCompletionItems: completionItems }, '.'));
  subscriptions.push(vscode.languages.registerHoverProvider(selector, { provideHover: hoverFor }));
  subscriptions.push(vscode.languages.registerDefinitionProvider(selector, { provideDefinition: definitionFor }));
  subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, { provideDocumentSymbols: toDocumentSymbols }));
  subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(selector, { provideDocumentFormattingEdits: formatDocument }));
  subscriptions.push(vscode.commands.registerCommand('plain.runFile', runFile));
  subscriptions.push(
    vscode.commands.registerCommand('plain.checkFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) return check(editor.document, true);
      return undefined;
    })
  );
  subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (settings().checkOnOpen) check(document);
    })
  );
  subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (settings().checkOnSave) check(document);
    })
  );
  subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => collection.delete(document.uri)));
  if (settings().checkOnOpen) {
    for (const document of vscode.workspace.textDocuments) check(document);
  }
}

function deactivate() {}

module.exports = { activate, deactivate, internals: { completionItems, hoverFor, toDocumentSymbols, formatDocument, toDiagnostic, commandLine, quote } };
