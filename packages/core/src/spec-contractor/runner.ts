import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { parseSpecFile } from './parser';
import { verifySpec, type SourceInput, type SpecViolation } from './verify';

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function listFiles(dir: string, recursive: boolean): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (recursive) stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

export function expandGlob(pattern: string): string[] {
  const starIndex = pattern.indexOf('*');
  if (starIndex === -1) {
    return existsSync(pattern) ? [pattern] : [];
  }
  const base = pattern.slice(0, starIndex).replace(/[/\\]+$/, '');
  const rest = pattern.slice(starIndex);
  const recursive = rest.startsWith('**/');
  const filePattern = rest.replace(/^.*[/\\]/, '');
  const dir = base === '' ? '.' : base;
  if (!existsSync(dir)) return [];
  const matcher = globToRegExp(filePattern);
  return listFiles(dir, recursive)
    .filter((full) => {
      const relative = recursive ? full.slice(dir.length + 1) : basename(full);
      return matcher.test(relative);
    })
    .sort();
}

function collectSources(globs: string[]): SourceInput[] {
  const seen = new Set<string>();
  const sources: SourceInput[] = [];
  for (const glob of globs) {
    const normalized = isAbsolute(glob) ? glob : resolve(glob);
    for (const filePath of expandGlob(normalized)) {
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      sources.push({ filePath, code: readFileSync(filePath, 'utf8') });
    }
  }
  return sources;
}

export function runSpecCheck(specPath: string, sourceGlobs: string[]): { violations: SpecViolation[] } {
  const content = readFileSync(specPath, 'utf8');
  const specs = parseSpecFile(content);
  const sources = collectSources(sourceGlobs);
  const violations: SpecViolation[] = [];
  for (const spec of specs) {
    violations.push(...verifySpec(spec, sources));
  }
  return { violations };
}
