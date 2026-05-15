import type { DetectedIntent, PlaceData, ReviewTheme, UserIntentKind } from "@/lib/types/vibecheck";

export type ReviewSignalStrengthLine = {
  label: string;
  strengthLabel: string;
};

export type ReviewReality = {
  mainSignal: string;
  positiveSignals: string[];
  riskSignals: string[];
  decisionMeaning: string;
  decisionImpact: string;
  signalStrengths: ReviewSignalStrengthLine[];
  receipts: string[];
  receiptsHonestyNote: string | null;
  compareSummary: string;
};

const THEME_SHORT_LABELS: Record<string, string> = {
  noise: "Noise",
  crowding: "Crowding",
  wait_times: "Wait time",
  service_speed: "Service",
  price_value: "Price/value",
  food_quality: "Food quality",
  ambience_design: "Atmosphere",
  laptop_work: "Laptop/work friendliness",
  reservation_friction: "Reservation friction",
  seating: "Seating",
  vegan_options: "Vegan/vegetarian options",
  brunch: "Brunch",
  group_fit: "Group suitability",
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function themeShortLabel(theme: ReviewTheme): string {
  return THEME_SHORT_LABELS[theme.id] ?? theme.label.replace(/\s+level$/i, "").trim();
}

function strengthTier(strength: number): "Strong" | "Medium" | "Weak" {
  const s = clamp(Math.round(strength), 0, 100);
  if (s >= 68) return "Strong";
  if (s >= 42) return "Medium";
  return "Weak";
}

function strengthLabelForTheme(theme: ReviewTheme): string {
  const tier = strengthTier(theme.strength);
  if (theme.sentiment === "negative") return `${tier} risk signal`;
  if (theme.sentiment === "positive") return `${tier} signal`;
  return `${tier} signal`;
}

/** True when text is safe to show as a quoted receipt. */
export function isCleanReviewExcerpt(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 48) return false;
  if (/…$|\.\.\.\s*$/.test(t)) return false;
  if (/[,;:]\s*$/.test(t)) return false;
  if (/\b(whether we could|if we could fit|tasting menu without)\b/i.test(t)) return false;
  if (t.split(/\s+/).length < 8) return false;
  if (/[.!?]["']?\s*$/.test(t)) return true;
  if (t.length >= 100 && !/…/.test(t) && /\b(and|but|with|for)\b/i.test(t)) return true;
  return false;
}

function dedupeExcerpts(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const key = raw.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isCleanReviewExcerpt(raw)) out.push(raw.trim());
    if (out.length >= 3) break;
  }
  return out;
}

function isUsableSummary(text: string): boolean {
  const t = text.trim();
  if (t.length < 24) return false;
  if (/…$|\.\.\.$/.test(t)) return false;
  return true;
}

function sortedThemes(place: PlaceData): ReviewTheme[] {
  return [...place.reviewThemes]
    .filter((t) => typeof t.strength === "number" && Number.isFinite(t.strength))
    .sort((a, b) => b.strength - a.strength);
}

function buildMainSignal(place: PlaceData, positives: ReviewTheme[], risks: ReviewTheme[]): string {
  if (isUsableSummary(place.recentReviewSummary) && !place.recentReviewSummary.includes("…")) {
    const summary = place.recentReviewSummary.trim();
    if (summary.length <= 220) return summary;
  }

  const posLabels = positives.slice(0, 2).map(themeShortLabel);
  const riskLabels = risks.slice(0, 2).map(themeShortLabel);

  if (posLabels.length && riskLabels.length) {
    return `${posLabels.join(" and ")} are praised in available reviews, but ${riskLabels[0]!.toLowerCase()} is the main risk${riskLabels[1] ? ` alongside ${riskLabels[1]!.toLowerCase()}` : ""} in busier periods.`;
  }
  if (posLabels.length) {
    return `Reviews lean positive on ${posLabels.join(" and ").toLowerCase()}, with no single dominant risk in the current signal snapshot.`;
  }
  if (riskLabels.length) {
    return `Review themes repeatedly flag ${riskLabels.join(" and ").toLowerCase()} as the main friction points.`;
  }
  if (place.reviewCount > 0) {
    return `Review signals are mixed; no single theme dominates in the available sample (${place.reviewCount.toLocaleString()} reviews).`;
  }
  return "Limited review signal depth — treat fit scores as directional, not definitive.";
}

function buildDecisionImpact(intent: DetectedIntent | undefined, positives: ReviewTheme[], risks: ReviewTheme[]): string {
  const k: UserIntentKind = intent?.kind ?? "venue_lookup";
  const topRisk = risks[0] ? themeShortLabel(risks[0]).toLowerCase() : "timing friction";
  const topPos = positives[0] ? themeShortLabel(positives[0]).toLowerCase() : "overall quality";

  switch (k) {
    case "study_work":
    case "quiet_calm":
      return risks.some((t) => /noise|crowd|wait/i.test(t.id))
        ? "Better for casual focus than guaranteed quiet — noise, seating, or crowding may spike at peak hours."
        : "Workable for study-style visits if you can time around peak bustle.";
    case "budget_eats":
    case "budget_celebration":
      return risks.some((t) => /price|wait|reservation/i.test(t.id))
        ? `Good value signal on ${topPos}, but check ${topRisk} before committing a group tab.`
        : "Reasonable budget-night fit if the group can stay flexible on timing.";
    case "luxury":
    case "date_night":
      return `Strong for atmosphere and ${topPos}; risky if you need zero ${topRisk} on a fixed schedule.`;
    case "low_wait":
      return risks.some((t) => /wait|reservation|crowd/i.test(t.id))
        ? `Low-wait goal conflicts with ${topRisk} mentions — arrive off-peak or book ahead.`
        : "Fewer hard queue warnings in this snapshot, but peak-hour variability may still apply.";
    case "party_nightlife":
      return "Strong energy potential; plan buffer time if lines or door friction appear in reviews.";
    case "family":
      return "Fine for relaxed family plans; loud or adult-skewed peaks may need timing discipline.";
    default:
      return risks.length
        ? `Good pick when you can accept ${topRisk}; weaker if that tradeoff is a deal-breaker.`
        : `Solid ${topPos} read from reviews; confirm details on site before you commit.`;
  }
}

function buildDecisionMeaning(intent: DetectedIntent | undefined, positives: ReviewTheme[], risks: ReviewTheme[]): string {
  const k: UserIntentKind = intent?.kind ?? "venue_lookup";
  const hasWaitRisk = risks.some((t) => /wait|reservation|crowd/i.test(t.id));
  const hasValueRisk = risks.some((t) => /price/i.test(t.id));
  const hasNoiseRisk = risks.some((t) => /noise|crowd/i.test(t.id));

  switch (k) {
    case "study_work":
    case "quiet_calm":
      return hasNoiseRisk
        ? "Better for casual study than deep focus work if you cannot avoid peak crowding."
        : "Reasonable study context if seating and timing work for your session length.";
    case "budget_eats":
    case "budget_celebration":
      return hasWaitRisk
        ? "Good for a flexible group dinner; risky if the table needs strict timing."
        : hasValueRisk
          ? "Can work for budget-aware plans if menu math is checked before you go."
          : "Fits cost-conscious celebrations when the group tolerates some execution variance.";
    case "luxury":
    case "date_night":
      return hasWaitRisk
        ? "Strong for occasion atmosphere; reservation timing matters on peak nights."
        : "Good special-occasion pick if you want ambience over strict budget control.";
    case "low_wait":
      return hasWaitRisk
        ? "Risky for a strict no-wait plan; better with flexible arrival windows."
        : "Reasonable when you can still book or arrive slightly off-peak.";
    default:
      return hasWaitRisk
        ? "Good when plans are flexible; tighter timing increases friction risk."
        : "Useful as a shortlist anchor — validate the latest reviews before you commit.";
  }
}

function buildCompareSummary(positives: ReviewTheme[], risks: ReviewTheme[]): string {
  const pos = positives[0];
  const risk = risks[0];
  const posPart = pos
    ? `${strengthTier(pos.strength).toLowerCase()} ${themeShortLabel(pos).toLowerCase()}`
    : "mixed positives";
  const riskPart = risk
    ? `${strengthTier(risk.strength).toLowerCase()} ${themeShortLabel(risk).toLowerCase()} risk`
    : "lighter review risks";
  return `${posPart}, ${riskPart}`;
}

function inferExtraThemes(place: PlaceData): ReviewTheme[] {
  const blob = [
    place.recentReviewSummary,
    ...place.complaints,
    ...place.positives,
    place.category,
    place.name,
  ]
    .join(" ")
    .toLowerCase();

  const extras: ReviewTheme[] = [];
  const push = (id: string, label: string, sentiment: ReviewTheme["sentiment"], strength: number) => {
    if (place.reviewThemes.some((t) => t.id === id)) return;
    extras.push({ id, label, sentiment, strength: clamp(strength, 18, 88) });
  };

  if (/\bvegan|vegetarian|plant\b/.test(blob)) {
    push("vegan_options", "Vegan/vegetarian options", "mixed", 52);
  }
  if (/\bbrunch\b/.test(blob)) {
    push("brunch", "Brunch", "positive", 50);
  }
  if (/\bfamily|group|kids\b/.test(blob)) {
    push("group_fit", "Group suitability", "positive", 48);
  }
  if (/\bseat|seating|table\b/.test(blob)) {
    push("seating", "Seating", "mixed", 46);
  }

  return extras;
}

export function buildReviewReality(place: PlaceData, intent?: DetectedIntent): ReviewReality {
  const themes = [...sortedThemes(place), ...inferExtraThemes(place)];
  const positives = themes.filter((t) => t.sentiment === "positive").slice(0, 4);
  const risks = themes.filter((t) => t.sentiment === "negative").slice(0, 4);
  const mixedStrong = themes.filter((t) => t.sentiment === "mixed" && t.strength >= 50).slice(0, 2);

  const signalStrengths: ReviewSignalStrengthLine[] = [...positives, ...risks, ...mixedStrong]
    .slice(0, 8)
    .map((t) => ({
      label: themeShortLabel(t),
      strengthLabel: strengthLabelForTheme(t),
    }));

  const positiveSignals = positives.length
    ? positives.map(themeShortLabel)
    : mixedStrong.filter((t) => t.strength >= 45).map(themeShortLabel).slice(0, 3);

  const riskSignals = risks.length
    ? risks.map(themeShortLabel)
    : ["No dominant risk theme in the current snapshot"];

  const receipts = dedupeExcerpts([...place.positives, ...place.complaints]);
  const receiptsHonestyNote =
    receipts.length === 0
      ? "Review text was available only as partial excerpts, so VibeGap summarized the themes instead of quoting them."
      : null;

  return {
    mainSignal: buildMainSignal(place, positives, risks),
    positiveSignals: positiveSignals.length ? positiveSignals : ["Balanced review themes"],
    riskSignals,
    decisionMeaning: buildDecisionMeaning(intent, positives, risks),
    decisionImpact: buildDecisionImpact(intent, positives, risks),
    signalStrengths,
    receipts,
    receiptsHonestyNote,
    compareSummary: buildCompareSummary(positives, risks),
  };
}

export function buildCompareReviewSummary(place: PlaceData, intent?: DetectedIntent): string {
  return buildReviewReality(place, intent).compareSummary;
}
