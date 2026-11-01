import { rules } from './rules/index';
import { fs, sync, type SourceFile } from './ts-api';
import type { Diagnostic, RuleContext } from './types';
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';

type FileSystem = ReturnType<typeof fs.createVirtualFileSystem>;

export interface ScanOptions {
  rules?: string[];
}

let sharedApi: InstanceType<typeof sync.API> | undefined;
let sharedFs: FileSystem | undefined;
let nextFileSlot = 0;

// The virtual FS keeps every file ever written. An MCP server stays up for a
// whole session and scans thousands of files, so the slots wrap: each parse
// reuses one of a fixed set of paths. A SourceFile materializes its text when
// it is created, so overwriting an old slot cannot corrupt an earlier result.
const MAX_SLOTS = 512;

function getApi(): InstanceType<typeof sync.API> {
  if (!sharedApi) {
    sharedFs = fs.createVirtualFileSystem({});
    sharedApi = new sync.API({ fs: sharedFs });
  }
  return sharedApi;
}

export function parseSourceFile(code: string, filePath: string): SourceFile {
  const api = getApi();
  const slot = nextFileSlot++ % MAX_SLOTS;
  const absolutePath = `/slop-scan/${slot}/${filePath.replace(/^\/+/, '')}`;
  sharedFs!.writeFile!(absolutePath, code);
  const uri = `file://${absolutePath}`;
  const snapshot = api.updateSnapshot({ openFiles: [{ uri }] });
  const sourceFile = snapshot.getDefaultProjectForFile({ uri })?.program.getSourceFile({ uri });
  if (!sourceFile) {
    throw new Error(`slop-scanner: failed to parse ${filePath}`);
  }
  return sourceFile;
}

export function scanSource(code: string, filePath: string, options: ScanOptions = {}): Diagnostic[] {
  const sourceFile = parseSourceFile(code, filePath);
  const active = options.rules ? rules.filter((rule) => options.rules!.includes(rule.id)) : rules;
  const diagnostics: Diagnostic[] = [];
  const ctx: RuleContext = {
    filePath,
    fileExists(p: string) {
      try {
        return existsSync(resolve(dirname(filePath), p)) || statSync(resolve(dirname(filePath), p)).isFile();
      } catch { return false; }
    },
  };
  for (const rule of active) {
    for (const finding of rule.check(sourceFile, ctx)) {
      diagnostics.push({ ...finding, ruleId: rule.id, filePath });
    }
  }
  return diagnostics;
}
