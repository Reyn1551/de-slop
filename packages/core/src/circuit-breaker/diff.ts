function toLines(text: string): string[] {
  return text.length === 0 ? [] : text.split('\n');
}

export function countChangedLines(before: string, after: string): number {
  const beforeLines = toLines(before);
  const afterLines = toLines(after);
  const unchanged = lcsLength(beforeLines, afterLines);
  return beforeLines.length + afterLines.length - 2 * unchanged;
}

function lcsLength(a: string[], b: string[]): number {
  const rows = a.length;
  const cols = b.length;
  let prev = new Array<number>(cols + 1).fill(0);
  let curr = new Array<number>(cols + 1).fill(0);

  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1] + 1
          : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev.fill(0)];
  }

  return prev[cols];
}
