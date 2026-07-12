import { rankCandidatesByIntent } from "@/lib/ai/candidateRanker";
import { inferRecommendationIntentFromGoalSpan } from "@/lib/ai/queryMode";
import type { ParsedVisitPlanQuery } from "@/lib/ai/planQuery";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { getDistanceMeters } from "@/lib/geo/distance";
import { getGoogleCandidatePlaces } from "@/lib/places/googleCandidateSearchProvider";
import { resolveTextSearchFirstLatLng } from "@/lib/places/resolveTextSearchLatLng";
import type { DetectedIntent, RankedCandidate, VisitPlanResult, VisitPlanStop } from "@/lib/types/vibecheck";

const CANDIDATES_PER_STOP = 8;

function stopGoalLabel(goalQuery: string, intent: DetectedIntent): string {
  if (intent.kind !== "venue_lookup") return intent.label;
  return formatSearchQueryForDisplay(goalQuery);
}

function withAnchorDistances(
  candidates: RankedCandidate[],
  anchor: { latitude: number; longitude: number } | null,
): RankedCandidate[] {
  if (!anchor) return candidates;
  return candidates.map((c) => {
    const lat = c.place.latitude;
    const lng = c.place.longitude;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ...c, distanceFromAnchorMeters: null };
    }
    return {
      ...c,
      distanceFromAnchorMeters: getDistanceMeters(anchor, { latitude: lat, longitude: lng }),
    };
  });
}

/**
 * Builds a two-stop visit plan: one candidate fetch per stop goal (parallel),
 * ranked with the same intent rules as recommendations. Returns null when
 * neither stop produced candidates so the route can fall back to normal routing.
 */
export async function buildVisitPlanResult(parsed: ParsedVisitPlanQuery): Promise<VisitPlanResult | null> {
  const location = parsed.locationText;

  const anchorPromise = resolveTextSearchFirstLatLng(location);
  const stopPromises = parsed.stopGoals.map(async (goalQuery): Promise<VisitPlanStop> => {
    const intent = inferRecommendationIntentFromGoalSpan(goalQuery);
    const rawPlaces = await getGoogleCandidatePlaces(goalQuery, location);
    const ranked = rankCandidatesByIntent(rawPlaces, intent).slice(0, CANDIDATES_PER_STOP);
    return {
      goalLabel: stopGoalLabel(goalQuery, intent),
      goalQuery,
      intent,
      candidates: ranked,
    };
  });

  const [anchorLatLng, ...stops] = await Promise.all([anchorPromise, ...stopPromises]);

  if (stops.every((s) => s.candidates.length === 0)) return null;

  const anchorPoint = anchorLatLng
    ? { latitude: anchorLatLng.latitude, longitude: anchorLatLng.longitude }
    : null;

  return {
    anchor: {
      displayName: parsed.locationDisplay,
      locationCandidate: location,
      latitude: anchorPoint?.latitude ?? null,
      longitude: anchorPoint?.longitude ?? null,
    },
    stops: stops.map((s) => ({ ...s, candidates: withAnchorDistances(s.candidates, anchorPoint) })),
  };
}
