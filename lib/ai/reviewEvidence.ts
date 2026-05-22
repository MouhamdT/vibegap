import { isCleanReviewExcerpt } from "@/lib/ai/reviewReality";
import type { PlaceData, ReviewTheme, ReviewThemeSentiment } from "@/lib/types/vibecheck";

export type ReviewEvidenceLevel = "High" | "Medium" | "Low";

export type ReviewEvidenceThemeRow = {
  id: string;
  label: string;
  level: ReviewEvidenceLevel;
  sentiment: ReviewThemeSentiment;
};

export type ReviewEvidenceSnippetKind = "sample_signal" | "available_snippet";

export type ReviewEvidenceSnippet = {
  id: string;
  preview: string;
  full: string;
  canExpand: boolean;
  kind: ReviewEvidenceSnippetKind;
};

export type ReviewEvidenceModel = {
  themes: ReviewEvidenceThemeRow[];
  helped: string[];
  hurt: string[];
  snippets: ReviewEvidenceSnippet[];
  /** When true, show the “no real snippets” honesty line (themes/bullets may still exist). */
  showSnippetFallbackNote: boolean;
  hasStructuredEvidence: boolean;
};

const THEME_SHORT_LABELS: Record<string, string> = {
  noise: "Noise / crowding",
  crowding: "Crowding",
  wait_times: "Wait / lines",
  service_speed: "Service speed",
  price_value: "Value",
  food_quality: "Food quality",
  ambience_design: "Ambience",
  laptop_work: "Laptop / work fit",
  reservation_friction: "Reservation friction",
  seating: "Seating",
  vegan_options: "Vegan / vegetarian options",
  brunch: "Brunch",
  group_fit: "Group fit",
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function themeShortLabel(theme: ReviewTheme): string {
  return THEME_SHORT_LABELS[theme.id] ?? theme.label.replace(/\s+level$/i, "").trim();
}

function strengthToLevel(strength: number): ReviewEvidenceLevel {
  const s = clamp(Math.round(strength), 0, 100);
  if (s >= 68) return "High";
  if (s >= 42) return "Medium";
  return "Low";
}

function sortedThemes(place: PlaceData): ReviewTheme[] {
  return [...place.reviewThemes]
    .filter((t) => typeof t.strength === "number" && Number.isFinite(t.strength))
    .sort((a, b) => b.strength - a.strength);
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").slice(0, 96);
}

function bulletFromLine(line: string, maxLen: number): string {
  const t = line.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const sp = slice.lastIndexOf(" ");
  if (sp > maxLen * 0.5) return `${slice.slice(0, sp).trim()}…`;
  return `${slice.trim()}…`;
}

function previewForSnippet(full: string, maxLen: number): string {
  const t = full.trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  for (const sep of [". ", "! ", "? "] as const) {
    const idx = slice.lastIndexOf(sep);
    if (idx > maxLen * 0.52) return t.slice(0, idx + 1).trim();
  }
  const sp = slice.lastIndexOf(" ");
  if (sp > maxLen * 0.42) return slice.slice(0, sp).trim();
  return slice.trim();
}

/** Model / summary lines that are not quotable review excerpts. */
function isSyntheticReviewSummaryLine(text: string): boolean {
  const t = text.toLowerCase();
  if (/\bfetched sample\b/.test(t)) return true;
  if (/\bgoogle reviews\b/.test(t) && /\b(but|however|;)\b/.test(t)) return true;
  if (/no single repeating/.test(t)) return true;
  if (/no dominant complaint/.test(t)) return true;
  if (/positive notes, but no\b/.test(t)) return true;
  if (/mixed;\s*no\b/.test(t)) return true;
  if (/in the available signals\b/.test(t)) return true;
  if (/\bwe could parse\b/.test(t)) return true;
  return false;
}

function themeSupplementBullets(place: PlaceData, want: "positive" | "negative", cap: number): string[] {
  const out: string[] = [];
  for (const th of sortedThemes(place)) {
    if (out.length >= cap) break;
    if (want === "positive" && th.sentiment !== "positive") continue;
    if (want === "negative" && th.sentiment !== "negative") continue;
    const label = themeShortLabel(th);
    const level = strengthToLevel(th.strength);
    const lc = label.toLowerCase();
    if (want === "positive") {
      if (level === "High") {
        out.push(`Review themes lean positive on ${lc}.`);
      } else if (level === "Medium") {
        out.push(`Some review signals support ${lc}.`);
      } else {
        out.push(`${label} reads slightly positive, but only weakly in the snapshot.`);
      }
    } else if (level === "High") {
      out.push(`${label} stands out as a clearer watch-out in reviews.`);
    } else if (level === "Medium") {
      out.push(`${label} shows as a moderate watch-out in review themes.`);
    } else {
      out.push(`No strong ${lc} pattern showed up in what we could parse.`);
    }
  }
  return out;
}

function buildHelped(place: PlaceData): string[] {
  const max = 4;
  const fromLines = place.positives
    .map((p) => bulletFromLine(p, 200))
    .filter((p) => p.length >= 12 && !isSyntheticReviewSummaryLine(p));
  if (fromLines.length >= 2) return fromLines.slice(0, max);
  const merged = [...fromLines, ...themeSupplementBullets(place, "positive", max - fromLines.length)];
  return merged.slice(0, max);
}

function buildHurt(place: PlaceData): string[] {
  const max = 4;
  const fromLines = place.complaints
    .map((c) => bulletFromLine(c, 200))
    .filter((c) => c.length >= 12 && !isSyntheticReviewSummaryLine(c));
  if (fromLines.length >= 2) return fromLines.slice(0, max);
  const merged = [...fromLines, ...themeSupplementBullets(place, "negative", max - fromLines.length)];
  return merged.slice(0, max);
}

function buildSnippets(place: PlaceData): ReviewEvidenceSnippet[] {
  const raw = [...place.positives, ...place.complaints]
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 28 && !isSyntheticReviewSummaryLine(s) && isCleanReviewExcerpt(s));

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const t of raw) {
    const k = normalizeKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(t);
  }

  const previewMax = 150;
  const out: ReviewEvidenceSnippet[] = [];
  let i = 0;
  for (const text of deduped) {
    if (out.length >= 3) break;
    const preview = previewForSnippet(text, previewMax);
    const canExpand = preview.length + 12 < text.length;
    const kind: ReviewEvidenceSnippetKind = "available_snippet";
    out.push({
      id: `sn-${i++}-${normalizeKey(text).slice(0, 24)}`,
      preview,
      full: text,
      canExpand,
      kind,
    });
  }
  return out;
}

/**
 * Derives compact review-evidence copy from existing `PlaceData` fields only.
 * Snippets are only included when text passes excerpt hygiene (no invented quotes).
 */
export function buildReviewEvidence(place: PlaceData): ReviewEvidenceModel {
  const themes: ReviewEvidenceThemeRow[] = sortedThemes(place).map((th) => ({
    id: th.id,
    label: themeShortLabel(th),
    level: strengthToLevel(th.strength),
    sentiment: th.sentiment,
  }));

  const helped = buildHelped(place);
  const hurt = buildHurt(place);
  const snippets = buildSnippets(place);

  const hasStructuredEvidence =
    themes.length > 0 || helped.length > 0 || hurt.length > 0 || snippets.length > 0;

  const showSnippetFallbackNote =
    snippets.length === 0 && (themes.length > 0 || helped.length > 0 || hurt.length > 0);

  return {
    themes,
    helped,
    hurt,
    snippets,
    showSnippetFallbackNote,
    hasStructuredEvidence,
  };
}
