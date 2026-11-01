import { normalizeColor } from './color';
import type { ContractParseError, DesignContract } from './types';

// A YAML subset, hand-rolled because the contract is small and a parser
// dependency would be the largest thing in the package. Supported shapes:
//
//   key: value
//   key:
//     nested: value
//     nested:
//       deeper: value
//   key:
//     - item
//     - item
//
// Anything else (anchors, multi-document, flow maps) is out of scope and is
// reported as a parse error rather than silently ignored.

interface Line {
  indent: number;
  content: string;
  number: number;
}

function indentOf(line: string): number {
  const match = /^[ \t]*/.exec(line);
  return match ? match[0].replace(/\t/g, '  ').length : 0;
}

function stripComment(line: string): string {
  let inQuote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (inQuote !== null) {
      if (character === inQuote) inQuote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      inQuote = character;
      continue;
    }
    if (character === '#' && (index === 0 || /\s/.test(line[index - 1]))) return line.slice(0, index);
  }
  return line;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseLines(body: string, startNumber: number): Line[] {
  const lines: Line[] = [];
  const raw = body.split('\n');
  for (let index = 0; index < raw.length; index += 1) {
    const withoutComment = stripComment(raw[index]);
    if (withoutComment.trim().length === 0) continue;
    lines.push({ indent: indentOf(withoutComment), content: withoutComment.trim(), number: startNumber + index });
  }
  return lines;
}

type Node = { kind: 'scalar'; value: string; number: number } | { kind: 'map'; entries: Map<string, Node>; number: number } | { kind: 'list'; items: Node[]; number: number };

function parseBlock(lines: Line[], start: number, indent: number): { node: Node; next: number } | ContractParseError {
  if (start >= lines.length) {
    return { path: '', message: 'unexpected end of frontmatter' };
  }

  const first = lines[start];
  if (first.content.startsWith('- ')) {
    const items: Node[] = [];
    let index = start;
    while (index < lines.length && lines[index].indent === indent && lines[index].content.startsWith('- ')) {
      const value = unquote(lines[index].content.slice(2));
      items.push({ kind: 'scalar', value, number: lines[index].number });
      index += 1;
    }
    return { node: { kind: 'list', items, number: first.number }, next: index };
  }

  const entries = new Map<string, Node>();
  let index = start;
  while (index < lines.length && lines[index].indent === indent) {
    const line = lines[index];
    const separator = line.content.indexOf(':');
    if (separator <= 0) {
      return { path: '', message: `line ${line.number}: expected "key: value"` };
    }
    const key = unquote(line.content.slice(0, separator));
    const inline = line.content.slice(separator + 1).trim();
    index += 1;

    if (inline.length > 0) {
      entries.set(key, { kind: 'scalar', value: unquote(inline), number: line.number });
      continue;
    }

    if (index < lines.length && lines[index].indent > indent) {
      const child = parseBlock(lines, index, lines[index].indent);
      if ('message' in child) return child;
      entries.set(key, child.node);
      index = child.next;
      continue;
    }

    entries.set(key, { kind: 'map', entries: new Map(), number: line.number });
  }

  return { node: { kind: 'map', entries, number: first.number }, next: index };
}

function scalarAt(node: Node, ...path: string[]): string | undefined {
  let current = node;
  for (const key of path) {
    if (current.kind !== 'map') return undefined;
    const next = current.entries.get(key);
    if (next === undefined) return undefined;
    current = next;
  }
  return current.kind === 'scalar' ? current.value : undefined;
}

function mapAt(node: Node, key: string): Map<string, Node> | undefined {
  if (node.kind !== 'map') return undefined;
  const child = node.entries.get(key);
  return child !== undefined && child.kind === 'map' ? child.entries : undefined;
}

function listAt(node: Node, key: string): string[] {
  if (node.kind !== 'map') return [];
  const child = node.entries.get(key);
  if (child === undefined || child.kind !== 'list') return [];
  return child.items.flatMap((item) => (item.kind === 'scalar' ? [item.value] : []));
}

/** Extract the `---` frontmatter block, or null when the file has none. */
export function extractFrontmatter(code: string): { body: string; startLine: number } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(code);
  if (!match) return null;
  return { body: match[1], startLine: 2 };
}

export function parseDesignContract(code: string, path: string): DesignContract | ContractParseError {
  const frontmatter = extractFrontmatter(code);
  if (frontmatter === null) {
    return { path, message: 'no YAML frontmatter block (expected a --- delimited header)' };
  }

  const lines = parseLines(frontmatter.body, frontmatter.startLine);
  if (lines.length === 0) return { path, message: 'frontmatter is empty' };

  const parsed = parseBlock(lines, 0, lines[0].indent);
  if ('message' in parsed) return { path, message: parsed.message };
  if (parsed.node.kind !== 'map') return { path, message: 'frontmatter must be a mapping' };

  const colors = new Map<string, string>();
  const colorEntries = mapAt(parsed.node, 'colors') ?? new Map<string, Node>();
  for (const [token, node] of colorEntries) {
    if (node.kind !== 'scalar') continue;
    const normalized = normalizeColor(node.value);
    if (normalized === null) {
      return { path, message: `line ${node.number}: cannot parse color "${node.value}" for token "${token}"` };
    }
    colors.set(token, normalized);
  }

  const typography = new Map<string, string>();
  const typeEntries = mapAt(parsed.node, 'typography') ?? new Map<string, Node>();
  for (const [token, node] of typeEntries) {
    const family = scalarAt(node, 'fontFamily');
    if (family === undefined) continue;
    typography.set(token, family);
  }

  const rounded = new Map<string, string>();
  const radiusEntries = mapAt(parsed.node, 'rounded') ?? new Map<string, Node>();
  for (const [token, node] of radiusEntries) {
    if (node.kind !== 'scalar') continue;
    const pixels = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(node.value);
    if (pixels === null) {
      return { path, message: `line ${node.number}: radius "${node.value}" for token "${token}" is not a pixel value` };
    }
    rounded.set(token, pixels[1]);
  }

  return {
    path,
    version: scalarAt(parsed.node, 'version') ?? 'unknown',
    colors,
    typography,
    rounded,
    omitted: listAt(parsed.node, 'omitted'),
    raw: code,
  };
}

export function isContractParseError(value: DesignContract | ContractParseError): value is ContractParseError {
  return 'message' in value && !('colors' in value);
}
