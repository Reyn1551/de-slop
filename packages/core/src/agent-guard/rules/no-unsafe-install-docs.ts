import type { Diagnostic } from '../../slop-scanner/types';

type Locator = { getLineAndCharacterOfPosition(pos: number): { line: number; character: number } };

const INSTALL_RE = /(?:\b(pip|pip3|pipx|npm|yarn|pnpm|gem|bundle|cargo|go|composer|apt(?:-get)?|apk|dnf|yum|brew)\s+install\b|^\s*(?:pip|npm|yarn|pnpm|gem)\s+install\b)/gim;

// Capture the package names from an install command (everything after the
// command words, up to flags / end of line).
function packageArgs(line: string): string {
  const command = line.match(INSTALL_RE);
  if (!command) return '';
  const after = line.slice(line.indexOf(command[0]) + command[0].length);
  return after.split(/\s+(?:--?[a-z]|-[a-z])/i)[0] ?? after;
}

function pinnedVersion(pkgSpec: string): boolean {
  return /[=@~><]/.test(pkgSpec) || /#\w+/.test(pkgSpec);
}

function knownDependency(deps: string[], pkgSpec: string): boolean {
  const name = pkgSpec.replace(/^[\s'"`]+|[\s'"`]+$/g, '').split(/[=@><~:]/)[0].split('/')[0].toLowerCase();
  if (!name) return false;
  return deps.some((d) => d.toLowerCase() === name || d.toLowerCase().startsWith(name + '/'));
}

function loadDependencyNames(code: string): string[] {
  const names = new Set<string>();
  const add = (m: RegExpMatchArray): void => {
    const value = m[1];
    if (!value) return;
    for (const part of value.split(',')) {
      const name = part.replace(/[{}"'\s]/g, '').split(':')[0].split('@')[0];
      if (name) names.add(name);
    }
  };
  for (const m of code.matchAll(/["'](?:dependencies|devDependencies|peerDependencies|optionalDependencies|scripts|workspaces)["']\s*:\s*\{([^}]*)\}/g)) add(m);
  for (const m of code.matchAll(/^(?:require|import)\s*\(\s*["']([^"']+)["']/gm)) add(m);
  return [...names];
}

function lineAndCol(text: string, pos: number): { line: number; character: number } {
  const before = text.slice(0, pos);
  const line = before.split('\n').length - 1;
  const lastNl = before.lastIndexOf('\n');
  const character = pos - (lastNl + 1);
  return { line, character };
}

export function noUnsafeInstallDocs(
  code: string,
  filePath = '',
  sourceFile?: Locator | null,
): Omit<Diagnostic, 'filePath' | 'ruleId'>[] {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  const isRefFile = /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Pipfile|Gemfile|yarn\.lock|package-lock\.json)$/.test(filePath);
  if (isRefFile) return findings;

  const deps = loadDependencyNames(code);

  for (const match of code.matchAll(INSTALL_RE)) {
    const lineStart = code.lastIndexOf('\n', match.index) + 1;
    const lineEnd = code.indexOf('\n', match.index);
    const line = code.slice(lineStart, lineEnd === -1 ? code.length : lineEnd);

    const pkgSpecs = packageArgs(line).split(/\s+/).filter((s) => s && !s.startsWith('-'));
    for (const spec of pkgSpecs) {
      if (/^(?:--|install|dev|save|save-dev|g|global)$/i.test(spec)) continue;
      if (pinnedVersion(spec)) continue;

      const pos = lineStart + line.indexOf(spec);
      const loc = sourceFile ? sourceFile.getLineAndCharacterOfPosition(pos) : lineAndCol(code, pos);
      findings.push({
        severity: 'warning',
        message: `Unpinned install: "${spec}" — add a pinned version or --require-hashes`,
        line: loc.line + 1,
        column: loc.character + 1,
      });
    }

    for (const spec of pkgSpecs) {
      if (/^(?:--|install|dev|save|save-dev|g|global)$/i.test(spec)) continue;
      if (pinnedVersion(spec)) continue;
      if (knownDependency(deps, spec)) continue;
      const pos = lineStart + line.indexOf(spec);
      const loc = sourceFile ? sourceFile.getLineAndCharacterOfPosition(pos) : lineAndCol(code, pos);
      findings.push({
        severity: 'warning',
        message: `Install of "${spec}" not declared in dependency files`,
        line: loc.line + 1,
        column: loc.character + 1,
      });
    }
  }

  return findings;
}