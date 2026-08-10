import { describe, expect, it } from 'vitest';
import { scanDesignSlop, DESIGN_SLOP_RULE_IDS } from './index';

// ---- fixtures ----

const SLOP_TSX = `
import { useState } from 'react';

export default function Hero() {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <div className="absolute w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl animate-pulse" />
      <div className="absolute w-80 h-80 rounded-full bg-purple-600/15 blur-3xl animate-pulse" />
      <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-400">Real-Time</span>
      <h1 className="mt-10 text-center text-5xl font-bold tracking-tight text-white">
        Build the future
      </h1>
      <p className="mx-auto max-w-2xl text-center text-lg text-slate-400">
        Ship faster with AI-powered workflows trusted by 10,000+ developers.
      </p>
      <a className="from-indigo-600 via-indigo-500 to-purple-600 bg-gradient-to-r px-6 py-3 text-white shadow-indigo-500/40 shadow-purple-500/20">
        Get Started
      </a>
      <div className="shadow-indigo-500/25 text-slate-500">stats</div>
      <div className="grid grid-cols-3 gap-4">
        <p>How it works</p>
        <p>FAQ</p>
        <p>Trusted by</p>
      </div>
    </div>
  );
}
`;

const CLEAN_TSX = `
import { useState } from 'react';

export default function Hero() {
  return (
    <div className="relative min-h-screen bg-stone-950 overflow-hidden">
      <h1 className="mt-10 text-center text-5xl font-bold tracking-tight text-stone-50">
        The honest banking ledger
      </h1>
      <p className="mx-auto max-w-2xl text-center text-lg text-stone-300">
        Transparent bookkeeping for indie studios.
      </p>
      <a className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-stone-950 shadow-md">
        Open your ledger
      </a>
    </div>
  );
}
`;

const SLOP_CSS = `
body {
  background: #000;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.hero-title {
  background: linear-gradient(135deg, #a5b4fc, #6366f1, #c084fc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.btn-primary {
  background: linear-gradient(to right, #6366f1, #8b5cf6);
  box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
}
.card { backdrop-filter: blur(16px); }
.nav { backdrop-filter: blur(12px); position: sticky; top: 0; }
`;

// ---- tests ----

describe('design-slop', () => {
  it('exposes 11 rules', () => {
    expect(DESIGN_SLOP_RULE_IDS).toHaveLength(11);
  });

  it('detects purple palette + gradient as error', () => {
    const diags = scanDesignSlop(SLOP_TSX, '/tmp/hero.tsx');
    const purple = diags.find((d) => d.ruleId === 'no-ai-purple');
    expect(purple).toBeDefined();
    expect(purple?.severity).toBe('error');
  });

  it('detects stock gradient button recipe as error', () => {
    const diags = scanDesignSlop(SLOP_TSX, '/tmp/hero.tsx');
    const btn = diags.find((d) => d.ruleId === 'no-gradient-button');
    expect(btn).toBeDefined();
    expect(btn?.severity).toBe('error');
  });

  it('detects gradient text', () => {
    const diags = scanDesignSlop(SLOP_CSS, '/tmp/index.css');
    const txt = diags.find((d) => d.ruleId === 'no-gradient-text');
    expect(txt).toBeDefined();
  });

  it('exempts nav glassmorphism but flags 2+ non-nav', () => {
    const diags = scanDesignSlop(SLOP_CSS, '/tmp/index.css');
    const glass = diags.find((d) => d.ruleId === 'no-glassmorphism');
    // 1 card (non-nav) + 1 nav => non-nav = 1 < 3 => no flag
    expect(glass).toBeUndefined();
  });

  it('flags glow shadows (2+)', () => {
    const diags = scanDesignSlop(SLOP_TSX, '/tmp/hero.tsx');
    expect(diags.some((d) => d.ruleId === 'no-glow-shadow')).toBe(true);
  });

  it('flags gradient blobs without reduced-motion guard as error', () => {
    const diags = scanDesignSlop(SLOP_TSX, '/tmp/hero.tsx');
    const blob = diags.find((d) => d.ruleId === 'no-gradient-blob');
    expect(blob).toBeDefined();
    expect(blob?.severity).toBe('error');
  });

  it('flags dark grey text on dark bg as error (WCAG)', () => {
    const diags = scanDesignSlop(SLOP_TSX, '/tmp/hero.tsx');
    const grey = diags.find((d) => d.ruleId === 'no-dark-grey-text' && d.severity === 'error');
    expect(grey).toBeDefined();
    expect(grey?.severity).toBe('error');
  });

  it('flags pure black page background', () => {
    const diags = scanDesignSlop(SLOP_CSS, '/tmp/index.css');
    expect(diags.some((d) => d.ruleId === 'no-pure-black-bg')).toBe(true);
  });

  it('flags Inter single-font page (unquoted + fallback list)', () => {
    const diags = scanDesignSlop(SLOP_CSS, '/tmp/index.css');
    expect(diags.some((d) => d.ruleId === 'no-slop-font')).toBe(true);
  });

  it('flags hero pill badge above h1', () => {
    const pill = `
export default function Hero() {
  return (
    <section>
      <Badge variant="glowing" className="px-4 py-1.5 text-xs font-mono tracking-wide uppercase">🚀 Inspired by Foo Workflow</Badge>
      <h1 className="text-5xl font-black">Build the Future</h1>
      <p>Subtext.</p>
    </section>
  );
}`;
    const diags = scanDesignSlop(pill, '/tmp/hero-pill.tsx');
    const hit = diags.find((d) => d.ruleId === 'no-hero-pill');
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe('warning');
  });

  it('flags emoji as icon in pill', () => {
    const emoji = `
export default function Feature() {
  return (
    <div className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs">
      🚀 Inspired by NgodingPakeAI Workflow
    </div>
  );
}`;
    const diags = scanDesignSlop(emoji, '/tmp/emoji.tsx');
    expect(diags.some((d) => d.ruleId === 'no-emoji-as-icon')).toBe(true);
  });

  it('does not flag emoji in body copy', () => {
    const body = `
const content = "Tips for your team 🎉 — read the full guide below.";
export default function Post() {
  return <p>{content}</p>;
}`;
    const diags = scanDesignSlop(body, '/tmp/post.tsx');
    expect(diags.some((d) => d.ruleId === 'no-emoji-as-icon')).toBe(false);
  });

  it('bundle: >=4 tells in one file => design-slop-bundle error', () => {
    const diags = scanDesignSlop(SLOP_TSX, '/tmp/hero.tsx');
    const bundle = diags.find((d) => d.ruleId === 'design-slop-bundle');
    expect(bundle).toBeDefined();
    expect(bundle?.severity).toBe('error');
  });

  it('clean design => zero diagnostics', () => {
    const diags = scanDesignSlop(CLEAN_TSX, '/tmp/clean.tsx');
    expect(diags).toHaveLength(0);
  });

  it('respects options.rules filter', () => {
    const diags = scanDesignSlop(SLOP_TSX, '/tmp/hero.tsx', { rules: ['no-ai-purple'] });
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe('no-ai-purple');
  });

  it('diagnostics carry filePath + line + column', () => {
    const diags = scanDesignSlop(SLOP_TSX, '/tmp/hero.tsx');
    for (const d of diags) {
      expect(d.filePath).toBe('/tmp/hero.tsx');
      expect(d.line).toBeGreaterThan(0);
      expect(d.column).toBeGreaterThan(0);
    }
  });
});
