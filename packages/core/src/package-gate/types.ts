export type Ecosystem = 'npm' | 'pypi';
export type Verdict = 'ok' | 'suspicious' | 'not-found' | 'unknown';

export interface PackageReport {
  name: string;
  ecosystem: Ecosystem;
  verdict: Verdict;
  reasons: string[];
  ageInDays?: number;
  weeklyDownloads?: number;
}

export interface GateOptions {
  minAgeDays?: number;
  minWeeklyDownloads?: number;
  timeoutMs?: number;
}
