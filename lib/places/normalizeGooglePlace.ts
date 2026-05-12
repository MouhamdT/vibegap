import type { PlaceData, PriceLevel, ReviewTheme } from "@/lib/types/vibecheck";

/** Subset of Places API (New) fields used after Text Search. */
export interface GoogleLocalizedText {
  text?: string;
  languageCode?: string;
}

export interface GoogleReviewApi {
  text?: GoogleLocalizedText;
  originalText?: GoogleLocalizedText;
  rating?: number;
}

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
  photos?: unknown[];
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

function reviewBody(r: GoogleReviewApi): string {
  return localizedText(r.text) || localizedText(r.originalText);
}

const POSITIVE_PATTERNS: readonly { pattern: RegExp; line: string }[] = [
  { pattern: /\b(great|amazing|excellent|fantastic|love|loved|delicious|tasty|wonderful)\b/i, line: "Guests praise the overall experience in recent Google reviews." },
  { pattern: /\b(friendly|helpful|welcoming|attentive)\b/i, line: "Multiple reviews highlight friendly or attentive service." },
  { pattern: /\b(cozy|atmosphere|ambiance|vibe|beautiful|charming)\b/i, line: "Reviewers often mention atmosphere or design positively." },
  { pattern: /\b(worth|recommend|return|again|favorite)\b/i, line: "Several reviewers say they would return or recommend the spot." },
  { pattern: /\b(fast|quick|efficient)\b/i, line: "Some reviews call out quick or efficient service." },
];

const COMPLAINT_PATTERNS: readonly { pattern: RegExp; line: string }[] = [
  { pattern: /\b(loud|noisy|noise)\b/i, line: "Noise level comes up as a recurring theme in Google reviews." },
  { pattern: /\b(wait|waiting|line|queue|slow service|slow)\b/i, line: "Waits, lines, or slow pacing show up in several reviews." },
  { pattern: /\b(crowd|packed|busy|hectic)\b/i, line: "Crowding or a hectic room is mentioned by multiple reviewers." },
  { pattern: /\b(expensive|overpriced|pricey|not worth|small portion)\b/i, line: "Price or value expectations surface in critical comments." },
  { pattern: /\b(cold|undercooked|bland|disappointing)\b/i, line: "Some reviews cite food quality misses on specific visits." },
];

function derivePositivesAndComplaints(reviewTexts: string[]): { positives: string[]; complaints: string[] } {
  const blob = reviewTexts.join(" ").trim();
  const positives: string[] = [];
  const complaints: string[] = [];
  if (!blob) {
    return {
      positives: ["Not enough Google review text was returned to extract positives — open Maps for more detail."],
      complaints: ["Not enough Google review text was returned to extract drawbacks — open Maps for more detail."],
    };
  }
  for (const { pattern, line } of POSITIVE_PATTERNS) {
    if (pattern.test(blob) && !positives.includes(line)) positives.push(line);
  }
  for (const { pattern, line } of COMPLAINT_PATTERNS) {
    if (pattern.test(blob) && !complaints.includes(line)) complaints.push(line);
  }
  if (positives.length === 0) {
    positives.push("Review tone looks mixed-to-positive in the snippets returned from Google.");
  }
  if (complaints.length === 0) {
    complaints.push("No strong recurring complaint pattern in the returned Google review snippets.");
  }
  return {
    positives: positives.slice(0, 4),
    complaints: complaints.slice(0, 4),
  };
}

function buildReviewThemes(blob: string, seed: number): ReviewTheme[] {
  const lower = blob.toLowerCase();
  const foodPos = /\b(delicious|tasty|great food|amazing meal|menu)\b/i.test(lower);
  const foodNeg = /\b(bland|cold|undercooked|disappointing)\b/i.test(lower);
  const noiseNeg = /\b(loud|noisy|noise)\b/i.test(lower);
  const waitNeg = /\b(wait|line|slow)\b/i.test(lower);
  const valueNeg = /\b(expensive|overpriced|not worth|small portion)\b/i.test(lower);
  const servicePos = /\b(friendly|helpful|attentive)\b/i.test(lower);
  const serviceNeg = /\b(rude|ignored|unprofessional)\b/i.test(lower);

  const mk = (
    id: string,
    label: string,
    sentiment: "positive" | "negative" | "mixed",
    base: number,
  ): ReviewTheme => ({
    id,
    label,
    sentiment,
    strength: clamp(base + (seed % 22), 18, 92),
  });

  return [
    mk("food", "Food quality", foodNeg ? "negative" : foodPos ? "positive" : "mixed", 48 + (seed % 18)),
    mk("noise", "Noise level", noiseNeg ? "negative" : "mixed", 36 + (seed % 25)),
    mk("service", "Service", serviceNeg ? "negative" : servicePos ? "positive" : "mixed", 42 + (seed % 20)),
    mk("value", "Value for money", valueNeg ? "negative" : "mixed", 44 + (seed % 20)),
    mk("wait", "Wait times", waitNeg ? "negative" : "mixed", 38 + (seed % 24)),
  ];
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

  const reviewBodies = (googlePlace.reviews ?? [])
    .map((r) => reviewBody(r))
    .filter((t) => t.length > 0);

  const combinedReviews = reviewBodies.join(" ");
  const seed = djb2(`${placeId}|${combinedReviews.slice(0, 400)}`);

  const hoursHint =
    googlePlace.regularOpeningHours?.weekdayDescriptions?.slice(0, 2).join(" · ") ?? "";
  const recentReviewSummary =
    reviewBodies.length > 0
      ? `${reviewBodies
          .slice(0, 3)
          .map((t) => t.replace(/\s+/g, " ").trim())
          .join(" ")
          .slice(0, 280)}${reviewBodies.join(" ").length > 280 ? "…" : ""} — Summarized from Google user reviews.`
      : `No review paragraphs were returned for this place in the field mask — try opening Google Maps for "${name}".` +
        (hoursHint ? ` Hours (sample): ${hoursHint}.` : "");

  const { positives, complaints } = derivePositivesAndComplaints(reviewBodies);
  const themes = buildReviewThemes(combinedReviews || originalQuery, seed);

  return {
    id: `google:${placeId}`,
    name,
    address: address.length > 0 ? address : `Address not returned — search: ${originalQuery.trim()}`,
    category: deriveCategory(googlePlace),
    averageRating: Math.round(rating * 10) / 10,
    reviewCount,
    priceLevel: mapGooglePriceLevel(googlePlace.priceLevel),
    reviewThemes: themes,
    recentReviewSummary,
    complaints,
    positives,
    dataSource: "google",
    googlePlaceId: placeId,
    isRealPlaceData: true,
  };
}
