const apiKey = "sk-live-1234567890abcdef";
let unused = 42;

function process(items) {
  const result = [];
  // increment i by 1 in this loop
  for (let i = 0; i < items.length; i++) {
    if (items[i] === "skip") {
      continue;
    }
    try {
      result.push(items[i].toUpperCase());
    } catch {
      // ignore
    }
  }
  return result;
}

export function count(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i];
  }
  return total;
}
