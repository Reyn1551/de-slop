import { rules } from './rules/index';
import { fs, sync, type SourceFile } from './ts-api';
import type { Diagnostic, RuleContext } from './types';
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

type FileSystem = ReturnType<typeof fs.createVirtualFileSystem>;
type Snapshot = ReturnType<InstanceType<typeof sync.API>['updateSnapshot']>;

export interface ScanOptions {
  rules?: string[];
}

export interface SourceInput {
  code: string;
  filePath: string;
}

/**
 * One parse session: a virtual filesystem, an API over it, one snapshot, and a
 * slot counter.
 *
 * `updateSnapshot` costs time proportional to what the snapshot already holds.
 * A fresh snapshot per file made a whole-repository scan quadratic: 162 files
 * took 126 seconds. One snapshot for the run parses the same 162 in 186ms.
 */
export class ParseSession {
  private readonly virtualFs: FileSystem;
  private readonly api: InstanceType<typeof sync.API>;
  private snapshot: Snapshot | undefined;
  private slot = 0;

  constructor() {
    this.virtualFs = fs.createVirtualFileSystem({});
    this.api = new sync.API({ fs: this.virtualFs });
  }

  private pathFor(filePath: string): string {
    return `/slop-scan/${this.slot++}/${filePath.replace(/^\/+/, '')}`;
  }

  /** Parse every source in one snapshot. Returns a map from file path to tree. */
  parseAll(sources: SourceInput[]): Map<string, SourceFile> {
    const parsed = new Map<string, SourceFile>();
    const uris: { uri: string }[] = [];
    const byUri = new Map<string, string>();

    for (const source of sources) {
      const absolutePath = this.pathFor(source.filePath);
      this.virtualFs.writeFile!(absolutePath, source.code);
      const uri = `file://${absolutePath}`;
      uris.push({ uri });
      byUri.set(uri, source.filePath);
    }

    if (uris.length === 0) return parsed;
    this.snapshot = this.api.updateSnapshot({ openFiles: uris });

    for (const { uri } of uris) {
      const sourceFile = this.snapshot.getDefaultProjectForFile({ uri })?.program.getSourceFile({ uri });
      if (sourceFile) parsed.set(byUri.get(uri)!, sourceFile);
    }
    return parsed;
  }

  parse(code: string, filePath: string): SourceFile {
    const parsed = this.parseAll([{ code, filePath }]);
    const sourceFile = parsed.get(filePath);
    if (!sourceFile) throw new Error(`slop-scanner: failed to parse ${filePath}`);
    return sourceFile;
  }
}

let sharedSession: ParseSession | undefined;

function getSession(): ParseSession {
  sharedSession ??= new ParseSession();
  return sharedSession;
}

/**
 * Parse one file. Kept for callers that hold a single file; a batch scan should
 * use `scanSources` so the whole run shares one snapshot.
 */
export function parseSourceFile(code: string, filePath: string): SourceFile {
  return getSession().parse(code, filePath);
}

function contextFor(filePath: string): RuleContext {
  return {
    filePath,
    fileExists(candidate: string) {
      try {
        const target = resolve(dirname(filePath), candidate);
        return existsSync(target) || statSync(target).isFile();
      } catch {
        return false;
      }
    },
  };
}

function activeRules(options: ScanOptions) {
  return options.rules ? rules.filter((rule) => options.rules!.includes(rule.id)) : rules;
}

function runRules(
  sourceFile: SourceFile,
  filePath: string,
  options: ScanOptions,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const context = contextFor(filePath);
  for (const rule of activeRules(options)) {
    for (const finding of rule.check(sourceFile, context)) {
      diagnostics.push({ ...finding, ruleId: rule.id, filePath });
    }
  }
  return diagnostics;
}

export function scanSource(code: string, filePath: string, options: ScanOptions = {}): Diagnostic[] {
  return runRules(parseSourceFile(code, filePath), filePath, options);
}

/**
 * Scan many sources in one parse session. Returns diagnostics in input order.
 * A file that fails to parse contributes one `scan-error` entry and the rest of
 * the batch continues.
 */
export function scanSources(sources: SourceInput[], options: ScanOptions = {}): Diagnostic[][] {
  const session = new ParseSession();
  const results: Diagnostic[][] = [];

  try {
    const parsed = session.parseAll(sources);
    for (const source of sources) {
      const sourceFile = parsed.get(source.filePath);
      if (!sourceFile) {
        results.push([{
          ruleId: 'scan-error',
          severity: 'error',
          message: `slop-scanner: failed to parse ${source.filePath}`,
          filePath: source.filePath,
          line: 0,
          column: 0,
        }]);
        continue;
      }
      results.push(runRules(sourceFile, source.filePath, options));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    for (const source of sources) {
      results.push([{
        ruleId: 'scan-error',
        severity: 'error',
        message,
        filePath: source.filePath,
        line: 0,
        column: 0,
      }]);
    }
  }

  return results;
}
