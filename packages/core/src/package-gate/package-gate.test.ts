import { describe, expect, it } from 'vitest';
import { parseInstallCommand } from './intercept';
import { decideVerdict } from './verdict';

describe('parseInstallCommand', () => {
  it('parses npm install with multiple packages', () => {
    expect(parseInstallCommand('npm install lodash express zod')).toEqual({
      ecosystem: 'npm',
      packages: ['lodash', 'express', 'zod'],
    });
  });

  it('parses npm i with flags stripped', () => {
    expect(parseInstallCommand('npm i -D typescript @types/node')).toEqual({
      ecosystem: 'npm',
      packages: ['typescript', '@types/node'],
    });
  });

  it('parses npx taking only the first package and stripping version', () => {
    expect(parseInstallCommand('npx create-next-app@14 my-app')).toEqual({
      ecosystem: 'npm',
      packages: ['create-next-app'],
    });
  });

  it('parses yarn add', () => {
    expect(parseInstallCommand('yarn add react react-dom')).toEqual({
      ecosystem: 'npm',
      packages: ['react', 'react-dom'],
    });
  });

  it('parses pnpm add with long flags stripped', () => {
    expect(parseInstallCommand('pnpm add --save-dev vitest')).toEqual({
      ecosystem: 'npm',
      packages: ['vitest'],
    });
  });

  it('parses pip install with version specifiers stripped', () => {
    expect(parseInstallCommand('pip install requests==2.31.0 flask>=2.0')).toEqual({
      ecosystem: 'pypi',
      packages: ['requests', 'flask'],
    });
  });

  it('parses pip3 install with upgrade flag', () => {
    expect(parseInstallCommand('pip3 install --upgrade numpy')).toEqual({
      ecosystem: 'pypi',
      packages: ['numpy'],
    });
  });

  it('keeps scoped npm packages and strips their version', () => {
    expect(parseInstallCommand('npm install @scope/pkg@1.2.3')).toEqual({
      ecosystem: 'npm',
      packages: ['@scope/pkg'],
    });
  });

  it('strips version from plain npm specifiers', () => {
    expect(parseInstallCommand('npm install foo@1.2.3 bar@latest')).toEqual({
      ecosystem: 'npm',
      packages: ['foo', 'bar'],
    });
  });

  it('returns null for non-install commands', () => {
    expect(parseInstallCommand('npm run build')).toBeNull();
    expect(parseInstallCommand('git commit -m "x"')).toBeNull();
    expect(parseInstallCommand('ls -la')).toBeNull();
  });

  it('returns null for install command without packages', () => {
    expect(parseInstallCommand('npm install')).toBeNull();
    expect(parseInstallCommand('npm install --global')).toBeNull();
  });
});

describe('decideVerdict', () => {
  it('returns not-found when package does not exist', () => {
    const result = decideVerdict({ exists: false });
    expect(result.verdict).toBe('not-found');
    expect(result.reasons[0]).toContain('slopsquatting');
  });

  it('returns suspicious when package is younger than minAgeDays', () => {
    const result = decideVerdict({ exists: true, ageInDays: 3, weeklyDownloads: 50_000 });
    expect(result.verdict).toBe('suspicious');
    expect(result.reasons).toEqual(['created 3 days ago']);
  });

  it('returns suspicious when weekly downloads are below threshold', () => {
    const result = decideVerdict({ exists: true, ageInDays: 400, weeklyDownloads: 12 });
    expect(result.verdict).toBe('suspicious');
    expect(result.reasons).toEqual(['only 12 weekly downloads']);
  });

  it('returns suspicious with both reasons when both fail', () => {
    const result = decideVerdict({ exists: true, ageInDays: 5, weeklyDownloads: 10 });
    expect(result.verdict).toBe('suspicious');
    expect(result.reasons).toHaveLength(2);
  });

  it('returns ok when package passes all checks', () => {
    const result = decideVerdict({ exists: true, ageInDays: 900, weeklyDownloads: 1_000_000 });
    expect(result.verdict).toBe('ok');
    expect(result.reasons).toEqual([]);
  });

  it('returns unknown when no metadata is available', () => {
    const result = decideVerdict({ exists: true });
    expect(result.verdict).toBe('unknown');
  });

  it('respects custom thresholds', () => {
    const result = decideVerdict(
      { exists: true, ageInDays: 10, weeklyDownloads: 500 },
      { minAgeDays: 7, minWeeklyDownloads: 100 },
    );
    expect(result.verdict).toBe('ok');
  });

  it('treats boundary values as passing', () => {
    const result = decideVerdict(
      { exists: true, ageInDays: 30, weeklyDownloads: 100 },
      { minAgeDays: 30, minWeeklyDownloads: 100 },
    );
    expect(result.verdict).toBe('ok');
  });
});
