export interface Spec {
  id: string;
  description?: string;
  functions: string[];
  invariants: string[];
}

type ListKey = 'functions' | 'invariants';

interface ItemState {
  startLine: number;
  id?: string;
  description?: string;
  functions: string[];
  invariants: string[];
  listKey: ListKey | null;
}

function parseInlineList(value: string, line: number): string[] {
  const items = value
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (items.length === 0 && value.slice(1, -1).trim() !== '') {
    throw new Error(`spec-contractor: malformed list on line ${line}: '${value}'`);
  }
  return items;
}

export function parseSpecFile(content: string): Spec[] {
  const lines = content.split(/\r?\n/);
  const specs: Spec[] = [];
  let specsHeaderSeen = false;
  let item: ItemState | null = null;

  const finishItem = (): void => {
    if (item) {
      if (!item.id) {
        throw new Error(`spec-contractor: spec item missing required 'id' (line ${item.startLine})`);
      }
      specs.push({
        id: item.id,
        ...(item.description ? { description: item.description } : {}),
        functions: item.functions,
        invariants: item.invariants,
      });
      item = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;

    if (!specsHeaderSeen) {
      if (indent === 0 && trimmed === 'specs:') {
        specsHeaderSeen = true;
        continue;
      }
      throw new Error(`spec-contractor: expected top-level 'specs:' key, found '${trimmed}' (line ${i + 1})`);
    }

    if (indent === 2 && trimmed.startsWith('- ')) {
      finishItem();
      const [key, ...valueParts] = trimmed.slice(2).split(':');
      const value = valueParts.join(':').trim();
      if (!value) {
        throw new Error(`spec-contractor: spec item key '${key}' has no value (line ${i + 1})`);
      }
      item = { startLine: i + 1, id: undefined, description: undefined, functions: [], invariants: [], listKey: null };
      if (key === 'id') {
        item.id = value;
      } else if (key === 'description') {
        item.description = value;
      } else if (key === 'functions' || key === 'invariants') {
        if (!value.startsWith('[')) {
          throw new Error(`spec-contractor: '${key}' must be a list, got '${value}' (line ${i + 1})`);
        }
        item[key] = parseInlineList(value, i + 1);
        item.listKey = key;
      } else {
        throw new Error(`spec-contractor: unknown spec key '${key}' (line ${i + 1})`);
      }
      continue;
    }

    if (indent === 4) {
      if (!item) {
        throw new Error(`spec-contractor: key outside of a spec item (line ${i + 1})`);
      }
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      if (key === 'id' || key === 'description') {
        item[key] = value || undefined;
        item.listKey = null;
      } else if (key === 'functions' || key === 'invariants') {
        item[key] = value === '' ? [] : parseInlineList(value, i + 1);
        item.listKey = key;
      } else {
        throw new Error(`spec-contractor: unknown spec key '${key}' (line ${i + 1})`);
      }
      continue;
    }

    if (indent === 6 && trimmed.startsWith('- ')) {
      if (!item || !item.listKey) {
        throw new Error(`spec-contractor: list item outside of a list key (line ${i + 1})`);
      }
      const value = trimmed.slice(2).trim();
      if (!value) {
        throw new Error(`spec-contractor: empty list item (line ${i + 1})`);
      }
      item[item.listKey].push(value);
      continue;
    }

    throw new Error(`spec-contractor: unexpected line '${trimmed}' (line ${i + 1})`);
  }

  finishItem();
  if (specs.length === 0) {
    throw new Error('spec-contractor: no specs defined');
  }
  return specs;
}
