import { fetchNpmDownloads, fetchNpmInfo, fetchPypiInfo } from './registry';
import { decideVerdict, DEFAULT_TIMEOUT_MS } from './verdict';
import type { Ecosystem, GateOptions, PackageReport } from './types';

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
