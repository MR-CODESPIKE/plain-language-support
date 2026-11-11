'use strict';
// Documentation shown on hover and in completion. The built-in function list comes from
// ../builtins.json, which is generated from the compiler's docs/stdlib.json.
const builtinList = require('../builtins.json');

const KEYWORD_DOCS = {
  LET: '`LET x = 5`, `LET a, b = 1, 2`, `LET n AS int = 3` declares variables. Variables are block-scoped: use `SET` to change one.',
  SET: '`SET x = x + 1` changes an existing variable, list item (`SET xs[0] = 1`) or field (`SET self.name = "Rex"`). `SET a, b = b, a` swaps.',
  AS: 'Gives a type: `LET n AS int`, function parameters, class fields. Types are checked when the compiler can see them.',
  GIVES: 'Declares the type of a function result: `TO area w AS int, h AS int GIVES int`.',
  TO: 'Starts a function (`TO add a AS int, b AS int GIVES int`) or a method. In `REPEAT i FROM 1 TO 10` it marks the end of the range.',
  END: 'Closes a block: `END IF`, `END REPEAT`, `END TO`, `END TRY`, `END CLASS`.',
  IF: '`IF condition THEN ... ELSE IF ... ELSE ... END IF`. `THEN` is optional. As an expression: `a IF cond ELSE b`.',
  THEN: 'Follows the condition of an `IF`. It is optional.',
  ELSE: 'The alternative branch of an `IF`, or the fallback of `a IF cond ELSE b`.',
  REPEAT: '`REPEAT i FROM 1 TO 10`, `REPEAT WHILE condition`, `REPEAT FOR EACH item IN list`. The bounds of a counted loop are evaluated once.',
  FROM: 'Start of a counted loop: `REPEAT i FROM 1 TO 10` (both ends included).',
  WHILE: '`REPEAT WHILE condition` loops while the condition is truthy.',
  FOR: '`REPEAT FOR EACH item IN collection` loops over a list or a `READ_LINES` iterator.',
  EACH: 'Part of `REPEAT FOR EACH item IN collection`.',
  IN: 'Part of `REPEAT FOR EACH item IN collection`.',
  BREAK: 'Leaves the innermost `REPEAT`. It is an error outside a loop.',
  CONTINUE: 'Skips to the next iteration of the innermost `REPEAT`. It is an error outside a loop.',
  GIVE: '`GIVE BACK value` returns from a function. It is an error outside a function.',
  BACK: 'Part of `GIVE BACK value`.',
  SAY: '`SAY value` prints a value on its own line. Lists print as `[1, 2]`, objects as `Class{field: value}`.',
  ASK: '`ASK "prompt" AS int name` reads a value (int, float, bool or string) from standard input.',
  AND: 'Short-circuit logical and: the right side only runs when the left side is truthy. Returns a boolean.',
  OR: 'Short-circuit logical or: the right side only runs when the left side is falsy. Returns a boolean.',
  NOT: '`NOT x > 5` means `NOT (x > 5)`. Falsy values: FALSE, 0, 0.0, "", empty list/dict, null and errors.',
  CLASS: '`CLASS Name [EXTENDS Parent] ... END CLASS` declares fields (`LET x AS int = 0`), a constructor (`TO NEW`) and methods (`TO name`).',
  EXTENDS: '`CLASS Dog EXTENDS Animal` inherits fields and methods. Call the parent constructor with `SUPER.NEW(args)`.',
  NEW: '`NEW Class(args)` creates an object (fields get their defaults), then runs the constructor `TO NEW`.',
  IS: '`value IS Class` is TRUE for an instance of `Class` or of one of its subclasses.',
  SUPER: '`SUPER.NEW(args)` calls the parent constructor; `SUPER.method(args)` calls the parent version of a method.',
  TRY: '`TRY ... CATCH name ... END TRY`. Any failing statement in the body (including nested blocks) jumps to `CATCH`.',
  CATCH: '`CATCH name` receives the error value from a failed statement in the `TRY` body.',
  FAIL: '`FAIL "message"` creates an error. Inside `TRY` it jumps to `CATCH`; in a function it returns the error.',
  USE: '`USE "file.plain"` includes another file (once). The file must be inside the project directory.',
  EXTERN: '`EXTERN "plain_ml" FUNCTION name(a AS int) GIVES any` declares a native function from the runtime or ML library.',
  FUNCTION: 'Part of an `EXTERN "library" FUNCTION name(...)` declaration.',
  TRUE: 'The boolean true.',
  FALSE: 'The boolean false.',
};

const SELF_DOC = '`self` is the current object inside a method: `self.name`. Fields can also be used by their bare name unless a parameter or local shadows them.';
const TYPES = ['int', 'float', 'bool', 'string', 'dict', 'any'];

const KEYWORDS = new Map(Object.entries(KEYWORD_DOCS));
const BUILTINS = new Map(builtinList.map((entry) => [entry.name, entry]));

module.exports = { KEYWORD_DOCS, KEYWORDS, BUILTINS, TYPES, SELF_DOC, builtinList };
