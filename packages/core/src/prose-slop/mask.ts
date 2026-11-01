import type { TextLocator } from './types';

/**
 * Replace everything that is not prose with spaces while keeping every offset
 * and newline in place. Rules can then report original positions directly.
 */
export function maskNonProse(code: string): string {
  const masked = code.split('');
  const blank = (start: number, end: number): void => {
    for (let index = start; index < end; index += 1) {
      if (masked[index] !== '\n') masked[index] = ' ';
    }
  };

  let cursor = 0;
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(code);
  if (frontmatter) {
    blank(0, frontmatter[0].length);
    cursor = frontmatter[0].length;
  }

  const fenced = /^([ \t]*)(```|~~~)[^\n]*\n[\s\S]*?^\1\2[^\n]*$/gm;
  for (const match of code.matchAll(fenced)) {
    const start = match.index ?? 0;
    if (start < cursor) continue;
    blank(start, start + match[0].length);
  }

  for (const match of code.matchAll(/`(?:(?!\n\n)[^`])+`/g)) {
    blank(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }

  for (const match of code.matchAll(/https?:\/\/[^\s)>\]]+/g)) {
    blank(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }

  for (const match of code.matchAll(/<\/?[a-zA-Z][^>\n]*>/g)) {
    blank(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }

  for (const match of code.matchAll(/^\s*\|.*$/gm)) {
    blank(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }

  for (const match of code.matchAll(/!?\[([^\]]*)\]\([^)]*\)/g)) {
    const start = match.index ?? 0;
    const label = match[1];
    const labelStart = start + match[0].indexOf(label);
    blank(start, labelStart);
    blank(labelStart + label.length, start + match[0].length);
  }

  // A document that quotes a phrase is naming it, not using it. The humanizer
  // source treats quotations the same way, so short quoted spans stay out of
  // every phrase rule.
  for (const match of code.matchAll(/"[^"\n]{1,160}"|“[^”\n]{1,160}”/g)) {
    blank(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }

  return masked.join('');
}

export function splitParagraphs(text: string): { text: string; start: number }[] {
  const paragraphs: { text: string; start: number }[] = [];
  const pattern = /[^\n]+(?:\n(?![ \t]*\n)[^\n]+)*/g;
  for (const match of text.matchAll(pattern)) {
    const value = match[0].trim();
    if (value.length === 0) continue;
    if (/^#{1,6}\s/.test(value)) continue;
    const offset = (match.index ?? 0) + match[0].indexOf(value);
    paragraphs.push({ text: value, start: offset });
  }
  return paragraphs;
}

export function splitSentences(text: string): { text: string; start: number }[] {
  const sentences: { text: string; start: number }[] = [];
  const pattern = /[^.!?\n]+[.!?]*/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const value = raw.trim();
    if (value.length < 3) continue;
    const offset = (match.index ?? 0) + raw.indexOf(value);
    sentences.push({ text: value, start: offset });
  }
  return sentences;
}

export function countWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
}

export function toColumn(loc: { line: number; character: number }): { line: number; column: number } {
  return { line: loc.line + 1, column: loc.character + 1 };
}

export function locatorFor(code: string): TextLocator {
  const lineStarts = [0];
  for (let index = 0; index < code.length; index += 1) {
    if (code[index] === '\n') lineStarts.push(index + 1);
  }
  return {
    getLineAndCharacterOfPosition(pos: number) {
      let low = 0;
      let high = lineStarts.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (lineStarts[mid] <= pos) low = mid;
        else high = mid - 1;
      }
      return { line: low, character: Math.max(0, pos - lineStarts[low]) };
    },
  };
}

/** Find every match of a pattern in masked prose. */
export function collect(text: string, pattern: RegExp): { match: string; index: number }[] {
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const hits: { match: string; index: number }[] = [];
  for (const match of text.matchAll(global)) {
    hits.push({ match: match[0], index: match.index ?? 0 });
  }
  return hits;
}
