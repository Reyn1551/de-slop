import { ast, type Node, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule, RuleContext } from '../types';
import { existsSync } from 'node:fs';

function isRelativeOrAbsolute(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

export const noUnresolvedImport: Rule = {
  id: 'no-unresolved-import',
  check(sourceFile, context) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

    if (!context || !existsSync(context.filePath)) return findings;

    function inspect(specifier: string, node: Node): void {
      if (!isRelativeOrAbsolute(specifier)) return;
      if (context!.fileExists(specifier)) return;
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(specifier);

      if (hasExtension) {
        // TypeScript Node16: import './foo.js' resolves to './foo.ts' (or .tsx/.d.ts).
        // Try the .js→.ts substitution before declaring it unresolved.
        if (/\.[cm]?js$/.test(specifier)) {
          const stripped = specifier.replace(/\.[cm]?js$/, '');
          const tsCandidates = ['.ts', '.tsx', '.mts', '.cts', '.d.ts'];
          for (const candidate of tsCandidates) {
            if (context!.fileExists(`${stripped}${candidate}`)) return;
          }
        }
        // If it has an extension and doesn't resolve, fall through to error.
      } else {
        const candidates = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.js'];
        for (const candidate of candidates) {
          if (context!.fileExists(`${specifier}${candidate}`)) return;
        }
      }
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      findings.push({
        severity: 'error',
        message: `Import '${specifier}' does not resolve to any file — possible hallucinated module`,
        line: position.line + 1,
        column: position.character + 1,
      });
    }

    function visit(node: Node): void {
      if (ast.isImportDeclaration(node)) {
        const specifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
        inspect(specifier, node);
      } else if (ast.isImportEqualsDeclaration(node)) {
        const moduleRef = node.moduleReference;
        if (moduleRef && moduleRef.getText(sourceFile).startsWith('require(')) {
          const specifier = moduleRef.getText(sourceFile).replace(/^require\(['"]/, '').replace(/['"]\)$/, '');
          inspect(specifier, node);
        }
      } else if (ast.isCallExpression(node)) {
        const callee = node.expression;
        if (ast.isIdentifier(callee) && callee.text === 'require') {
          const arg = node.arguments[0];
          if (arg && ast.isStringLiteral(arg)) {
            inspect(arg.text, node);
          }
        }
      }
      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};
