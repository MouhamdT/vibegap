import type { PlaceData, PriceLevel } from "@/lib/types/vibecheck";
import { extractReviewSignalsFromGoogleReviews } from "@/lib/ai/reviewSignalExtractor";
import {
  normalizeGoogleReviews,
  type GoogleLocalizedText,
  type GoogleReviewApi,
} from "@/lib/places/normalizeGoogleReviews";

export interface GoogleRegularOpeningHours {
  weekdayDescriptions?: string[];
}

export interface GooglePlaceApi {
  id?: string;
  name?: string;
  displayName?: GoogleLocalizedText;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: GoogleLocalizedText;
  regularOpeningHours?: GoogleRegularOpeningHours;
  reviews?: GoogleReviewApi[];
  relativePublishTimeDescription?: string;
  publishTime?: string;
  authorAttribution?: {
    displayName?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

function localizedText(t: GoogleLocalizedText | undefined): string {
  return typeof t?.text === "string" ? t.text.trim() : "";
}

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function extractGooglePlaceId(place: GooglePlaceApi): string {
  if (typeof place.id === "string" && place.id.length > 0) {
    return place.id;
  }
  const resource = typeof place.name === "string" ? place.name : "";
  const m = resource.match(/^places\/(.+)$/);
  return (m?.[1] ?? resource) || "unknown";
}

function mapGooglePriceLevel(level: string | undefined): PriceLevel {
  switch (level) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
    case "PRICE_LEVEL_UNSPECIFIED":
    default:
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
  }
}

function formatTypeLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function deriveCategory(place: GooglePlaceApi): string {
  const primaryLabel = localizedText(place.primaryTypeDisplayName);
  if (primaryLabel.length > 0) return primaryLabel;
  if (typeof place.primaryType === "string" && place.primaryType.length > 0) {
    return formatTypeLabel(place.primaryType);
  }
  const first = place.types?.find((t) => t && t !== "establishment" && t !== "point_of_interest");
  if (first) return formatTypeLabel(first);
  return "Place";
}

/**
 * Maps a single Google Place (Text Search result) into internal `PlaceData`.
 * Deterministic theme strength uses a hash of returned review text + place id.
 */
export function normalizeGooglePlaceToPlaceData(googlePlace: GooglePlaceApi, originalQuery: string): PlaceData {
  const placeId = extractGooglePlaceId(googlePlace);
  const name = localizedText(googlePlace.displayName) || "Unknown place";
  const address = typeof googlePlace.formattedAddress === "string" ? googlePlace.formattedAddress.trim() : "";
  const rating =
    typeof googlePlace.rating === "number" && Number.isFinite(googlePlace.rating)
      ? clamp(googlePlace.rating, 1, 5)
      : 4.0;
  const reviewCountRaw =
    typeof googlePlace.userRatingCount === "number" && Number.isFinite(googlePlace.userRatingCount)
      ? Math.round(googlePlace.userRatingCount)
      : 0;
  const reviewCount = Math.max(reviewCountRaw, googlePlace.reviews?.length ?? 0, 1);

  const normalizedReviews = normalizeGoogleReviews(googlePlace.reviews);
  const combinedReviews = normalizedReviews.map((r) => r.text).join(" ");
  const seed = djb2(`${placeId}|${combinedReviews.slice(0, 400)}|${originalQuery}`);

  const hoursHint =
    googlePlace.regularOpeningHours?.weekdayDescriptions?.slice(0, 2).join(" · ") ?? "";
  const extracted = extractReviewSignalsFromGoogleReviews(normalizedReviews);
  const hasRealGoogleReviews = extracted.hasRealGoogleReviews;

  const fallbackRecentReviewSummary =
    `Google reviews were not returned for this place in the current field mask — using mock review signals as fallback.` +
    (hoursHint ? ` Hours (sample): ${hoursHint}.` : "");

  const googleTypes = Array.isArray(googlePlace.types)
    ? googlePlace.types.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const googlePrimaryType =
    typeof googlePlace.primaryType === "string" && googlePlace.primaryType.length > 0 ? googlePlace.primaryType : undefined;

  let latitude: number | undefined;
  let longitude: number | undefined;
  const loc = googlePlace.location;
  if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
    if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
      latitude = loc.latitude;
      longitude = loc.longitude;
    }
  }

  return {
    id: `google:${placeId}`,
    name,
    address: address.length > 0 ? address : `Address not returned — search: ${originalQuery.trim()}`,
    category: deriveCategory(googlePlace),
    averageRating: Math.round(rating * 10) / 10,
    reviewCount,
    priceLevel: mapGooglePriceLevel(googlePlace.priceLevel),
    reviewThemes: hasRealGoogleReviews
      ? extracted.reviewThemes
      : [
          {
            id: "review_mix",
            label: "Review mix",
            sentiment: "mixed",
            strength: clamp(32 + (seed % 38), 18, 76),
          },
        ],
    recentReviewSummary: hasRealGoogleReviews ? extracted.recentReviewSummary : fallbackRecentReviewSummary,
    complaints: hasRealGoogleReviews
      ? extracted.complaints
      : ["Google review text was unavailable for this fetch; mock review signals are being used."],
    positives: hasRealGoogleReviews
      ? extracted.positives
      : ["Place profile and ratings come from Google Places; review signal details are mocked in this fallback."],
    dataSource: "google",
    googlePlaceId: placeId,
    isRealPlaceData: true,
    hasRealGoogleReviews,
    googleTypes: googleTypes.length > 0 ? googleTypes : undefined,
    googlePrimaryType,
    ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
  };
}
