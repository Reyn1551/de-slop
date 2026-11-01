import { ast, type Node } from './slop-scanner/ts-api';
import { parseSourceFile } from './slop-scanner/scanner';

const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

export function isSourcePath(filePath: string): boolean {
  return SOURCE_FILE.test(filePath);
}

function namesOf(statement: Node): string[] {
  if (
    ast.isFunctionDeclaration(statement) ||
    ast.isClassDeclaration(statement) ||
    ast.isInterfaceDeclaration(statement) ||
    ast.isTypeAliasDeclaration(statement) ||
    ast.isEnumDeclaration(statement)
  ) {
    const name = statement.name;
    return name && ast.isIdentifier(name) ? [name.text] : [];
  }

  if (ast.isVariableStatement(statement)) {
    const names: string[] = [];
    for (const declaration of statement.declarationList.declarations) {
      if (ast.isIdentifier(declaration.name)) names.push(declaration.name.text);
    }
    return names;
  }

  if (ast.isExportDeclaration(statement) && statement.exportClause && ast.isNamedExports(statement.exportClause)) {
    return statement.exportClause.elements.map((element) => element.name.text);
  }

  return [];
}

/**
 * Top-level declaration names in a file. Used to answer "did this change
 * actually add or remove the thing the message claims".
 *
 * Returns an empty list for a file that does not parse: a broken file cannot
 * testify either way, and inventing names would produce confident nonsense.
 */
export function collectTopLevelSymbols(code: string, filePath: string): string[] {
  if (!isSourcePath(filePath)) return [];

  let sourceFile;
  try {
    sourceFile = parseSourceFile(code, filePath);
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const statement of sourceFile.statements) names.push(...namesOf(statement));
  return names;
}

/** Names present in `after` that were absent from `before`. */
export function addedSymbols(before: string, after: string, filePath: string): string[] {
  const previous = new Set(collectTopLevelSymbols(before, filePath));
  return collectTopLevelSymbols(after, filePath).filter((name) => !previous.has(name));
}

/** Names present in `before` that are absent from `after`. */
export function removedSymbols(before: string, after: string, filePath: string): string[] {
  const next = new Set(collectTopLevelSymbols(after, filePath));
  return collectTopLevelSymbols(before, filePath).filter((name) => !next.has(name));
}
