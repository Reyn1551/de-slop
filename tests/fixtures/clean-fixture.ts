/** @returns sum of all items */
export function count(items: number[]): number {
  return items.reduce((total, n) => total + n, 0);
}

/** @param name who to greet */
export function greet(name: string): string {
  return `hello, ${name}`;
}
