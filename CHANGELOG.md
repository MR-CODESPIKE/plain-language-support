# Changelog

## 0.2.0

- **Live diagnostics**: Plain files are checked with `plain check` when they are opened and saved, and compiler errors appear as squiggles with the compiler's own message.
- **Completion** for keywords, the whole built-in library (with argument placeholders), your own functions, classes, fields and variables, `self.` / `SUPER.` members, and types after `AS`.
- **Hover documentation** for every keyword and built-in function, and for your own declarations.
- **Go to definition** for functions, classes, methods and fields across the open workspace, plus a document **outline** (classes with their methods and fields).
- **Formatting** (`Format Document`): consistent block indentation that leaves strings and comments alone.
- **Commands**: `Plain: Run File` and `Plain: Check File`. Settings: `plain.compilerPath`, `plain.checkOnOpen`, `plain.checkOnSave`.
- Plain source files use the `.plain` extension.
- Highlighting for `IS` and `SUPER`, class names and function declarations; the keyword and built-in lists are generated from the compiler's library documentation (`npm run sync`).
- More snippets (constructor, subclass, loops, ask, extern, JSON, neural network).
- Indentation recognises `IF` / `ELSE IF` without `THEN`.
- Unit tests (`npm test`) cover the formatter, symbol scanner, diagnostics parser, grammar, manifest and the activation code.

This version needs a desktop VS Code (it runs the compiler). Syntax highlighting still works everywhere.

## 0.1.1

- Initial syntax highlighting, language configuration and snippets.
