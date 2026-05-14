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
  /**
   * When recommendations are driven by near/around/by/close to, UI uses “near [name]” and names the anchor.
   * Null when the user used “in [city]” or implicit city routing.
   */
  recommendationNearAnchorName: string | null;
  /**
   * When deterministic routing forces recommendations, intent is inferred from the goal span so labels
   * (e.g. Brunch) stay correct even if the full query would otherwise read as venue lookup.
   */
  recommendationRankIntent: DetectedIntent | null;
};

const RECOMMENDATION_CATEGORY_RE =
  /\b(brunch|breakfast|lunch|dinner|supper|coffee|espresso|cafe|café|restaurant|foods?|pizza|burger|sushi|tacos|dessert|drinks|cheap|budget|affordable|value|birthday|date|romantic|fancy|upscale|special\s+occasion|group|party|quiet|study|studying|work|laptop|focused|reading|no\s+wait|no\s+waiting|no\s+line|low\s+wait|quick|fast|vegan|vegetarian|halal|gluten\s*-?\s*free|place\s+to|michelin(\s+stars?)?|fine\s+dining|tasting\s+menu)\b/i;

/** Fixes common typos before routing heuristics run. */
export function normalizeRoutingTypos(text: string): string {
  return text
    .replace(/\bmichlen\b/gi, "michelin")
    .replace(/\bmichelen\b/gi, "michelin")
    .replace(/\bresturant\b/gi, "restaurant");
}

/**
 * Splits a trailing "but …" off a captured location/anchor span so goals like
 * "fancy restaurant in rome but cheap" do not treat "Rome But Cheap" as the place name.
 */
function stripButClauseFromLocation(locationRaw: string): { locationCore: string; trailingModifier: string } {
  const trimmed = locationRaw.trim();
  const m = trimmed.match(/^(.+?)\s+but\s+(.+)$/i);
  if (m?.[1] && m[2]) {
    const trailing = m[2].trim();
    if (trailing.length >= 2) {
      return { locationCore: m[1].trim(), trailingModifier: trailing };
    }
  }
  return { locationCore: trimmed, trailingModifier: "" };
}

function hasRecommendationCategorySignals(text: string): boolean {
  return RECOMMENDATION_CATEGORY_RE.test(text.trim());
}

type PrepSplit = {
  goalLeft: string;
  locationRaw: string;
  displayAsNear: boolean;
};

/** Splits “[goal] (in|near|around|by|close to) [location]” using the final locative phrase so “study in …” does not steal the split. */
function splitPrepGoalAndLocation(raw: string): PrepSplit | null {
  const t = raw.trim();
  if (!t) return null;

  const closeIdx = t.toLowerCase().lastIndexOf(" close to ");
  if (closeIdx !== -1) {
    const goalLeft = t.slice(0, closeIdx).trim();
    const locationRaw = t.slice(closeIdx + " close to ".length).trim();
    if (goalLeft.length >= 2 && locationRaw.length >= 2) {
      return { goalLeft, locationRaw, displayAsNear: true };
    }
  }

  const re = /\s+(in|near|around|by)\s+/gi;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    last = m;
  }
  if (!last?.[1]) return null;

  const head = t.slice(0, last.index).trim();
  const locationRaw = t.slice(last.index + last[0].length).trim();
  if (head.length < 2 || locationRaw.length < 2) return null;

  const prep = last[1].toLowerCase();
  return { goalLeft: head, locationRaw, displayAsNear: prep !== "in" };
}

const IMPLICIT_TWO_WORD_CITIES = new Set([
  "tel aviv",
  "new york",
  "los angeles",
  "san francisco",
  "hong kong",
  "las vegas",
  "san diego",
  "buenos aires",
  "kuala lumpur",
  "mexico city",
  "new orleans",
  "salt lake city",
  "rio de janeiro",
]);

const IMPLICIT_ONE_WORD_CITIES = new Set([
  "london",
  "paris",
  "rome",
  "milan",
  "berlin",
  "dublin",
  "edinburgh",
  "madrid",
  "barcelona",
  "vienna",
  "prague",
  "warsaw",
  "amsterdam",
  "brussels",
  "copenhagen",
  "stockholm",
  "oslo",
  "helsinki",
  "dubai",
  "singapore",
  "tokyo",
  "osaka",
  "seoul",
  "sydney",
  "melbourne",
  "brisbane",
  "perth",
  "chicago",
  "boston",
  "denver",
  "houston",
  "dallas",
  "miami",
  "atlanta",
  "philadelphia",
  "seattle",
  "portland",
  "austin",
  "phoenix",
  "toronto",
  "vancouver",
  "montreal",
  "munich",
  "frankfurt",
  "hamburg",
  "cologne",
  "naples",
  "florence",
  "venice",
  "bucharest",
  "budapest",
  "istanbul",
  "athens",
  "lisbon",
  "geneva",
  "zurich",
  "nice",
  "lyon",
  "marseille",
  "bruges",
  "antwerp",
  "glasgow",
  "manchester",
  "liverpool",
  "bristol",
  "cardiff",
  "birmingham",
  "rotterdam",
]);

export function inferRecommendationIntentFromGoalSpan(goalLeft: string): DetectedIntent {
  const query = normalizeRoutingTypos(goalLeft).trim().toLowerCase();
  if (!query) {
    return {
      kind: "venue_lookup",
      label: "Venue lookup (no specific goal detected)",
      confidence: "low",
      matchedSignals: [],
    };
  }

  const hasUpscaleCue =
    /\bmichelin(\s+stars?)?\b|\bfine\s+dining\b|\btasting\s+menu\b|\b(fancy|upscale|splurge|special\s+occasion|luxury)\b/.test(
      query,
    );
  const hasBudgetCue = /\b(cheap|budget|affordable|inexpensive|value)\b/.test(query);

  if (
    /\b(no waiting (line|time)|no wait|low wait|short wait|no line|no queue|without waiting|not crowded|quick|fast)\b/.test(
      query,
    )
  ) {
    return {
      kind: "low_wait",
      label: "Low-wait visit",
      confidence: "medium",
      matchedSignals: ["low wait"],
    };
  }

  if (
    /\b(study|studying|laptop|homework|reading|to study)\b/.test(query) ||
    (/\b(quiet|calm|peaceful|focused)\b/.test(query) && /\b(work|laptop|read)\b/.test(query)) ||
    /\bplace\s+to\s+study\b/.test(query)
  ) {
    return {
      kind: "study_work",
      label: "Quiet work or study session",
      confidence: "high",
      matchedSignals: ["study"],
    };
  }

  if (/\b(quiet|calm|peaceful|chill|serene)\b/.test(query)) {
    return {
      kind: "quiet_calm",
      label: "A calm, low-noise visit",
      confidence: "medium",
      matchedSignals: ["quiet"],
    };
  }

  if (/\b(party|nightlife|dancing|dj|club)\b/.test(query)) {
    return {
      kind: "party_nightlife",
      label: "High-energy night out",
      confidence: "medium",
      matchedSignals: ["party"],
    };
  }

  if (hasUpscaleCue && hasBudgetCue) {
    return {
      kind: "budget_eats",
      label: "Upscale but budget-aware restaurants",
      confidence: "high",
      matchedSignals: ["upscale", "budget-aware"],
    };
  }

  if (/\bmichelin(\s+stars?)?\b|\bfine\s+dining\b|\btasting\s+menu\b/.test(query)) {
    return {
      kind: "luxury",
      label: "Michelin-style or fine-dining visit",
      confidence: "high",
      matchedSignals: ["michelin", "fine dining"],
    };
  }

  if (/\b(fancy|upscale|splurge|special\s+occasion|tasting|luxury)\b/.test(query)) {
    return {
      kind: "luxury",
      label: "Upscale or special-occasion visit",
      confidence: "medium",
      matchedSignals: ["luxury"],
    };
  }

  const hasOccasion = /\b(birthday|anniversary|celebration|occasion|gathering|celebrate)\b/.test(query);
  const hasFood = /\b(restaurant|dinner|brunch|lunch|eatery|bistro|cafe|food)\b/.test(query);
  if (hasBudgetCue && (hasOccasion || (hasFood && hasOccasion))) {
    return {
      kind: "budget_celebration",
      label: "Budget-friendly celebration meal",
      confidence: "high",
      matchedSignals: ["budget", "celebration"],
    };
  }

  if (/\b(date|romantic|proposal|anniversary|couples)\b/.test(query)) {
    return {
      kind: "date_night",
      label: "Date night or romantic table",
      confidence: "medium",
      matchedSignals: ["date"],
    };
  }

  if (/\b(family|kids|children|toddler|stroller|baby)\b/.test(query)) {
    return {
      kind: "family",
      label: "Family-friendly outing",
      confidence: "medium",
      matchedSignals: ["family"],
    };
  }

  if (/\b(vegan|vegetarian|halal|gluten\s*-?\s*free)\b/.test(query)) {
    return {
      kind: "budget_eats",
      label: "Diet-forward meal",
      confidence: "medium",
      matchedSignals: ["diet"],
    };
  }

  if (/\bbrunch\b/.test(query)) {
    return { kind: "budget_eats", label: "Brunch", confidence: "medium", matchedSignals: ["brunch"] };
  }

  if (/\b(breakfast|lunch|dinner|supper)\b/.test(query)) {
    return { kind: "budget_eats", label: "Dining", confidence: "medium", matchedSignals: ["meal"] };
  }

  if (/\b(coffee|espresso|cafe|café)\b/.test(query)) {
    return { kind: "budget_eats", label: "Coffee", confidence: "medium", matchedSignals: ["coffee"] };
  }

  if (/\b(restaurant|food|eats|dining|drinks|dessert)\b/.test(query)) {
    return { kind: "budget_eats", label: "Food or drinks", confidence: "medium", matchedSignals: ["food"] };
  }

  if (/\b(pizza|burger|sushi|tacos|noodles|ramen|pho|bbq)\b/.test(query)) {
    return { kind: "budget_eats", label: "Food or drinks", confidence: "medium", matchedSignals: ["meal"] };
  }

  return {
    kind: "venue_lookup",
    label: "Venue lookup (no specific goal detected)",
    confidence: "low",
    matchedSignals: [],
  };
}

function tryImplicitTrailingCityRecommendation(normalizedQuery: string): QueryClassification | null {
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const lower = words.map((w) => w.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, ""));
  let take = 0;
  let locationRaw = "";

  if (lower.length >= 2) {
    const bi = `${lower[lower.length - 2]} ${lower[lower.length - 1]}`;
    if (IMPLICIT_TWO_WORD_CITIES.has(bi)) {
      take = 2;
      locationRaw = words.slice(-2).join(" ");
    }
  }

  if (take === 0) {
    const last = lower[lower.length - 1];
    if (last && IMPLICIT_ONE_WORD_CITIES.has(last)) {
      take = 1;
      locationRaw = words[words.length - 1]!;
    }
  }

  if (take === 0 || !locationRaw) return null;

  const goalLeft = words.slice(0, -take).join(" ");
  if (goalLeft.length < 2) return null;
  if (!hasRecommendationCategorySignals(goalLeft)) return null;

  const { locationCore, trailingModifier } = stripButClauseFromLocation(locationRaw);
  if (locationCore.length < 2) return null;

  const goalForInfer = trailingModifier ? `${goalLeft} but ${trailingModifier}` : goalLeft;
  const locationCandidate = formatSearchQueryForDisplay(locationCore);
  const rankIntent = inferRecommendationIntentFromGoalSpan(goalForInfer);

  return {
    queryMode: "goal_search",
    placeNameCandidate: null,
    intentGoalText: null,
    queryExplanation:
      "Structured as a goal plus a city or area: we shortlist venues with weighted scoring instead of locking to one Google match.",
    queryContextBanner: "Finding places that match your plan.",
    locationCandidate,
    recommendationMode: true,
    recommendationNearAnchorName: null,
    recommendationRankIntent: rankIntent,
  };
}

function tryPrepStructuredRecommendation(normalizedQuery: string): QueryClassification | null {
  const split = splitPrepGoalAndLocation(normalizedQuery);
  if (!split) return null;
  if (!hasRecommendationCategorySignals(split.goalLeft)) return null;

  const { locationCore, trailingModifier } = stripButClauseFromLocation(split.locationRaw);
  if (locationCore.length < 2) return null;

  const goalForInfer = trailingModifier ? `${split.goalLeft} but ${trailingModifier}` : split.goalLeft;
  const locationCandidate = formatSearchQueryForDisplay(locationCore);
  const rankIntent = inferRecommendationIntentFromGoalSpan(goalForInfer);
  const nearName = split.displayAsNear ? locationCandidate : null;

  return {
    queryMode: "goal_search",
    placeNameCandidate: null,
    intentGoalText: null,
    queryExplanation:
      "Structured as a goal plus geography (in / near / around / by / close to): we shortlist venues with goal-specific ranking.",
    queryContextBanner: "Finding places that match your plan.",
    locationCandidate,
    recommendationMode: true,
    recommendationNearAnchorName: nearName,
    recommendationRankIntent: rankIntent,
  };
}

/**
 * Deterministic routing that runs before treating a query as a single named venue.
 * Covers “brunch in London”, “coffee near Eiffel Tower”, “cheap birthday dinner London”, etc.
 */
function tryDeterministicRecommendationBeforeVenue(raw: string): QueryClassification | null {
  const normalized = normalizeRoutingTypos(raw.trim());
  const prep = tryPrepStructuredRecommendation(normalized);
  if (prep) return prep;
  return tryImplicitTrailingCityRecommendation(normalized);
}

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
  const n = normalizeRoutingTypos(raw);
  const close = n.match(/\bclose\s+to\s+([A-Za-z][A-Za-z\s'-]{1,48})$/i);
  if (close?.[1]) {
    const loc = stripButClauseFromLocation(close[1].trim().replace(/\s+/g, " ")).locationCore;
    if (loc.length >= 2) return formatSearchQueryForDisplay(loc);
  }
  const m = n.match(/\b(?:in|near|around|by)\s+([A-Za-z][A-Za-z\s'-]{1,48})$/i);
  if (m?.[1]) {
    const loc = stripButClauseFromLocation(m[1].trim().replace(/\s+/g, " ")).locationCore;
    if (loc.length >= 2) return formatSearchQueryForDisplay(loc);
  }
  return extractTrailingLocationCandidate(n);
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
export function hasGoalTailSignals(after: string): boolean {
  const t = normalizeRoutingTypos(after).toLowerCase();
  return /\b(stud(y|ying|ies)|laptop|wifi|work|homework|party|nightlife|celebrate|celebration|birthday|anniversary|cheap|budget|affordable|value|date|romantic|proposal|family|kids|children|quiet|calm|focus|reading|toast|occasion|gathering|dinner|brunch|lunch|coffee|espresso|caffeine|vegan|vegetarian|wait(ing)?|queue|line|crowded|no waiting time|no waiting line|low wait|no line|not crowded|fancy|splurge|michelin|fine dining|tasting menu)\b/.test(
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
          "We read a named venue plus a trailing visit goal (not only “for …”). Intent Fit scores that goal; VibeGap still contrasts illustrative social framing with review data for the matched place.",
        queryContextBanner: "Checking this place against your goal.",
        locationCandidate: null,
        recommendationMode: false,
        recommendationNearAnchorName: null,
        recommendationRankIntent: null,
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
          "You named a venue and a visit goal after “for …”. Intent Fit scores the goal; VibeGap contrasts illustrative social framing with review data for that named pick.",
        queryContextBanner: "Checking this place against your goal.",
        locationCandidate: null,
        recommendationMode: false,
        recommendationNearAnchorName: null,
        recommendationRankIntent: null,
      };
    }
  }

  const deterministic = tryDeterministicRecommendationBeforeVenue(raw);
  if (deterministic) return deterministic;

  const trailing = tryTrailingPlaceWithIntent(raw);
  if (trailing) return trailing;

  if (intent.kind !== "venue_lookup") {
    const locationCandidate = extractLocationCandidate(raw);
    const hasLoc = Boolean(locationCandidate);
    return {
      queryMode: "goal_search",
      placeNameCandidate: null,
      intentGoalText: null,
      queryExplanation:
        "We read this as a goal-style search. Intent Fit is the lead signal; VibeGap adds how social and reviews line up on an illustrative mock venue.",
      queryContextBanner: hasLoc ? "Finding places that match your plan." : "Checking fit for your goal.",
      locationCandidate,
      recommendationMode: hasLoc,
      recommendationNearAnchorName: null,
      recommendationRankIntent: null,
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
    recommendationNearAnchorName: null,
    recommendationRankIntent: null,
  };
}
