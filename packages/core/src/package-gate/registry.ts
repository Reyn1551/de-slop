import type { PackageInfo } from './verdict';
import { DEFAULT_TIMEOUT_MS } from './verdict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(isoDate: string): number | undefined {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.floor((Date.now() - timestamp) / MS_PER_DAY);
}

interface NpmRegistryResponse {
  time?: { created?: string; modified?: string };
}

interface NpmDownloadsResponse {
  downloads?: number;
}

interface PypiResponse {
  urls?: Array<{ upload_time_iso_8601?: string }>;
  releases?: Record<string, Array<{ upload_time_iso_8601?: string }>>;
}

export async function fetchNpmInfo(name: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<PackageInfo | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404) return { exists: false };
    if (!response.ok) return null;

    const data = (await response.json()) as NpmRegistryResponse;
    const created = data.time?.created;
    return { exists: true, ageInDays: created ? daysSince(created) : undefined };
  } catch {
    return null;
  }
}

export async function fetchNpmDownloads(name: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<number | undefined> {
  try {
    const response = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return undefined;

    const data = (await response.json()) as NpmDownloadsResponse;
    return typeof data.downloads === 'number' ? data.downloads : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchPypiInfo(name: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<PackageInfo | null> {
  try {
    const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404) return { exists: false };
    if (!response.ok) return null;

    const data = (await response.json()) as PypiResponse;
    const earliest = earliestUploadTime(data);
    return { exists: true, ageInDays: earliest ? daysSince(earliest) : undefined };
  } catch {
    return null;
  }
}

function earliestUploadTime(data: PypiResponse): string | undefined {
  const times: string[] = [];

  const latestUpload = data.urls?.[0]?.upload_time_iso_8601;
  if (latestUpload) times.push(latestUpload);

  for (const files of Object.values(data.releases ?? {})) {
    for (const file of files) {
      if (file.upload_time_iso_8601) times.push(file.upload_time_iso_8601);
    }
  }

  if (times.length === 0) return undefined;
  return times.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
}
