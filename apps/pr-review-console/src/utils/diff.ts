// Minimal, dependency-free diff for revision comparison.
// Character-level LCS with a size guard; falls back to prefix/suffix trim
// for very long inputs to keep the UI responsive.

export interface DiffSegment {
  kind: "same" | "add" | "del";
  text: string;
}

const MAX_LCS_CELLS = 250_000;

function prefixSuffixDiff(a: string, b: string): DiffSegment[] {
  let start = 0;
  const minLen = Math.min(a.length, b.length);
  while (start < minLen && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const segments: DiffSegment[] = [];
  if (start > 0) segments.push({ kind: "same", text: a.slice(0, start) });
  if (endA > start) segments.push({ kind: "del", text: a.slice(start, endA) });
  if (endB > start) segments.push({ kind: "add", text: b.slice(start, endB) });
  if (endA < a.length) segments.push({ kind: "same", text: a.slice(endA) });
  return segments;
}

export function diffText(oldText: string, newText: string): DiffSegment[] {
  if (oldText === newText) return [{ kind: "same", text: oldText }];
  if (oldText.length * newText.length > MAX_LCS_CELLS) {
    return prefixSuffixDiff(oldText, newText);
  }

  const a = oldText;
  const b = newText;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  const push = (kind: DiffSegment["kind"], text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += text;
    else segments.push({ kind, text });
  };

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      push("del", a[i]);
      i += 1;
    } else {
      push("add", b[j]);
      j += 1;
    }
  }
  while (i < a.length) {
    push("del", a[i]);
    i += 1;
  }
  while (j < b.length) {
    push("add", b[j]);
    j += 1;
  }
  return segments;
}
