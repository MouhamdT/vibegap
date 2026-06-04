import {
  extractTrailingCompareLocationSuffix,
  stripExplicitInCitySuffixFromPlaceQuery,
} from "@/lib/ai/comparePlaceContext";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";

export type ParsedCompareQuery = {
  placeA: string;
  placeB: string;
  goalText: string;
  /** Shared metro when the query ends with `… in <city>` or one venue segment uses `… in <city>`. */
  compareContextCity: string | null;
};

const COMPARE_CUE_RE = /\b(compare|which\s+is\s+better)\b/i;

function looksLikeNamedPlace(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (/^(brunch|lunch|dinner|breakfast|coffee|vegan|quiet|cheap|fancy)\b/i.test(t)) return false;
  if (/^(a|an|the)\s+(quiet|good|nice)\s+place/i.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && t.length >= 6) return true;
  if (words.length === 1 && /^[A-Z]/.test(words[0]!) && words[0]!.length >= 5) return true;
  return false;
}

/** After stripping `… in <city>`, a venue can be a short proper name like "Coco". */
function looksLikeShortVenueToken(text: string): boolean {
  const w = text.trim().split(/\s+/).filter(Boolean);
  if (w.length !== 1 || w[0]!.length < 3) return false;
  const token = w[0]!;
  if (/^(brunch|lunch|dinner|breakfast|coffee|vegan|quiet|cheap|fancy|food|place|spot|bar|cafe|restaurant)$/i.test(token)) {
    return false;
  }
  return /^[\w'-]+$/i.test(token);
}

function splitOnDelimiter(q: string, delimiter: RegExp): { left: string; right: string } | null {
  const parts = q.split(delimiter).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  if (!parts[0] || !parts[1]) return null;
  return { left: parts[0], right: parts[1] };
}

function extractGoalFromRightSide(right: string): { place: string; goal: string } {
  const forMatch = right.match(/^(.+?)\s+for\s+(.+)$/i);
  if (forMatch?.[1] && forMatch[2]) {
    const place = forMatch[1].trim();
    const goal = forMatch[2].trim();
    if (place.length >= 2 && goal.length >= 2) {
      return { place, goal };
    }
  }
  return { place: right.trim(), goal: "" };
}

function extractGoalFromPair(left: string, right: string): { placeA: string; placeB: string; goal: string } {
  const rightParsed = extractGoalFromRightSide(right);
  const placeB = rightParsed.place;
  let goal = rightParsed.goal;
  let placeA: string;

  if (!goal) {
    const leftParsed = extractGoalFromRightSide(left);
    if (leftParsed.goal) {
      placeA = leftParsed.place;
      goal = leftParsed.goal;
    } else {
      placeA = left.trim();
    }
  } else {
    placeA = left.trim();
  }

  return { placeA, placeB, goal };
}

function extractTrailingGoalFromFullCompareQuery(full: string): string {
  const m = full.trim().match(/\bfor\s+(.+)$/i);
  if (!m?.[1]?.trim()) return "";
  return m[1].trim();
}

/**
 * Detects head-to-head compare queries and extracts two venue names plus an optional goal clause.
 * Returns null when the string does not confidently read as a two-place comparison.
 */
export function parseCompareQuery(raw: string): ParsedCompareQuery | null {
  let q = raw.trim();
  if (q.length < 8) return null;

  let compareContextCity: string | null = null;
  const metroFromWholeQuery = extractTrailingCompareLocationSuffix(q);
  if (metroFromWholeQuery.cityDisplay) {
    q = metroFromWholeQuery.rest;
    compareContextCity = metroFromWholeQuery.cityDisplay;
  }

  const hasCompareCue = COMPARE_CUE_RE.test(q);

  q = q.replace(/^which\s+is\s+better\s*[:,]\s*/i, "").trim();

  let pair: { left: string; right: string } | null = null;

  const compareAnd = q.match(/^compare\s+(.+)$/i);
  if (compareAnd?.[1]) {
    const body = compareAnd[1].trim();
    pair =
      splitOnDelimiter(body, /\s+and\s+/i) ??
      splitOnDelimiter(body, /\s+vs\.?\s+/i) ??
      splitOnDelimiter(body, /\s+versus\s+/i) ??
      splitOnDelimiter(body, /\s+or\s+/i);
  }

  if (!pair) {
    pair =
      splitOnDelimiter(q, /\s+vs\.?\s+/i) ??
      splitOnDelimiter(q, /\s+versus\s+/i);
  }

  if (!pair && (hasCompareCue || /\s+for\s+/i.test(q))) {
    pair = splitOnDelimiter(q, /\s+or\s+/i);
  }

  if (!pair) return null;

  let { placeA, placeB, goal } = extractGoalFromPair(pair.left, pair.right);
  if (!goal.trim()) {
    const tailGoal = extractTrailingGoalFromFullCompareQuery(raw.trim());
    if (tailGoal) goal = tailGoal;
  }

  const segA = stripExplicitInCitySuffixFromPlaceQuery(placeA.trim());
  const segB = stripExplicitInCitySuffixFromPlaceQuery(placeB.trim());
  let placeAClean = segA.venue;
  let placeBClean = segB.venue;
  if (!compareContextCity) {
    if (segA.cityDisplay && !segB.cityDisplay) compareContextCity = segA.cityDisplay;
    else if (segB.cityDisplay && !segA.cityDisplay) compareContextCity = segB.cityDisplay;
  }

  const okA = looksLikeNamedPlace(placeAClean) || looksLikeShortVenueToken(placeAClean);
  const okB = looksLikeNamedPlace(placeBClean) || looksLikeShortVenueToken(placeBClean);
  if (!okA || !okB) return null;
  if (placeAClean.toLowerCase() === placeBClean.toLowerCase()) return null;

  const goalText = goal.trim() || "your visit";
  return {
    placeA: formatSearchQueryForDisplay(placeAClean),
    placeB: formatSearchQueryForDisplay(placeBClean),
    goalText: formatSearchQueryForDisplay(goalText),
    compareContextCity,
  };
}

export function isCompareQuery(raw: string): boolean {
  return parseCompareQuery(raw) !== null;
}
