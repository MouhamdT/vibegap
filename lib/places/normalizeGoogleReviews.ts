export type GoogleLocalizedText = {
  text?: string;
  languageCode?: string;
};

export type GoogleReviewApi = {
  text?: GoogleLocalizedText;
  originalText?: GoogleLocalizedText;
  rating?: number;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  authorAttribution?: {
    displayName?: string;
  };
};

export type NormalizedGoogleReview = {
  text: string;
  rating: number | null;
  relativePublishTimeDescription: string | null;
  publishTime: string | null;
  authorName: string | null;
  source: "google";
};

function cleanText(value: string | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function readReviewText(review: GoogleReviewApi): string {
  const original = cleanText(review.originalText?.text);
  if (original) return original;
  return cleanText(review.text?.text);
}

function normalizeRating(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizeIsoDate(value: string | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function normalizeGoogleReviews(reviews: GoogleReviewApi[] | undefined): NormalizedGoogleReview[] {
  if (!Array.isArray(reviews) || reviews.length === 0) return [];

  const normalized: NormalizedGoogleReview[] = [];
  for (const review of reviews) {
    const text = readReviewText(review);
    if (!text) continue;

    normalized.push({
      text,
      rating: normalizeRating(review.rating),
      relativePublishTimeDescription: cleanText(review.relativePublishTimeDescription) || null,
      publishTime: normalizeIsoDate(review.publishTime),
      authorName: cleanText(review.authorAttribution?.displayName) || null,
      source: "google",
    });
  }

  return normalized;
}
