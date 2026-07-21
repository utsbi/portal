/**
 * Tiny fuzzy score: returns n.length/h.length if all chars of needle appear
 * in order in haystack, -1 otherwise. Used for Cmd+K quick-switcher.
 */
export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 0;
  let i = 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  for (const c of h) if (c === n[i]) i++;
  return i === n.length ? n.length / h.length : -1;
}
