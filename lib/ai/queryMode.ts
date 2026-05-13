import type { DetectedIntent, QueryMode } from "@/lib/types/vibecheck";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";

export type QueryClassification = {
  queryMode: QueryMode;
  /** Parsed venue-ish substring when mode is `place_with_intent`; formatted display for `specific_place`. */
  placeNameCandidate: string | null;
  /** Goal substring for `place_with_intent` (after “for …”, or trailing goal words). Used for intent scoring. */
  intentGoalText: string | null;
  /** Short user-facing note on how the search was read. */
  queryExplanation: string;
  /** One-line banner for the report header. */
  queryContextBanner: string;
  /** Parsed location hint for recommendation mode goal searches, e.g. "Copenhagen". */
  locationCandidate: string | null;
  /** True when goal_search has a location and should return ranked candidate places. */
  recommendationMode: boolean;
};

const GOAL_SIGNAL_TOKENS = new Set([
  "study",
  "studying",
  "quiet",
  "calm",
  "laptop",
  "work",
  "cheap",
  "budget",
  "birthday",
  "dinner",
  "romantic",
  "date",
  "party",
  "nightlife",
  "vegan",
  "vegetarian",
  "wait",
  "waiting",
  "line",
  "crowded",
]);

const LOCATION_STOPWORDS = new Set([
  "to",
  "for",
  "having",
  "a",
  "an",
  "the",
  "and",
  "with",
  "without",
  "no",
  "not",
  "low",
  "near",
  "around",
  "in",
  "place",
  "restaurant",
  "cafe",
  "bar",
]);

function normalizeToken(t: string): string {
  return t.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
}

function extractTrailingLocationCandidate(raw: string): string | null {
  const words = raw.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  if (words.length < 2) return null;
  const lowered = words.map((w) => normalizeToken(w));

  // Require a goal signal somewhere before the guessed suffix.
  const hasGoalSignal = lowered.some((w) => GOAL_SIGNAL_TOKENS.has(w));
  if (!hasGoalSignal) return null;

  for (let size = Math.min(3, words.length - 1); size >= 1; size--) {
    const suffixWords = words.slice(words.length - size);
    const suffixNorm = suffixWords.map((w) => normalizeToken(w));
    if (suffixNorm.some((w) => !w || LOCATION_STOPWORDS.has(w) || GOAL_SIGNAL_TOKENS.has(w))) continue;
    if (suffixNorm.some((w) => w.length < 2)) continue;

    const candidate = suffixWords.join(" ").replace(/\s+/g, " ").trim();
    if (candidate.length < 2) continue;
    return formatSearchQueryForDisplay(candidate);
  }
  return null;
}

function extractLocationCandidate(raw: string): string | null {
  const m = raw.match(/\b(?:in|near|around)\s+([A-Za-z][A-Za-z\s'-]{1,48})$/i);
  if (m?.[1]) {
    const loc = m[1].trim().replace(/\s+/g, " ");
    if (loc.length >= 2) return formatSearchQueryForDisplay(loc);
  }
  return extractTrailingLocationCandidate(raw);
}

const GENERIC_GOAL_PLACE_PREFIX =
  /^(a\s+|the\s+|some\s+|any\s+)?(quiet\s+|good\s+|nice\s+)?place(s)?(\s+to)?$/i;

function looksLikeVenueCandidate(before: string): boolean {
  const t = before.trim();
  if (t.length < 3) return false;
  if (GENERIC_GOAL_PLACE_PREFIX.test(t)) return false;
  if (/^place(s)?\s+to\b/i.test(t)) return false;
  if (/^(somewhere|anywhere|here)\b/i.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return true;
  if (words.length === 2 && t.length >= 8) return true;
  if (words.length === 1 && /^[A-Z]/.test(words[0]!) && words[0].length >= 5) return true;
  return false;
}

/** True when the text after "for …" reads like a visit goal, not boilerplate like "rent". */
function hasGoalTailSignals(after: string): boolean {
  const t = after.toLowerCase();
  return /\b(stud(y|ying|ies)|laptop|wifi|work|homework|party|nightlife|celebrate|celebration|birthday|anniversary|cheap|budget|affordable|value|date|romantic|proposal|family|kids|children|quiet|calm|focus|reading|toast|occasion|gathering|dinner|brunch|lunch|vegan|vegetarian|wait(ing)?|queue|line|crowded|no waiting time|no waiting line|low wait|no line|not crowded)\b/.test(
    t,
  );
}

const LEADING_GOAL_ADJECTIVES = new Set([
  "quiet",
  "good",
  "nice",
  "great",
  "best",
  "cheap",
  "calm",
  "peaceful",
]);

const ARTICLE_CAP = new Set(["The", "A", "An"]);

function isUndifferentiatedGoalPhrase(left: string): boolean {
  const t = left.trim().toLowerCase();
  if (/^(a\s+|the\s+)?(quiet|good|nice|great)\s+place(s)?(\s+to)?$/i.test(t)) return true;
  if (/^(quiet|nice)\s+spot/i.test(t)) return true;
  if (/^(some|any)\s+place/i.test(t)) return true;
  if (/^place(s)?\s+to\b/i.test(t)) return true;
  return false;
}

/** True when the left span looks like a title-cased name, not an all-lowercase goal phrase. */
function hasContentProperNoun(left: string): boolean {
  return left.split(/\s+/).some((w) => {
    if (w.length < 3) return false;
    if (!/^[A-Z][a-z]/.test(w)) return false;
    return !ARTICLE_CAP.has(w);
  });
}

function twoWordLikelyVenuePrefix(left: string): boolean {
  const ws = left.trim().split(/\s+/);
  if (ws.length !== 2) return false;
  const a = ws[0]!.toLowerCase();
  if (LEADING_GOAL_ADJECTIVES.has(a)) return false;
  return ws[0]!.length >= 3 && ws[1]!.length >= 3;
}

function leftQualifiesAsVenuePrefixForShorthand(left: string): boolean {
  if (!looksLikeVenueCandidate(left)) return false;
  if (isUndifferentiatedGoalPhrase(left)) return false;
  const n = left.trim().split(/\s+/).length;
  if (hasContentProperNoun(left)) return true;
  if (n >= 4) return true;
  if (n === 3) return true;
  if (n === 2) return twoWordLikelyVenuePrefix(left);
  return false;
}

/** Goal-like tokens that rarely end a venue name; splits ending here are skipped so goals stay on the right. */
const GOAL_TAIL_TOKEN_BLOCKLIST = new Set([
  "cheap",
  "budget",
  "affordable",
  "quiet",
  "calm",
  "studying",
  "study",
  "party",
  "birthday",
  "anniversary",
  "celebration",
  "dinner",
  "lunch",
  "brunch",
  "date",
  "romantic",
  "family",
  "kids",
  "laptop",
  "wifi",
  "work",
  "homework",
  "focus",
  "reading",
  "toast",
  "gathering",
  "occasion",
  "nightlife",
  "vegan",
  "vegetarian",
  "waiting",
  "wait",
  "queue",
  "line",
  "crowded",
  "to",
  "for",
  "having",
  "no",
  "not",
  "low",
  "a",
  "an",
  "the",
]);

function venuePrefixEndsWithGoalToken(left: string): boolean {
  const ws = left.trim().split(/\s+/);
  const last = ws[ws.length - 1]?.toLowerCase();
  return last != null && GOAL_TAIL_TOKEN_BLOCKLIST.has(last);
}

/**
 * Trailing goal: "Nobu London quiet", "The Laundromat Cafe Copenhagen studying".
 * Chooses the longest venue-like prefix whose last token is not a goal word, so goals like
 * "cheap birthday dinner" stay on the right.
 */
function tryTrailingPlaceWithIntent(raw: string): QueryClassification | null {
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 3) return null;

  for (let splitIdx = words.length - 2; splitIdx >= 1; splitIdx--) {
    const left = words.slice(0, splitIdx + 1).join(" ");
    const right = words.slice(splitIdx + 1).join(" ");
    if (venuePrefixEndsWithGoalToken(left)) continue;
    if (
      leftQualifiesAsVenuePrefixForShorthand(left) &&
      right.trim().length >= 2 &&
      hasGoalTailSignals(right)
    ) {
      return {
        queryMode: "place_with_intent",
        placeNameCandidate: left,
        intentGoalText: right.trim(),
        queryExplanation:
          "We read a named venue plus a trailing visit goal (not only “for …”). Intent Fit scores that goal; VibeGap still compares mock social signals to review data for the matched place.",
        queryContextBanner: "Checking this place against your goal.",
        locationCandidate: null,
        recommendationMode: false,
      };
    }
  }
  return null;
}

/**
 * Classifies the raw search: goal-only, named venue, or venue plus a goal clause after "for …".
 * The `for …` branch is structural first so a named venue plus a goal is not misread as a pure goal search.
 */
export function classifyQueryMode(searchQuery: string, intent: DetectedIntent): QueryClassification {
  const raw = searchQuery.trim();
  const forMatch = raw.match(/^\s*(.+?)\s+for\s+(.+)$/i);

  if (forMatch) {
    const before = forMatch[1].trim();
    const after = forMatch[2].trim();
    if (looksLikeVenueCandidate(before) && after.length >= 3 && hasGoalTailSignals(after)) {
      return {
        queryMode: "place_with_intent",
        placeNameCandidate: before,
        intentGoalText: after,
        queryExplanation:
          "You named a venue and a visit goal after “for …”. Intent Fit scores the goal; VibeGap compares mock social signals to review data for that named pick.",
        queryContextBanner: "Checking this place against your goal.",
        locationCandidate: null,
        recommendationMode: false,
      };
    }
  }

  const trailing = tryTrailingPlaceWithIntent(raw);
  if (trailing) return trailing;

  if (intent.kind !== "venue_lookup") {
    const locationCandidate = extractLocationCandidate(raw);
    return {
      queryMode: "goal_search",
      placeNameCandidate: null,
      intentGoalText: null,
      queryExplanation:
        "We read this as a goal-style search. Intent Fit is the lead signal; VibeGap adds how social and reviews line up on an illustrative mock venue.",
      queryContextBanner: "Checking fit for your goal.",
      locationCandidate,
      recommendationMode: Boolean(locationCandidate),
    };
  }

  return {
    queryMode: "specific_place",
    placeNameCandidate: raw.length > 0 ? formatSearchQueryForDisplay(raw) : null,
    intentGoalText: null,
    queryExplanation:
      "We read this as a named venue. VibeGap is the headline read (social vs reviews); Intent Fit stays neutral unless goal words show up in the text.",
    queryContextBanner: "Checking this specific place.",
    locationCandidate: null,
    recommendationMode: false,
  };
}
