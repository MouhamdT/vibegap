import { describe, expect, it } from "vitest";
import { rankCandidatesByIntent } from "@/lib/ai/candidateRanker";
import { detectIntentFromQuery } from "@/lib/ai/truthEngine";
import type { PlaceData, PriceLevel, ReviewTheme } from "@/lib/types/vibecheck";

function theme(id: string, label: string, sentiment: ReviewTheme["sentiment"]): ReviewTheme {
  return { id, label, sentiment, strength: 70 };
}

function mkPlace(input: {
  id: string;
  name: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: PriceLevel;
  positives?: string[];
  complaints?: string[];
  themes?: ReviewTheme[];
  googleTypes?: string[];
}): PlaceData {
  return {
    id: input.id,
    name: input.name,
    address: "1 Test Street",
    category: input.category,
    averageRating: input.rating ?? 4.4,
    reviewCount: input.reviewCount ?? 600,
    priceLevel: input.priceLevel ?? 2,
    reviewThemes: input.themes ?? [],
    recentReviewSummary: "",
    complaints: input.complaints ?? [],
    positives: input.positives ?? [],
    dataSource: "google",
    isRealPlaceData: true,
    hasRealGoogleReviews: true,
    googleTypes: input.googleTypes,
  };
}

describe("rankCandidatesByIntent fixtures", () => {
  it("brunch: morning-forward cafe beats a dinner-heavy steakhouse", () => {
    const brunchCafe = mkPlace({
      id: "brunch-cafe",
      name: "Morning Light Cafe",
      category: "Cafe",
      positives: ["great brunch menu", "fresh pastry and coffee", "sunny patio in the morning"],
      themes: [theme("t1", "Brunch favorites", "positive")],
      googleTypes: ["cafe", "coffee_shop", "brunch_restaurant"],
    });
    const steakhouse = mkPlace({
      id: "steakhouse",
      name: "Ember Grill",
      category: "Steakhouse",
      positives: ["excellent ribeye at dinner"],
      googleTypes: ["steak_house", "restaurant"],
    });
    const waitySpot = mkPlace({
      id: "waity",
      name: "Queue Corner",
      category: "Restaurant",
      positives: ["good breakfast plates"],
      complaints: ["long wait and line every weekend", "reservation needed"],
      googleTypes: ["restaurant"],
    });

    const intent = detectIntentFromQuery("brunch in prague");
    const ranked = rankCandidatesByIntent([steakhouse, waitySpot, brunchCafe], intent);

    expect(ranked[0]!.place.id).toBe("brunch-cafe");
    const steakIdx = ranked.findIndex((c) => c.place.id === "steakhouse");
    expect(steakIdx).toBeGreaterThan(0);
  });

  it("study: quiet work-friendly cafe beats a loud crowded bar", () => {
    const quietCafe = mkPlace({
      id: "quiet-cafe",
      name: "Reading Room Cafe",
      category: "Book cafe",
      positives: ["quiet atmosphere, great for laptop work", "fast wifi and outlets at most tables"],
      themes: [theme("t1", "Quiet and calm", "positive")],
    });
    const loudBar = mkPlace({
      id: "loud-bar",
      name: "Night Owl Bar",
      category: "Bar",
      positives: ["fun crowd"],
      complaints: ["very loud music", "packed and crowded most nights"],
    });

    const intent = detectIntentFromQuery("quiet place to study in tel aviv");
    const ranked = rankCandidatesByIntent([loudBar, quietCafe], intent);

    expect(ranked[0]!.place.id).toBe("quiet-cafe");
    expect(ranked[0]!.fitScore).toBeGreaterThan(ranked[1]!.fitScore);
  });

  it("low wait: walk-in friendly spot beats a line-heavy favorite", () => {
    const walkIn = mkPlace({
      id: "walk-in",
      name: "Easy Table",
      category: "Restaurant",
      positives: ["no wait even at lunch", "quick seating and friendly staff"],
    });
    const lineHeavy = mkPlace({
      id: "line-heavy",
      name: "Famous Queue House",
      category: "Restaurant",
      rating: 4.7,
      positives: ["amazing food worth the wait"],
      complaints: ["expect a long line", "waits over an hour on weekends"],
    });

    const intent = detectIntentFromQuery("restaurant with no waiting time in rome");
    const ranked = rankCandidatesByIntent([lineHeavy, walkIn], intent);

    expect(ranked[0]!.place.id).toBe("walk-in");
  });

  it("ranking is deterministic for the same pool and intent", () => {
    const pool = [
      mkPlace({ id: "a", name: "Alpha", category: "Cafe", positives: ["quiet, wifi"] }),
      mkPlace({ id: "b", name: "Beta", category: "Cafe", positives: ["calm study corner"] }),
      mkPlace({ id: "c", name: "Gamma", category: "Bar", complaints: ["loud"] }),
    ];
    const intent = detectIntentFromQuery("quiet place to study in tel aviv");
    const first = rankCandidatesByIntent(pool, intent).map((c) => c.place.id);
    const second = rankCandidatesByIntent(pool, intent).map((c) => c.place.id);
    expect(first).toEqual(second);
  });
});
