import { fetchNpmDownloads, fetchNpmInfo, fetchPypiInfo } from './registry';
import { decideVerdict, DEFAULT_TIMEOUT_MS } from './verdict';
import type { Ecosystem, GateOptions, PackageReport } from './types';

const SUSPICIOUS_SCRIPT_PATTERNS = [
  /\bcurl\b/,
  /\bwget\b/,
  /\bbase64\b/,
  /\beval\b/,
  /\bexec\b/,
  /child_process/,
  /fs\.chmod/,
  /chmod 777/,
  /sudo/,
  /__init__\.pth/,
  /rm -rf/,
  /sh -c/,
  /bash -c/,
];

export async function checkPackage(
  name: string,
  ecosystem: Ecosystem = 'npm',
  options: GateOptions = {},
): Promise<PackageReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (ecosystem === 'npm') {
    const [info, weeklyDownloads] = await Promise.all([
      fetchNpmInfo(name, timeoutMs),
      fetchNpmDownloads(name, timeoutMs),
    ]);

    if (info === null) {
      return { name, ecosystem, verdict: 'unknown', reasons: ['failed to reach npm registry'] };
    }

    const { verdict, reasons } = decideVerdict({ ...info, weeklyDownloads }, options);
    return { name, ecosystem, verdict, reasons, ageInDays: info.ageInDays, weeklyDownloads };
  }

  const info = await fetchPypiInfo(name, timeoutMs);
  if (info === null) {
    return { name, ecosystem, verdict: 'unknown', reasons: ['failed to reach PyPI registry'] };
  }

  const { verdict, reasons } = decideVerdict(info, options);
  return { name, ecosystem, verdict, reasons, ageInDays: info.ageInDays };
}

export function checkPackages(
  names: string[],
  ecosystem: Ecosystem = 'npm',
  options: GateOptions = {},
): Promise<PackageReport[]> {
  return Promise.all(names.map((name) => checkPackage(name, ecosystem, options)));
}

export interface ScriptFindings {
  name: string;
  script: string;
  verdict: 'block' | 'warn';
  reasons: string[];
}

export function checkPackageManifest(manifestJson: string): ScriptFindings[] {
  let manifest: { name?: string; scripts?: Record<string, string> };
  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    return [{ name: '<invalid json>', script: '', verdict: 'block', reasons: ['manifest is not valid JSON'] }];
  }

  const findings: ScriptFindings[] = [];
  const scripts = manifest.scripts ?? {};

  for (const [name, script] of Object.entries(scripts)) {
    const matches = SUSPICIOUS_SCRIPT_PATTERNS.filter((pattern) => pattern.test(script));
    if (matches.length === 0) continue;

    const malicious = matches.some((pattern) => /curl|wget|base64|__init__\.pth|sh -c|bash -c|eval|child_process/.test(pattern.source));
    findings.push({
      name,
      script,
      verdict: malicious ? 'block' : 'warn',
      reasons: matches.map((pattern) => `script matches suspicious pattern ${pattern.source}`),
    });
  }

  return findings;
}
