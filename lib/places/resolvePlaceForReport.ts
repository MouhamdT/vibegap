import type { QueryClassification } from "@/lib/ai/queryMode";
import type { DetectedIntent, PlaceData } from "@/lib/types/vibecheck";
import { getGooglePlaceData } from "@/lib/places/googlePlacesProvider";
import { getMockPlaceForQuery } from "@/lib/places/mockPlacesProvider";

/**
 * Resolves `PlaceData` for a report: Google Text Search for named-venue modes when configured,
 * otherwise deterministic mock data (goal_search always uses mock illustrative venues).
 */
export async function resolvePlaceForReport(
  searchQuery: string,
  classification: QueryClassification,
  detectedIntent: DetectedIntent,
): Promise<PlaceData> {
  const hasKey = Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
  const tryGoogle =
    hasKey &&
    (classification.queryMode === "specific_place" || classification.queryMode === "place_with_intent");

  const googleTextQuery =
    classification.queryMode === "place_with_intent" && classification.placeNameCandidate?.trim()
      ? classification.placeNameCandidate.trim()
      : searchQuery.trim();

  if (tryGoogle) {
    const googlePlace = await getGooglePlaceData(googleTextQuery);
    if (googlePlace) return googlePlace;
  }

  return getMockPlaceForQuery(searchQuery, {
    queryMode: classification.queryMode,
    placeNameCandidate: classification.placeNameCandidate,
    goalIntentKind: classification.queryMode === "goal_search" ? detectedIntent.kind : undefined,
  });
}
