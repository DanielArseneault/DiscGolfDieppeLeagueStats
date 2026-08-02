export const BOB_TAG = "BoB";

// Numbered tags rank by their value (lower is better); BoB — the shared
// "bottom of bag" bucket for anyone without a numbered tag — always ranks
// worse than every numbered tag.
export function tagRank(tag: string | null): number {
  if (tag == null || tag === BOB_TAG) return Infinity;
  const n = parseInt(tag, 10);
  return isNaN(n) ? Infinity : n;
}

export function normalizeTagInput(v: string): string | null {
  const trimmed = v.trim();
  if (trimmed === "") return null;
  if (trimmed.toLowerCase() === BOB_TAG.toLowerCase()) return BOB_TAG;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? null : String(n);
}
