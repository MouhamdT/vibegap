import { normalizeRoutingTypos } from "@/lib/ai/queryMode";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";

export type ParsedVisitPlanQuery = {
  /** Exactly two stop goal spans in visit order, e.g. ["coffee", "brunch"]. */
  stopGoals: [string, string];
  /** Raw anchor text after in/near, e.g. "Old Town, Prague". */
  locationText: string;
  /** Display-cased anchor for headers. */
  locationDisplay: string;
  /** Whether the anchor read as "near X" (landmark-ish) or "in X" (area). */
  anchorPreposition: "in" | "near";
};

/**
 * Words that make a plan stop read like a visit goal (food / drink / focus stops in v1).
 * Both sides of "X then Y" must match, so venue names like "nobu then" don't trigger plan mode.
 */
const PLAN_STOP_GOAL_RE =
  /\b(coffee|espresso|cafe|café|brunch|breakfast|lunch|dinner|supper|drinks?|cocktails?|wine|beer|tea|dessert|ice\s*cream|gelato|pastry|bakery|pizza|burgers?|sushi|tacos|ramen|snacks?|food|study(?:ing)?|work)\b/i;

function isPlanStopGoal(span: string): boolean {
  const t = span.trim();
  if (!t || t.length > 48) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  return PLAN_STOP_GOAL_RE.test(t);
}

/**
 * Detects two-stop visit plans: "coffee then brunch near Old Town",
 * "study then dinner in tel aviv", "coffee, then dessert around Trastevere".
 * Returns null for anything that doesn't clearly read as a plan.
 */
export function parseVisitPlanQuery(rawQuery: string): ParsedVisitPlanQuery | null {
  const normalized = normalizeRoutingTypos(rawQuery.trim()).replace(/\s+/g, " ");
  if (!normalized || normalized.length > 160) return null;

  const m = normalized.match(
    /^(.+?)\s*,?\s+(?:and\s+)?then\s+(.+?)\s+(in|near|around|by)\s+(.{2,60})$/i,
  );
  if (!m) return null;

  const firstGoal = m[1]!.trim();
  const secondGoal = m[2]!.trim();
  const preposition = m[3]!.trim().toLowerCase();
  const locationText = m[4]!.trim().replace(/[.?!]+$/, "").trim();

  if (!isPlanStopGoal(firstGoal) || !isPlanStopGoal(secondGoal)) return null;
  if (locationText.length < 2) return null;
  // Location should not itself read like another goal span ("dinner then drinks near cheap").
  if (PLAN_STOP_GOAL_RE.test(locationText) && locationText.split(/\s+/).length <= 2) return null;

  return {
    stopGoals: [firstGoal, secondGoal],
    locationText,
    locationDisplay: formatSearchQueryForDisplay(locationText),
    anchorPreposition: preposition === "near" ? "near" : "in",
  };
}
