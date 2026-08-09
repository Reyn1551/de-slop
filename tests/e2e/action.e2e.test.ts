import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(__dirname, '..', '..');
const actionEntry = join(root, 'packages/action/index.js');
const fixtures = join(root, 'tests/fixtures');

function runAction(inputs: Record<string, string>): { stdout: string; status: number } {
  const env = {
    ...process.env,
    ...Object.fromEntries(Object.entries(inputs).map(([k, v]) => [`INPUT_${k.toUpperCase()}`, v])),
  } as NodeJS.ProcessEnv;
  try {
    const stdout = execFileSync(process.execPath, [actionEntry], { env, encoding: 'utf8', timeout: 30000 });
    return { stdout, status: 0 };
  } catch (err: any) {
    return { stdout: `${err.stdout ?? ''}${err.stderr ?? ''}`, status: err.status ?? 1 };
  }
}

describe('gh action runtime e2e', () => {
  it('exits 1 on slop fixture', () => {
    const { stdout, status } = runAction({ command: 'check', paths: join(fixtures, 'slop-fixture.ts') });
    expect(status).toBe(1);
    expect(stdout).toContain('no-hardcoded-secret');
  });

  it('exits 0 on clean fixture', () => {
    const { stdout, status } = runAction({ command: 'check', paths: join(fixtures, 'clean-fixture.ts') });
    expect(status).toBe(0);
    expect(stdout).toContain('0 problems found');
  });
});
