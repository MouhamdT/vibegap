/**
 * Normalizes common typos and formats the raw search for on-screen display only.
 * Detection logic should keep using the original query string.
 */
const TYPO_REPLACEMENTS: readonly { pattern: RegExp; normalized: string }[] = [
  { pattern: /\bresturant\b/gi, normalized: "restaurant" },
];

export function formatSearchQueryForDisplay(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ");
  for (const { pattern, normalized } of TYPO_REPLACEMENTS) {
    s = s.replace(pattern, normalized);
  }
  return s
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toLocaleUpperCase("en-US") + w.slice(1).toLocaleLowerCase("en-US"))
    .join(" ");
}
