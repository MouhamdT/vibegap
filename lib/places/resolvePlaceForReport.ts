import type { QueryClassification } from "@/lib/ai/queryMode";
import type { DetectedIntent, GooglePlacesFallbackKind, PlaceData } from "@/lib/types/vibecheck";
import { fetchGooglePlaceForReport } from "@/lib/places/googlePlacesProvider";
import { getMockPlaceForQuery } from "@/lib/places/mockPlacesProvider";
import { shouldSuggestPlaceDisambiguation } from "@/lib/places/placeDisambiguationHint";

export type ResolvedPlaceForReport = {
  place: PlaceData;
  googlePlacesFallback: GooglePlacesFallbackKind;
  suggestPlaceDisambiguation: boolean;
};

/**
 * Resolves `PlaceData` for a report: Google Text Search for named-venue modes when configured,
 * otherwise deterministic mock data (goal_search always uses mock illustrative venues).
 */
export async function resolvePlaceForReport(
  searchQuery: string,
  classification: QueryClassification,
  detectedIntent: DetectedIntent,
): Promise<ResolvedPlaceForReport> {
  const wantsGoogle =
    classification.queryMode === "specific_place" || classification.queryMode === "place_with_intent";

  const googleTextQuery =
    classification.queryMode === "place_with_intent" && classification.placeNameCandidate?.trim()
      ? classification.placeNameCandidate.trim()
      : searchQuery.trim();

  const suggestPlaceDisambiguation = wantsGoogle ? shouldSuggestPlaceDisambiguation(googleTextQuery) : false;

  if (!wantsGoogle) {
    const place = await getMockPlaceForQuery(searchQuery, {
      queryMode: classification.queryMode,
      placeNameCandidate: classification.placeNameCandidate,
      goalIntentKind: classification.queryMode === "goal_search" ? detectedIntent.kind : undefined,
    });
    return {
      place,
      googlePlacesFallback: "none",
      suggestPlaceDisambiguation: false,
    };
  }

  const hasKey = Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());

  if (!hasKey) {
    const place = await getMockPlaceForQuery(searchQuery, {
      queryMode: classification.queryMode,
      placeNameCandidate: classification.placeNameCandidate,
      goalIntentKind: undefined,
    });
    return {
      place,
      googlePlacesFallback: "lookup_unavailable",
      suggestPlaceDisambiguation,
    };
  }

  const googleResult = await fetchGooglePlaceForReport(googleTextQuery);

  if (googleResult.status === "ok") {
    return {
      place: googleResult.place,
      googlePlacesFallback: "none",
      suggestPlaceDisambiguation,
    };
  }

  const place = await getMockPlaceForQuery(searchQuery, {
    queryMode: classification.queryMode,
    placeNameCandidate: classification.placeNameCandidate,
    goalIntentKind: undefined,
  });

  const googlePlacesFallback: GooglePlacesFallbackKind =
    googleResult.status === "no_results" ? "no_confident_match" : "lookup_unavailable";

  return {
    place,
    googlePlacesFallback,
    suggestPlaceDisambiguation,
  };
}
