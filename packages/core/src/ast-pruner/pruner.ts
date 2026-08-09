import { parseSourceFile } from '../slop-scanner/scanner';
import { ast, type Node, type SourceFile, type Statement } from '../slop-scanner/ts-api';

type DeclarationKind = 'function' | 'class' | 'interface' | 'type' | 'const';

interface Declaration {
  node: Statement;
  name: string;
  kind: DeclarationKind;
}

function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

function wordMatches(identifier: string, queryWord: string): boolean {
  const needle = queryWord.toLowerCase();
  if (identifier.toLowerCase().includes(needle)) return true;
  const identifierWords = splitWords(identifier);
  return splitWords(queryWord).some((word) => identifierWords.includes(word));
}

function collectDeclarations(sourceFile: SourceFile): Declaration[] {
  const out: Declaration[] = [];
  for (const statement of sourceFile.statements) {
    if (ast.isFunctionDeclaration(statement) && statement.name) {
      out.push({ node: statement, name: statement.name.text, kind: 'function' });
    } else if (ast.isClassDeclaration(statement) && statement.name) {
      out.push({ node: statement, name: statement.name.text, kind: 'class' });
    } else if (ast.isInterfaceDeclaration(statement)) {
      out.push({ node: statement, name: statement.name.text, kind: 'interface' });
    } else if (ast.isTypeAliasDeclaration(statement)) {
      out.push({ node: statement, name: statement.name.text, kind: 'type' });
    } else if (
      ast.isVariableStatement(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ast.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (ast.isIdentifier(declaration.name)) {
          out.push({ node: statement, name: declaration.name.text, kind: 'const' });
        }
      }
    }
  }
  return out;
}

function collectIdentifiers(node: Node, out: Set<string>): void {
  if (ast.isIdentifier(node)) {
    out.add(node.text);
  }
  node.forEachChild((child) => collectIdentifiers(child, out));
}

function importedNames(importNode: Node): string[] {
  if (!ast.isImportDeclaration(importNode)) return [];
  const clause = importNode.importClause;
  if (!clause) return [];
  const names: string[] = [];
  if (clause.name) names.push(clause.name.text);
  if (clause.namedBindings) {
    if (ast.isNamespaceImport(clause.namedBindings)) {
      names.push(clause.namedBindings.name.text);
    } else if (ast.isNamedImports(clause.namedBindings)) {
      for (const specifier of clause.namedBindings.elements) names.push(specifier.name.text);
    }
  }
  return names;
}

function declarationMatchesQuery(declaration: Declaration, query: string[]): boolean {
  const identifiers = new Set<string>();
  collectIdentifiers(declaration.node, identifiers);
  return query.some((queryWord) => Array.from(identifiers).some((identifier) => wordMatches(identifier, queryWord)));
}

function emitSummary(declarations: Declaration[]): string {
  return declarations.map((declaration) => `${declaration.kind}: ${declaration.name}`).join('\n');
}

export function pruneSource(code: string, filePath: string, query: string[]): string {
  const sourceFile = parseSourceFile(code, filePath);
  const declarations = collectDeclarations(sourceFile);
  const cleanQuery = query.map((word) => word.trim()).filter((word) => word.length > 0);

  const selected = declarations.filter((declaration) => declarationMatchesQuery(declaration, cleanQuery));
  if (selected.length === 0) {
    return emitSummary(declarations);
  }

  const selectedIdentifiers = new Set<string>();
  for (const declaration of selected) {
    collectIdentifiers(declaration.node, selectedIdentifiers);
  }

  const nodes = new Map<Statement, Statement>();
  for (const declaration of selected) {
    nodes.set(declaration.node, declaration.node);
  }
  for (const statement of sourceFile.statements) {
    if (ast.isImportDeclaration(statement) && importedNames(statement).some((name) => selectedIdentifiers.has(name))) {
      nodes.set(statement, statement);
    }
  }

  const ordered = Array.from(nodes.keys()).sort((a, b) => a.pos - b.pos);
  let output = ordered.map((node) => code.slice(node.getFullStart(), node.getEnd())).join('');
  if (output.length > 0 && !output.endsWith('\n')) {
    output += '\n';
  }
  return output;
}

export function pruneFiles(files: { filePath: string; code: string }[], query: string[]): { filePath: string; content: string }[] {
  return files
    .map((file) => ({ filePath: file.filePath, content: pruneSource(file.code, file.filePath, query) }))
    .filter((file) => file.content.length > 0);
}
