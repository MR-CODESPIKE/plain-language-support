# Changelog

## 0.1.1

- Match Plain keywords and type names without regard to case, consistent with the compiler lexer.
- Highlight the `ENV` and `READ_LINES` runtime builtins.
- Replace a variable-length lookbehind in the function-name grammar with a portable call-name matcher.
- Correct block indentation, quote pairing, package metadata, and local VSIX packaging instructions.
