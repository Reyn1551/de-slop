import { ast, type Node } from '../slop-scanner/ts-api';
import { parseSourceFile } from '../slop-scanner/scanner';
import type { RepoFacts } from './types';

const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function declarationNames(statement: Node): string[] {
  if (ast.isFunctionDeclaration(statement) || ast.isClassDeclaration(statement) || ast.isInterfaceDeclaration(statement) || ast.isTypeAliasDeclaration(statement) || ast.isEnumDeclaration(statement)) {
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

  return [];
}

function symbolNames(code: string, filePath: string): string[] {
  let sourceFile;
  try {
    sourceFile = parseSourceFile(code, filePath);
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const statement of sourceFile.statements) {
    names.push(...declarationNames(statement));
    if (ast.isExportDeclaration(statement) && statement.exportClause && ast.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.push(element.name.text);
    }
  }
  return names;
}

function scriptNames(packageJson: string | undefined): string[] {
  if (packageJson === undefined) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(packageJson);
  } catch {
    return [];
  }
  if (parsed === null || typeof parsed !== 'object' || !('scripts' in parsed)) return [];
  const scripts = parsed.scripts;
  if (scripts === null || typeof scripts !== 'object') return [];
  return Object.keys(scripts);
}

export function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Build the set of facts an agent-config file can be checked against.
 * Sources supply paths and top-level symbols; package.json supplies scripts.
 */
export function collectRepoFacts(
  files: { filePath: string; code: string }[],
  packageJson?: string,
): RepoFacts {
  const paths = new Set<string>();
  const symbols = new Set<string>();

  for (const file of files) {
    paths.add(normalizeRepoPath(file.filePath));
    if (!SOURCE_FILE.test(file.filePath)) continue;
    for (const name of symbolNames(file.code, file.filePath)) symbols.add(name);
  }

  return {
    files: [...paths].sort(),
    scripts: scriptNames(packageJson).sort(),
    symbols: [...symbols].sort(),
  };
}
