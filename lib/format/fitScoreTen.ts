/**
 * Displays internal 0–100 fit scores as a 1–10 scale (e.g. 98 → "9.8/10").
 * Internal scoring and GO/MAYBE/SKIP thresholds stay on the 0–100 scale.
 */
export function formatFitScoreTen(fitScore: number): string {
  if (!Number.isFinite(fitScore)) return "";
  const clamped = Math.min(100, Math.max(0, fitScore));
  const ten = Math.round(clamped) / 10;
  return `${ten.toFixed(1)}/10`;
}
