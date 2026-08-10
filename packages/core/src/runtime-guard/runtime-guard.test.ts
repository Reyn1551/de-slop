import { describe, expect, it } from 'vitest';
import { guardSource } from './index';

function ruleIds(code: string, path = 'sample.ts'): string[] {
  return guardSource(code, path).map((d) => d.ruleId);
}

describe('require-cleanup', () => {
  it('flags addEventListener without removeEventListener', () => {
    const code = `
window.addEventListener('click', () => {});
`;
    expect(ruleIds(code)).toContain('require-cleanup');
  });

  it('passes paired add/removeEventListener', () => {
    const code = `
const onClick = () => {};
window.addEventListener('click', onClick);
window.removeEventListener('click', onClick);
`;
    expect(ruleIds(code)).not.toContain('require-cleanup');
  });

  it('flags setInterval without clearInterval', () => {
    const code = `
const timer = setInterval(() => {}, 1000);
`;
    expect(ruleIds(code)).toContain('require-cleanup');
  });

  it('passes setInterval paired with clearInterval', () => {
    const code = `
const timer = setInterval(() => {}, 1000);
clearInterval(timer);
`;
    expect(ruleIds(code)).not.toContain('require-cleanup');
  });

  it('flags useEffect without cleanup return', () => {
    const code = `
useEffect(() => {
  window.addEventListener('click', onClick);
}, []);
`;
    expect(ruleIds(code)).toContain('require-cleanup');
  });

  it('passes useEffect with cleanup return', () => {
    const code = `
useEffect(() => {
  window.addEventListener('click', onClick);
  return () => window.removeEventListener('click', onClick);
}, []);
`;
    expect(ruleIds(code)).not.toContain('require-cleanup');
  });
});

describe('no-floating-promise', () => {
  it('flags a bare fetchData() call', () => {
    const code = `
async function fetchData() {}
fetchData();
`;
    expect(ruleIds(code)).toContain('no-floating-promise');
  });

  it('flags a bare fetch() call', () => {
    const code = `
fetch('/api');
`;
    expect(ruleIds(code)).toContain('no-floating-promise');
  });

  it('passes awaited call', () => {
    const code = `
async function fetchData() {}
await fetchData();
`;
    expect(ruleIds(code)).not.toContain('no-floating-promise');
  });

  it('passes void-wrapped call', () => {
    const code = `
void fetch('/api');
`;
    expect(ruleIds(code)).not.toContain('no-floating-promise');
  });

  it('passes .catch() chained call', () => {
    const code = `
fetch('/api').catch(() => {});
`;
    expect(ruleIds(code)).not.toContain('no-floating-promise');
  });
});

describe('no-unhandled-null', () => {
  it('flags direct property access on find result', () => {
    const code = `
const name = arr.find(x => x.ok).name;
`;
    expect(ruleIds(code)).toContain('no-unhandled-null');
  });

  it('passes optional chaining', () => {
    const code = `
const name = arr.find(x => x.ok)?.name;
`;
    expect(ruleIds(code)).not.toContain('no-unhandled-null');
  });

  it('passes guarded variable', () => {
    const code = `
const found = arr.find(x => x.ok);
if (found) {
  const name = found.name;
}
`;
    expect(ruleIds(code)).not.toContain('no-unhandled-null');
  });

  it('flags getElementById chain', () => {
    const code = `
document.getElementById('root').innerHTML = '';
`;
    expect(ruleIds(code)).toContain('no-unhandled-null');
  });
});

describe('no-uncleaned-timer', () => {
  it('flags setTimeout without cleanup', () => {
    const code = `
function showToast(msg: string) {
  setToastMsg(msg);
  setTimeout(() => setToastMsg(null), 3000);
}
`;
    expect(ruleIds(code)).toContain('no-uncleaned-timer');
  });

  it('skips setTimeout inside useEffect with cleanup', () => {
    const code = `
useEffect(() => {
  const id = setTimeout(() => run(), 1000);
  return () => clearTimeout(id);
}, []);
`;
    expect(ruleIds(code)).not.toContain('no-uncleaned-timer');
  });
});
