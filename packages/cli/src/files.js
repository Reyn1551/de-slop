import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

export const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
export const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git']);

export function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(extname(filePath));
}

function walkDirectory(dir, files) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) walkDirectory(fullPath, files);
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
  for (const input of paths) {
    let stat;
    try {
      stat = statSync(input);
    } catch {
      missing.push(input);
      continue;
    }
    if (stat.isFile()) files.push(input);
    else if (stat.isDirectory()) walkDirectory(input, files);
  }
  return { files, missing };
}
