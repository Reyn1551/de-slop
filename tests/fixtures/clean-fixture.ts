export function count(items: number[]): number {
  return items.reduce((total, n) => total + n, 0);
}

export function greet(name: string): string {
  return `hello, ${name}`;
}
