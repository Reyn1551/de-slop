import { describe, expect, it } from 'vitest';
import { corpusSize, editDistance, findTyposquat, normalizePackageName } from './typosquat';
import { decideVerdict } from './verdict';

describe('editDistance', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('lodash', 'lodash')).toBe(0);
  });

  it('counts a substitution', () => {
    expect(editDistance('lodash', 'lodasl')).toBe(1);
  });

  it('counts a transposition as one edit', () => {
    expect(editDistance('react', 'reacr')).toBe(1);
  });

  it('counts insertions', () => {
    expect(editDistance('express', 'expresss')).toBe(1);
  });
});

describe('normalizePackageName', () => {
  it('strips the npm scope', () => {
    expect(normalizePackageName('@types/node')).toBe('node');
  });

  it('strips separators', () => {
    expect(normalizePackageName('lodash.merge')).toBe('lodashmerge');
    expect(normalizePackageName('node_fetch')).toBe('nodefetch');
  });
});

describe('findTyposquat', () => {
  it('ignores exact corpus names', () => {
    expect(findTyposquat('react', 'npm')).toBeNull();
    expect(findTyposquat('requests', 'pypi')).toBeNull();
  });

  it('ignores short names', () => {
    expect(findTyposquat('pg', 'npm')).toBeNull();
  });

  it('ignores allowlisted variants', () => {
    expect(findTyposquat('react-router-dom', 'npm')).toBeNull();
    expect(findTyposquat('pytest-asyncio', 'pypi')).toBeNull();
  });

  it('flags a one-character npm variant', () => {
    const match = findTyposquat('lodasl', 'npm');
    expect(match?.target).toBe('lodash');
    expect(match?.distance).toBe(1);
  });

  it('flags a transposed npm variant', () => {
    const match = findTyposquat('axois', 'npm');
    expect(match?.target).toBe('axios');
  });

  it('flags a separator variant', () => {
    const match = findTyposquat('react_dom', 'npm');
    expect(match?.target).toBe('react-dom');
    expect(match?.distance).toBe(0);
  });

  it('leaves established sub-packages alone', () => {
    expect(findTyposquat('lodash.merge', 'npm')).toBeNull();
  });

  it('flags a scoped variant of a popular name', () => {
    const match = findTyposquat('@evil/react-dom', 'npm');
    expect(match?.target).toBe('react-dom');
  });

  it('flags a pypi variant', () => {
    const match = findTyposquat('reqeusts', 'pypi');
    expect(match?.target).toBe('requests');
  });

  it('leaves unrelated names alone', () => {
    expect(findTyposquat('my-internal-design-system', 'npm')).toBeNull();
  });

  it('covers both ecosystems', () => {
    expect(corpusSize('npm')).toBeGreaterThan(100);
    expect(corpusSize('pypi')).toBeGreaterThan(60);
  });
});

describe('decideVerdict with typosquat evidence', () => {
  it('returns typosquat when the name mimics a popular package and history is thin', () => {
    const result = decideVerdict(
      { exists: true, ageInDays: 4, weeklyDownloads: 30 },
      {},
      { name: 'lodasl', target: 'lodash', distance: 1, reason: 'edit distance 1 from "lodash"' },
    );
    expect(result.verdict).toBe('typosquat');
    expect(result.reasons.join(' ')).toContain('lodash');
  });

  it('keeps ok when an established package merely resembles a corpus name', () => {
    const result = decideVerdict(
      { exists: true, ageInDays: 2000, weeklyDownloads: 900_000 },
      {},
      { name: 'zodb', target: 'zod', distance: 1, reason: 'edit distance 1 from "zod"' },
    );
    expect(result.verdict).toBe('ok');
    expect(result.reasons.join(' ')).toContain('established');
  });

  it('returns typosquat for a fresh package with no metadata', () => {
    const result = decideVerdict(
      { exists: true },
      {},
      { name: 'axois', target: 'axios', distance: 1, reason: 'edit distance 1 from "axios"' },
    );
    expect(result.verdict).toBe('typosquat');
  });

  it('never returns typosquat for a missing package', () => {
    const result = decideVerdict({ exists: false }, {}, {
      name: 'nope',
      target: 'nope',
      distance: 1,
      reason: 'x',
    });
    expect(result.verdict).toBe('not-found');
  });
});
