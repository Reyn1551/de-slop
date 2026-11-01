import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

export const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css']);
export const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst']);
export const EXCLUDED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock']);
export const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git']);

export const CONFIG_FILE = '.desloprc.json';

export function loadExcludes(startDir = '.') {
  const excluded = new Set(EXCLUDED_DIRS);
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) {
      try {
        const cfg = JSON.parse(readFileSync(candidate, 'utf8'));
        if (Array.isArray(cfg.exclude)) {
          for (const pattern of cfg.exclude) {
            if (typeof pattern === 'string' && pattern.length > 0) {
              excluded.add(pattern);
              if (pattern.endsWith('/')) excluded.add(pattern.slice(0, -1));
            }
          }
        }
      } catch {
        /* ignore malformed config */
      }
      break;
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return excluded;
}

export function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(extname(filePath)) || DOC_EXTENSIONS.has(extname(filePath));
}

function walkDirectory(dir, files, excludes) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || excludes.has(entry.name) || EXCLUDED_FILES.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) walkDirectory(fullPath, files, excludes);
    else if (entry.isFile() && isSourceFile(fullPath)) files.push(fullPath);
  }
}

/**
 * Resolve the given paths into source files. Missing paths are returned so the
 * caller can report them clearly instead of silently scanning nothing.
 */
export function findSourceFiles(paths) {
  const files = [];
  const missing = [];
  const excludes = loadExcludes(process.cwd());
  for (const input of paths) {
    let stat;
    try {
      stat = statSync(input);
    } catch {
      missing.push(input);
      continue;
    }
    if (stat.isFile()) files.push(input);
    else if (stat.isDirectory()) walkDirectory(input, files, excludes);
  }
  return { files, missing };
}
