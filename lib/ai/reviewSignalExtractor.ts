import type { ReviewTheme } from "@/lib/types/vibecheck";
import type { NormalizedGoogleReview } from "@/lib/places/normalizeGoogleReviews";

type ThemeKey =
  | "noise"
  | "crowding"
  | "wait_times"
  | "service_speed"
  | "price_value"
  | "food_quality"
  | "ambience_design"
  | "laptop_work"
  | "reservation_friction";

type ThemeDef = {
  key: ThemeKey;
  label: string;
  positive: readonly RegExp[];
  negative: readonly RegExp[];
};

type ThemeScore = {
  pos: number;
  neg: number;
};

const THEME_DEFS: readonly ThemeDef[] = [
  {
    key: "noise",
    label: "Noise level",
    positive: [/\bquiet\b/i, /\bcalm\b/i, /\bpeaceful\b/i, /\blow noise\b/i],
    negative: [/\bloud\b/i, /\bnoisy\b/i, /\bnoise\b/i, /\bblaring\b/i],
  },
  {
    key: "crowding",
    label: "Crowding",
    positive: [/\bnot crowded\b/i, /\bspacious\b/i, /\broomy\b/i],
    negative: [/\bcrowded\b/i, /\bpacked\b/i, /\bbusy\b/i, /\bjammed\b/i, /\bcramped\b/i],
  },
  {
    key: "wait_times",
    label: "Wait times",
    positive: [/\bno wait\b/i, /\bquick seating\b/i, /\bfast line\b/i],
    negative: [/\bwait\b/i, /\bline\b/i, /\bqueue\b/i, /\bslow\b/i, /\blong time\b/i],
  },
  {
    key: "service_speed",
    label: "Service speed",
    positive: [/\bquick service\b/i, /\bfast service\b/i, /\bprompt\b/i, /\battentive\b/i],
    negative: [/\bslow service\b/i, /\bignored\b/i, /\brude\b/i, /\bdelayed\b/i],
  },
  {
    key: "price_value",
    label: "Value for money",
    positive: [/\bgood value\b/i, /\bworth it\b/i, /\baffordable\b/i, /\breasonable price\b/i],
    negative: [/\boverpriced\b/i, /\bexpensive\b/i, /\bpricey\b/i, /\bnot worth\b/i, /\bcostly\b/i],
  },
  {
    key: "food_quality",
    label: "Food quality",
    positive: [/\bdelicious\b/i, /\btasty\b/i, /\bamazing food\b/i, /\bgreat food\b/i, /\bfresh\b/i],
    negative: [/\bbland\b/i, /\bcold food\b/i, /\bundercooked\b/i, /\bovercooked\b/i, /\bbad food\b/i],
  },
  {
    key: "ambience_design",
    label: "Ambience & design",
    positive: [/\bcozy\b/i, /\bbeautiful\b/i, /\batmosphere\b/i, /\bambience\b/i, /\bstylish\b/i],
    negative: [/\bdated\b/i, /\bdirty\b/i, /\buncomfortable\b/i, /\bbad ambience\b/i],
  },
  {
    key: "laptop_work",
    label: "Laptop/work friendliness",
    positive: [/\bwifi\b/i, /\bwi-fi\b/i, /\boutlet\b/i, /\bwork-friendly\b/i, /\bstudy\b/i, /\blaptop\b/i],
    negative: [/\bno wifi\b/i, /\bno wi-fi\b/i, /\bno outlets\b/i, /\bnot laptop friendly\b/i, /\btoo loud to work\b/i],
  },
  {
    key: "reservation_friction",
    label: "Reservation friction",
    positive: [/\beasy reservation\b/i, /\bquick booking\b/i, /\bwalk-?in available\b/i],
    negative: [/\breservation\b/i, /\bbooked out\b/i, /\bhard to book\b/i, /\bcouldn'?t reserve\b/i],
  },
];

export type ExtractedReviewSignals = {
  reviewThemes: ReviewTheme[];
  complaints: string[];
  positives: string[];
  recentReviewSummary: string;
  hasRealGoogleReviews: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function countMatches(text: string, patterns: readonly RegExp[]): number {
  let count = 0;
  for (const p of patterns) {
    if (p.test(text)) count += 1;
  }
  return count;
}

function normalizeSnippet(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 48) return null;
  if (t.length <= 140) {
    if (/…$|\.\.\.$/.test(t)) return null;
    if (/[.!?]["']?\s*$/.test(t)) return t;
    return null;
  }
  return null;
}

export function extractReviewSignalsFromGoogleReviews(reviews: NormalizedGoogleReview[]): ExtractedReviewSignals {
  if (!reviews.length) {
    return {
      reviewThemes: [],
      complaints: [],
      positives: [],
      recentReviewSummary: "",
      hasRealGoogleReviews: false,
    };
  }

  const scores = new Map<ThemeKey, ThemeScore>();
  for (const def of THEME_DEFS) {
    scores.set(def.key, { pos: 0, neg: 0 });
  }

  const positives: string[] = [];
  const complaints: string[] = [];

  for (const review of reviews) {
    const text = review.text.toLowerCase();
    for (const def of THEME_DEFS) {
      const score = scores.get(def.key);
      if (!score) continue;
      score.pos += countMatches(text, def.positive);
      score.neg += countMatches(text, def.negative);
    }

    const hasNeg = /\b(loud|noisy|crowded|packed|wait|line|overpriced|expensive|slow|hard to book)\b/i.test(review.text);
    const hasPos = /\b(great|delicious|friendly|cozy|quiet|quick|worth|wifi|outlet)\b/i.test(review.text);
    if (hasNeg && complaints.length < 6) {
      const snippet = normalizeSnippet(review.text);
      if (snippet) complaints.push(snippet);
    }
    if (hasPos && positives.length < 6) {
      const snippet = normalizeSnippet(review.text);
      if (snippet) positives.push(snippet);
    }
  }

  const reviewThemes: ReviewTheme[] = THEME_DEFS.map((def) => {
    const score = scores.get(def.key) ?? { pos: 0, neg: 0 };
    const total = score.pos + score.neg;
    const sentiment: ReviewTheme["sentiment"] =
      score.neg > score.pos ? "negative" : score.pos > score.neg ? "positive" : "mixed";
    return {
      id: def.key,
      label: def.label,
      sentiment,
      strength: clamp(total * 14 + 18, 18, 95),
    };
  }).sort((a, b) => b.strength - a.strength);

  const topNeg = reviewThemes.filter((t) => t.sentiment === "negative").slice(0, 2).map((t) => t.label.toLowerCase());
  const topPos = reviewThemes.filter((t) => t.sentiment === "positive").slice(0, 2).map((t) => t.label.toLowerCase());
  const summaryParts: string[] = [];
  if (topNeg.length) summaryParts.push(`Recent Google reviews frequently mention ${topNeg.join(" and ")} as concerns.`);
  if (topPos.length) summaryParts.push(`Positive mentions often highlight ${topPos.join(" and ")}.`);
  if (!summaryParts.length) summaryParts.push("Recent Google reviews are mixed with no single dominant theme.");

  return {
    reviewThemes: reviewThemes.slice(0, 6),
    complaints: complaints.length ? complaints.slice(0, 4) : ["Google reviews are mixed; no dominant complaint in the returned review text."],
    positives: positives.length ? positives.slice(0, 4) : ["Google reviews include positive notes, but no single repeating strength in the returned review text."],
    recentReviewSummary: summaryParts.join(" "),
    hasRealGoogleReviews: true,
  };
}
