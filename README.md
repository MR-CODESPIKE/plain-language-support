# Plain Language Support for VS Code

Editor support for **Plain**, the programming language created by **MR-CODESPIKE**. Core language and compiler: https://github.com/MR-CODESPIKE/plain-ecosystem.

## Features

- **Syntax highlighting** for keywords, types, the built-in library, classes, functions, strings and comments (all case-insensitive keywords).
- **Live diagnostics**: your file is checked with the Plain compiler when you open and save it; errors show up in the editor and the Problems panel with the compiler's own message.
- **Completion** for keywords, built-in functions (with argument placeholders), your own functions, classes, fields and variables, `self.` / `SUPER.` members and types after `AS`.
- **Hover documentation** for keywords, built-ins and your own declarations.
- **Go to definition**, **outline** (classes with methods and fields) and **Format Document**.
- **Run File** (`Plain: Run File`, also in the editor title bar) and **Check File** commands.
- Folding, bracket matching, auto-indentation and starter **snippets** (`to`, `if`, `repeat`, `foreach`, `class`, `classx`, `ctor`, `try`, `json`, `nn`, ...).

Plain source files use the `.plain` extension. Open a `.plain` file to activate Plain syntax highlighting, snippets, diagnostics, and editor commands.

## Requirements

Diagnostics and *Run File* need the `plain` compiler. Build it from the plain-ecosystem repository (`cargo build --release -p plain`, needs LLVM 18 and clang) and either put `target/release` on your `PATH` or set **Plain: Compiler Path** (`plain.compilerPath`) to the full path. Without the compiler everything else still works and you get a single hint instead of errors.

Only saved files are checked, because the compiler reads the file from disk.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `plain.compilerPath` | `plain` | The compiler executable |
| `plain.checkOnOpen` | `true` | Check files when they are opened |
| `plain.checkOnSave` | `true` | Check files when they are saved |

## Install from a VSIX

```bash
code --install-extension plain-language-support-0.2.0.vsix
```

or use *Extensions > ... > Install from VSIX...*.

## Develop

Needs Node.js 20 or newer; there are no runtime dependencies.

```bash
npm test               # unit tests for the formatter, symbol scanner, diagnostics, grammar and activation code
npm run sync           # regenerate the highlighting rules from src/builtins.json and src/lib/docs.js
npm run package        # build the VSIX with vsce (or: python3 tools/build_vsix.py, which needs nothing)
```

`src/builtins.json` is generated from `docs/stdlib.json` in the compiler repository (`python3 scripts/gen_stdlib_docs.py`), so completion, hover and highlighting always match the compiler.
