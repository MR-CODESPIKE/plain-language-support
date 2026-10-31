# Plain Language Support for VS Code

Syntax highlighting, folding, indentation, bracket matching, and starter snippets for **Plain**, the programming language created by **MR-CODESPIKE**. Core language/compiler source: https://github.com/MR-CODESPIKE/plain-ecosystem. This declarative extension does not execute code or include a compiler; build and run Plain programs with the Rust/LLVM toolchain documented in the project README.

## Package and install locally

Building the VSIX from source requires Node.js 22 or newer. From this directory:

```bash
npm install
npm run package
code --install-extension plain-language-support-0.1.1.vsix
```

Alternatively, open VS Code’s **Extensions** view, select **…**, choose **Install from VSIX…**, and select `plain-language-support-0.1.1.vsix`.

Open a `.pl` file to use the Plain language mode. The `header`, `to`, `if`, `repeat`, `try`, and `class` snippets provide starter syntax.

## Supported editor features

The extension associates `.pl` files with Plain, recognizes `#` comments, and highlights case-insensitive keywords and types, runtime builtins, string escapes, numeric literals, operators, and function calls. It also configures block indentation and folding, bracket matching, quote pairing, and the bundled code snippets.
