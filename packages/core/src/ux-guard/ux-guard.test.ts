import { describe, expect, it } from 'vitest';
import { scanUx, UX_RULE_IDS } from './index';

// ---- fixtures ----

const CLEAN_TSX = `
export default function Contact() {
  return (
    <form className="mx-auto max-w-md space-y-4 p-6">
      <label htmlFor="email" className="block text-sm font-medium">Email</label>
      <input id="email" type="email" placeholder="you@example.com" className="w-full rounded border p-2" />
      <button type="submit" className="h-11 w-full rounded bg-amber-500 text-stone-950">Send</button>
      <p className="text-sm text-stone-700">We reply within two days.</p>
    </form>
  );
}
`;

const SLOPPY_TSX = `
export default function Toolbar() {
  return (
    <div className="z-[9999]">
      <img src="/hero.png" />
      <button className="h-6 w-6 outline-none">
        <svg viewBox="0 0 24 24" />
      </button>
      <input placeholder="Search" type="search" />
      <p className="p-[10px] text-[10px] transition-all animate-pulse">Hover the row</p>
      <div className="opacity-0 hover:opacity-100">Actions</div>
    </div>
  );
}
`;

// ---- tests ----

describe('ux-guard', () => {
  it('exposes 12 rules', () => {
    expect(UX_RULE_IDS).toHaveLength(12);
  });

  describe('no-img-missing-alt', () => {
    it('flags <img> without alt as error', () => {
      const diags = scanUx('<img src="/hero.png" />', '/tmp/a.tsx', { rules: ['no-img-missing-alt'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('error');
    });

    it('accepts <img> with alt, including empty decorative alt', () => {
      const diags = scanUx(
        '<img src="/hero.png" alt="Team" />\n<img src="/divider.png" alt="" />',
        '/tmp/a.tsx',
        { rules: ['no-img-missing-alt'] },
      );
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-icon-button-unlabeled', () => {
    it('flags icon-only button without an accessible name', () => {
      const code = '<button className="p-2"><svg viewBox="0 0 24 24" /></button>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-icon-button-unlabeled'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('error');
    });

    it('flags icon-component-only button', () => {
      const code = '<button className="p-2"><Menu /></button>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-icon-button-unlabeled'] });
      expect(diags).toHaveLength(1);
    });

    it('accepts aria-label and text buttons', () => {
      const code = [
        '<button aria-label="Close"><svg viewBox="0 0 24 24" /></button>',
        '<button className="p-2">Save</button>',
      ].join('\n');
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-icon-button-unlabeled'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-focus-removed', () => {
    it('flags outline-none without a focus replacement', () => {
      const code = '<button className="outline-none p-2">Save</button>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-focus-removed'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('error');
    });

    it('accepts outline-none paired with focus-visible:ring', () => {
      const code = '<a className="outline-none focus-visible:ring-2" href="/docs">Docs</a>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-focus-removed'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-placeholder-label', () => {
    it('flags placeholder-only input', () => {
      const code = '<input type="email" placeholder="Email" />';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-placeholder-label'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('error');
    });

    it('accepts input bound to a nearby <label>', () => {
      const code = [
        '<label htmlFor="email">Email</label>',
        '<input id="email" type="email" placeholder="you@example.com" />',
      ].join('\n');
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-placeholder-label'] });
      expect(diags).toHaveLength(0);
    });

    it('accepts input with aria-label', () => {
      const code = '<input type="search" placeholder="Search" aria-label="Search" />';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-placeholder-label'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-zoom-block', () => {
    it('flags user-scalable=no', () => {
      const code = '<meta name="viewport" content="width=device-width, user-scalable=no" />';
      const diags = scanUx(code, '/tmp/index.html', { rules: ['no-zoom-block'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('error');
    });

    it('flags maximum-scale=1 without quotes', () => {
      const code = 'content="width=device-width, maximum-scale=1"';
      const diags = scanUx(code, '/tmp/index.html', { rules: ['no-zoom-block'] });
      expect(diags).toHaveLength(1);
    });

    it('accepts a zoomable viewport', () => {
      const code = 'content="width=device-width, initial-scale=1, maximum-scale=5"';
      const diags = scanUx(code, '/tmp/index.html', { rules: ['no-zoom-block'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-touch-target-small', () => {
    it('flags button below 44px in both dimensions', () => {
      const code = '<button className="h-6 w-6"><span /></button>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-touch-target-small'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('warning');
    });

    it('flags arbitrary sizes and icon-only single dimension', () => {
      const code = '<a className="h-[20px]" href="/x">x</a>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-touch-target-small'] });
      expect(diags).toHaveLength(1);
    });

    it('accepts 44px targets and mixed dimensions', () => {
      const code = [
        '<button className="h-11 w-11"><span /></button>',
        '<button className="h-6 w-40">Wide row</button>',
      ].join('\n');
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-touch-target-small'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-animation-without-reduced-motion', () => {
    it('flags animation with no reduced-motion guard, once per file', () => {
      const code = [
        '<div className="animate-pulse" />',
        '<div className="transition-colors" />',
      ].join('\n');
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-animation-without-reduced-motion'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('warning');
    });

    it('accepts animation guarded by motion-reduce', () => {
      const code = '<div className="animate-pulse motion-reduce:animate-none" />';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-animation-without-reduced-motion'] });
      expect(diags).toHaveLength(0);
    });

    it('accepts a prefers-reduced-motion media query in CSS', () => {
      const code = '.a { transition: opacity 200ms; }\n@media (prefers-reduced-motion: reduce) { .a { transition: none; } }';
      const diags = scanUx(code, '/tmp/index.css', { rules: ['no-animation-without-reduced-motion'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-layout-animation', () => {
    it('flags transition-all', () => {
      const code = '<div className="transition-all duration-300" />';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-layout-animation'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('warning');
    });

    it('flags keyframes animating width', () => {
      const code = '@keyframes grow { from { width: 0; } to { width: 100%; } }';
      const diags = scanUx(code, '/tmp/index.css', { rules: ['no-layout-animation'] });
      expect(diags).toHaveLength(1);
    });

    it('accepts transform-only transitions', () => {
      const code = [
        '<div className="transition-transform" />',
        '@keyframes fade { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: scale(1); } }',
      ].join('\n');
      const diags = scanUx(code, '/tmp/index.css', { rules: ['no-layout-animation'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-off-grid-spacing', () => {
    it('flags arbitrary spacing not on the 4px grid', () => {
      const code = '<div className="p-[10px] gap-[6px]" />';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-off-grid-spacing'] });
      expect(diags).toHaveLength(2);
      expect(diags[0].severity).toBe('warning');
    });

    it('accepts 4px multiples', () => {
      const code = '<div className="p-[12px] mt-[16px] gap-[8px]" />';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-off-grid-spacing'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-tiny-text', () => {
    it('flags text-[10px]', () => {
      const code = '<span className="text-[10px] uppercase">New</span>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-tiny-text'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('warning');
    });

    it('flags text-xs on paragraph content', () => {
      const code = '<p className="text-xs">Long explanatory prose here.</p>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-tiny-text'] });
      expect(diags).toHaveLength(1);
    });

    it('accepts text-[12px] and text-xs on labels', () => {
      const code = [
        '<span className="text-[12px]">Badge</span>',
        '<span className="text-xs text-stone-500">Metadata</span>',
      ].join('\n');
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-tiny-text'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-z-index-chaos', () => {
    it('flags z-index in the thousands', () => {
      const code = '<div className="z-[9999]" />';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-z-index-chaos'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('warning');
    });

    it('accepts a small layer scale', () => {
      const code = '<div className="z-[50]" />';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-z-index-chaos'] });
      expect(diags).toHaveLength(0);
    });
  });

  describe('no-hover-only', () => {
    it('flags hover-only reveal without a focus equivalent', () => {
      const code = '<div className="opacity-0 hover:opacity-100">Actions</div>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-hover-only'] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('warning');
    });

    it('accepts hover reveal with focus-within', () => {
      const code = '<div className="opacity-0 hover:opacity-100 focus-within:opacity-100">Actions</div>';
      const diags = scanUx(code, '/tmp/a.tsx', { rules: ['no-hover-only'] });
      expect(diags).toHaveLength(0);
    });
  });

  it('clean accessible JSX yields zero diagnostics', () => {
    const diags = scanUx(CLEAN_TSX, '/tmp/clean.tsx');
    expect(diags).toHaveLength(0);
  });

  it('sloppy component trips every category', () => {
    const diags = scanUx(SLOPPY_TSX, '/tmp/toolbar.tsx');
    const ids = new Set(diags.map((d) => d.ruleId));
    for (const id of [
      'no-img-missing-alt',
      'no-icon-button-unlabeled',
      'no-focus-removed',
      'no-placeholder-label',
      'no-touch-target-small',
      'no-animation-without-reduced-motion',
      'no-layout-animation',
      'no-off-grid-spacing',
      'no-tiny-text',
      'no-z-index-chaos',
      'no-hover-only',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('respects options.rules filter', () => {
    const diags = scanUx(SLOPPY_TSX, '/tmp/toolbar.tsx', { rules: ['no-img-missing-alt'] });
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe('no-img-missing-alt');
  });

  it('diagnostics carry filePath + line + column', () => {
    for (const d of scanUx(SLOPPY_TSX, '/tmp/toolbar.tsx')) {
      expect(d.filePath).toBe('/tmp/toolbar.tsx');
      expect(d.line).toBeGreaterThanOrEqual(1);
      expect(d.column).toBeGreaterThanOrEqual(1);
    }
  });

  it('skips its own rule sources and test files', () => {
    expect(scanUx('<img src="/x.png" />', '/repo/packages/core/src/ux-guard/rules/no-img-missing-alt.ts')).toHaveLength(0);
    expect(scanUx('<img src="/x.png" />', '/repo/packages/core/src/ux-guard/ux-guard.test.ts')).toHaveLength(0);
    expect(scanUx('<img src="/x.png" />', '/repo/packages/core/src/ux-guard/fixtures/bad.tsx')).toHaveLength(0);
  });
});
