import type { GateOptions, Verdict } from './types';
import type { TyposquatMatch } from './typosquat';

export interface PackageInfo {
  exists: boolean;
  ageInDays?: number;
  weeklyDownloads?: number;
}

export interface VerdictResult {
  verdict: Verdict;
  reasons: string[];
}

export const DEFAULT_MIN_AGE_DAYS = 30;
export const DEFAULT_MIN_WEEKLY_DOWNLOADS = 100;
export const DEFAULT_TIMEOUT_MS = 5000;

export function decideVerdict(
  info: PackageInfo,
  options: GateOptions = {},
  typosquat: TyposquatMatch | null = null,
): VerdictResult {
  if (!info.exists) {
    return {
      verdict: 'not-found',
      reasons: ['package does not exist in registry — possible AI hallucination (slopsquatting risk)'],
    };
  }

  const minAgeDays = options.minAgeDays ?? DEFAULT_MIN_AGE_DAYS;
  const minWeeklyDownloads = options.minWeeklyDownloads ?? DEFAULT_MIN_WEEKLY_DOWNLOADS;

  const reasons: string[] = [];
  const tooYoung = info.ageInDays !== undefined && info.ageInDays < minAgeDays;
  const tooQuiet = info.weeklyDownloads !== undefined && info.weeklyDownloads < minWeeklyDownloads;

  if (tooYoung) reasons.push(`created ${info.ageInDays} days ago`);
  if (tooQuiet) reasons.push(`only ${info.weeklyDownloads} weekly downloads`);

  if (typosquat !== null) {
    const established =
      info.ageInDays !== undefined &&
      info.weeklyDownloads !== undefined &&
      !tooYoung &&
      !tooQuiet;

    if (established) {
      return {
        verdict: reasons.length > 0 ? 'suspicious' : 'ok',
        reasons: [...reasons, `name is ${typosquat.reason}; registry history looks established`],
      };
    }

    return {
      verdict: 'typosquat',
      reasons: [
        `name is ${typosquat.reason}`,
        ...(reasons.length > 0 ? reasons : ['registry history is too thin to rule out a squat']),
      ],
    };
  }

  if (info.ageInDays === undefined && info.weeklyDownloads === undefined) {
    return { verdict: 'unknown', reasons: ['no registry metadata available to evaluate'] };
  }

  return reasons.length > 0
    ? { verdict: 'suspicious', reasons }
    : { verdict: 'ok', reasons: [] };
}
