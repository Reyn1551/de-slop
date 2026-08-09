import {
  ast,
  type Expression,
  type Node,
  type SourceFile,
  type VariableDeclaration,
} from '../ts-api';
import type { Diagnostic, Rule } from '../types';

interface DeclarationEntry {
  declaration: VariableDeclaration;
  name: string;
  nameNode: Node;
}

function isPureInitializer(expression: Expression | undefined): boolean {
  if (!expression) return false;
  switch (expression.kind) {
    case ast.SyntaxKind.StringLiteral:
    case ast.SyntaxKind.NumericLiteral:
    case ast.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ast.SyntaxKind.TrueKeyword:
    case ast.SyntaxKind.FalseKeyword:
    case ast.SyntaxKind.NullKeyword:
    case ast.SyntaxKind.Identifier:
      return true;
    default:
      return false;
  }
}

function isExported(node: Node): boolean {
  let current: Node | undefined = node;
  while (current) {
    const modifiers = (current as { modifiers?: Node[] }).modifiers;
    if (modifiers?.some((modifier) => modifier.kind === ast.SyntaxKind.ExportKeyword)) return true;
    current = current.parent as Node | undefined;
  }
  return false;
}

function collectDeclaredNames(name: Node, output: DeclarationEntry[], declaration: VariableDeclaration): void {
  if (ast.isIdentifier(name)) {
    output.push({ declaration, name: name.text, nameNode: name });
    return;
  }
  if (ast.isObjectBindingPattern(name) || ast.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (element.name && ast.isIdentifier(element.name)) {
        output.push({ declaration, name: element.name.text, nameNode: element.name });
      }
    }
  }
}

function collectUsages(root: SourceFile): Set<string> {
  const usages = new Set<string>();
  function visit(node: Node): void {
    if (ast.isIdentifier(node)) {
      const parent = node.parent as Node | undefined;
      const isDeclarationName = parent && ast.isVariableDeclaration(parent) && parent.name === node;
      if (!isDeclarationName) {
        usages.add(node.text);
      }
    }
    node.forEachChild(visit);
  }
  visit(root);
  return usages;
}

export const noUnusedVar: Rule = {
  id: 'no-unused-var',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const declarations: DeclarationEntry[] = [];
    function visit(node: Node): void {
      if (ast.isVariableDeclaration(node) && node.name) {
        collectDeclaredNames(node.name, declarations, node);
      }
      node.forEachChild(visit);
    }
    visit(sourceFile);

    const usages = collectUsages(sourceFile);
    const reported = new Set<VariableDeclaration>();

    for (const entry of declarations) {
      if (entry.name.startsWith('_')) continue;
      if (isExported(entry.declaration)) continue;
      if (entry.declaration.initializer && ast.isCallExpression(entry.declaration.initializer)) continue;
      if (usages.has(entry.name)) continue;
      if (reported.has(entry.declaration)) continue;
      reported.add(entry.declaration);

      const position = sourceFile.getLineAndCharacterOfPosition(entry.nameNode.getStart());
      const finding: Omit<Diagnostic, 'filePath' | 'ruleId'> = {
        severity: 'warning',
        message: `'${entry.name}' is declared but never used`,
        line: position.line + 1,
        column: position.character + 1,
      };
      const declarationList = entry.declaration.parent as Node | undefined;
      const statement = declarationList?.parent as Node | undefined;
      if (
        isPureInitializer(entry.declaration.initializer) &&
        declarationList &&
        statement &&
        (declarationList as unknown as { declarations: Node[] }).declarations.length === 1 &&
        statement.kind === ast.SyntaxKind.VariableStatement &&
        !isExported(statement)
      ) {
        const text = sourceFile.text;
        let fixEnd = statement.end;
        if (text[fixEnd] === '\r' && text[fixEnd + 1] === '\n') fixEnd += 2;
        else if (text[fixEnd] === '\n') fixEnd += 1;
        finding.fix = { start: statement.getStart(), end: fixEnd, replacement: '' };
      }
      findings.push(finding);
    }
    return findings;
  },
};
