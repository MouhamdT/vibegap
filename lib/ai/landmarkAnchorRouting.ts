import { rankCandidatesByIntent } from "@/lib/ai/candidateRanker";
import { hasGoalTailSignals, inferRecommendationIntentFromGoalSpan, type QueryClassification } from "@/lib/ai/queryMode";
import { resolveReportIntent } from "@/lib/ai/truthEngine";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { getGoogleCandidatePlaces } from "@/lib/places/googleCandidateSearchProvider";
import { resolvePlaceForReport } from "@/lib/places/resolvePlaceForReport";
import type { DetectedIntent, RankedCandidate } from "@/lib/types/vibecheck";

/** Food, drink, or stay venues: analyzing the matched place as a restaurant/hotel is appropriate. */
const FOOD_OR_HOSPITALITY_VENUE_TYPES = new Set([
  "restaurant",
  "cafe",
  "coffee_shop",
  "bar",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "food",
  "night_club",
  "lodging",
]);

/**
 * Landmarks, public spaces, broad areas, and transit hubs where a visit goal should trigger
 * “nearby picks” instead of single-place analysis.
 */
const LANDMARK_OR_AREA_ANCHOR_TYPES = new Set([
  "tourist_attraction",
  "landmark",
  "museum",
  "park",
  "national_park",
  "natural_feature",
  "city_hall",
  "locality",
  "neighborhood",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "sublocality_level_3",
  "sublocality_level_4",
  "sublocality_level_5",
  "route",
  "town_square",
  "public_square",
  "bridge",
  "monument",
  "plaza",
  "historical_landmark",
  "visitor_center",
  "art_gallery",
  "aquarium",
  "zoo",
  "stadium",
  "library",
  "university",
  "amusement_park",
  "marina",
  "ferry_terminal",
  "train_station",
  "transit_station",
  "subway_station",
  "light_rail_station",
  "airport",
]);

export function locationCandidateFromGoogleAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(", ");
  if (parts.length === 1) return parts[0]!;
  return "";
}

export function isGooglePlaceLandmarkAnchor(googleTypes: readonly string[] | undefined): boolean {
  if (!googleTypes || googleTypes.length === 0) return false;
  const set = new Set(googleTypes.map((t) => t.toLowerCase()));
  for (const food of FOOD_OR_HOSPITALITY_VENUE_TYPES) {
    if (set.has(food)) return false;
  }
  for (const anchor of LANDMARK_OR_AREA_ANCHOR_TYPES) {
    if (set.has(anchor)) return true;
  }
  return false;
}

export function buildLandmarkNearbyTextQuery(intentGoalText: string, anchorDisplayName: string): string {
  const goal = intentGoalText.trim();
  const anchor = anchorDisplayName.trim();
  return `${goal} near ${anchor}`.replace(/\s+/g, " ").trim();
}

function diningIntentFromGoalFragment(goalText: string): DetectedIntent | null {
  const inferred = inferRecommendationIntentFromGoalSpan(goalText);
  return inferred.kind === "venue_lookup" ? null : inferred;
}

export type LandmarkRecommendationResult = {
  detectedIntent: DetectedIntent;
  locationCandidate: string;
  nearAnchorName: string;
  anchorNote: string;
  candidates: RankedCandidate[];
};

/**
 * When the query is parsed as `place_with_intent` and Google resolves the named span to a
 * landmark/area (not a restaurant/cafe/hotel), return ranked nearby candidates instead of null
 * so the API route can switch to recommendation mode.
 */
export async function tryLandmarkGoalRecommendations(
  searchQuery: string,
  classification: QueryClassification,
  intentForResolve: DetectedIntent,
): Promise<LandmarkRecommendationResult | null> {
  if (classification.queryMode !== "place_with_intent") return null;
  const goalText = classification.intentGoalText?.trim();
  const anchorCandidate = classification.placeNameCandidate?.trim();
  if (!goalText || !anchorCandidate) return null;
  if (!hasGoalTailSignals(goalText)) return null;

  const detectedIntentBase = resolveReportIntent(searchQuery, classification);
  const mealIntent = diningIntentFromGoalFragment(goalText);
  const detectedIntent =
    detectedIntentBase.kind === "venue_lookup" && mealIntent != null ? mealIntent : detectedIntentBase;

  const resolved = await resolvePlaceForReport(searchQuery, classification, intentForResolve);

  if (resolved.place.dataSource !== "google" || !isGooglePlaceLandmarkAnchor(resolved.place.googleTypes)) {
    return null;
  }

  let locationCandidate = locationCandidateFromGoogleAddress(resolved.place.address).trim();
  if (!locationCandidate) {
    locationCandidate = resolved.place.address.trim() || anchorCandidate;
  }

  const nearAnchorName = formatSearchQueryForDisplay(resolved.place.name || anchorCandidate);
  const recommendationQuery = buildLandmarkNearbyTextQuery(goalText, nearAnchorName);

  const rawPlaces = await getGoogleCandidatePlaces(recommendationQuery, locationCandidate);
  if (rawPlaces.length === 0) return null;

  const ranked = rankCandidatesByIntent(rawPlaces, detectedIntent).slice(0, 6);
  const anchorNote = `Using ${nearAnchorName} as the area anchor.`;

  return {
    detectedIntent,
    locationCandidate,
    nearAnchorName,
    anchorNote,
    candidates: ranked,
  };
}
