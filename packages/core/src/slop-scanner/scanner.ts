import { rules } from './rules/index';
import { fs, sync, type SourceFile } from './ts-api';
import type { Diagnostic } from './types';

type FileSystem = ReturnType<typeof fs.createVirtualFileSystem>;

export interface ScanOptions {
  rules?: string[];
}

let sharedApi: InstanceType<typeof sync.API> | undefined;
let sharedFs: FileSystem | undefined;
let nextFileSlot = 0;

function getApi(): InstanceType<typeof sync.API> {
  if (!sharedApi) {
    sharedFs = fs.createVirtualFileSystem({});
    sharedApi = new sync.API({ fs: sharedFs });
  }
  return sharedApi;
}

export function parseSourceFile(code: string, filePath: string): SourceFile {
  const api = getApi();
  const absolutePath = `/slop-scan/${nextFileSlot++}/${filePath.replace(/^\/+/, '')}`;
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
  for (const rule of active) {
    for (const finding of rule.check(sourceFile)) {
      diagnostics.push({ ...finding, ruleId: rule.id, filePath });
    }
  }
  return diagnostics;
}
