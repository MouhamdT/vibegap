import type { DetectedIntent, QueryMode } from "@/lib/types/vibecheck";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";

export type QueryClassification = {
  queryMode: QueryMode;
  /** Parsed venue-ish substring when mode is `place_with_intent`; formatted display for `specific_place`. */
  placeNameCandidate: string | null;
  /** Short user-facing note on how the search was read. */
  queryExplanation: string;
  /** One-line banner for the report header. */
  queryContextBanner: string;
};

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
  return /\b(stud(y|ying|ies)|laptop|wifi|work|homework|party|nightlife|celebrate|celebration|birthday|anniversary|cheap|budget|affordable|value|date|romantic|proposal|family|kids|children|quiet|calm|focus|reading|toast|occasion|gathering|dinner|brunch|lunch|studying)\b/.test(
    t,
  );
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
        queryExplanation:
          "You named a venue and a goal after “for …”. Intent Fit scores the goal; VibeGap still compares social clips to reviews for that named pick (mock data).",
        queryContextBanner: "Checking this place against your goal.",
      };
    }
  }

  if (intent.kind !== "venue_lookup") {
    return {
      queryMode: "goal_search",
      placeNameCandidate: null,
      queryExplanation:
        "We read this as a goal-style search. Intent Fit is the lead signal; VibeGap adds how social and reviews line up on an illustrative mock venue.",
      queryContextBanner: "Checking fit for your goal.",
    };
  }

  return {
    queryMode: "specific_place",
    placeNameCandidate: raw.length > 0 ? formatSearchQueryForDisplay(raw) : null,
    queryExplanation:
      "We read this as a named venue. VibeGap is the headline read (social vs reviews); Intent Fit stays neutral unless goal words show up in the text.",
    queryContextBanner: "Checking this specific place.",
  };
}
