import type { QuickVerdict, VibeReport } from "@/lib/types/vibecheck";

export const MAX_TITLE = 140;
export const MAX_SUMMARY = 900;
export const MAX_REASON = 320;
export const MAX_REC_BODY = 2200;
export const MAX_TAG = 120;
export const MAX_TAGS = 8;

/** Slim, factual payload for LLMs — no API keys. */
export type NarrativeModelInput = {
  searchQueryDisplay: string;
  queryMode: VibeReport["queryMode"];
  queryContextBanner: string;
  queryExplanation: string;
  placeIntentGoalDisplay: string | null;
  placeNameCandidate: string | null;
  googlePlacesFallback: VibeReport["googlePlacesFallback"];
  suggestPlaceDisambiguation: boolean;
  placeDataSource: "google" | "mock";
  placeCategory: string;
  /** Short paragraph describing the on-card sample framing (not from real social feeds). */
  sampleFramingSummary: string;
  realitySummary: string;
  scores: {
    vibeGapScore: number;
    intentFitScore: number;
    intentFitVerdict: string;
    verdict: string;
  };
  detectedIntentLabel: string;
  ruleQuickVerdict: {
    title: string;
    explanation: string;
    evidenceBullets: readonly string[];
  };
  ruleRecommendation: {
    headline: string;
    body: string;
  };
  ruleBestFor: string[];
  ruleAvoidIf: string[];
};

export const NARRATIVE_SYSTEM_PROMPT = `You are writing consumer-facing copy for VibeGap, a decision helper that compares a visitor's goal to Google Places venue data and available Google review signals using rule-based, goal-weighted scoring.

Rules (must follow):
- Use ONLY the facts, scores, and phrases provided in the user JSON. Do not invent reviews, posts, addresses, ratings, review counts, prices, venues, or events.
- Do NOT change or restate numeric scores as different numbers. You may refer to the scores only as already given (e.g. "signal gap score 42") if helpful.
- Never modify place facts, metadata, or source provenance in wording. Never claim TikTok, Instagram, or other social scraping.
- Do not modify or contradict the rule-based decision label/confidence/reason (GO/MAYBE/SKIP); those remain fixed.
- sampleFramingSummary describes illustrative on-card framing only — not live social feeds. Do not call it social media, hype, a feed, or mock social comparison.
- If placeDataSource is "google", you may say place details / review signals come from Google Places; if "mock", say place/review context is illustrative mock data.
- Be concise and scannable. Write for someone who wants a quick decision.
- Output must be JSON only: an object with exactly these keys and no others: quickVerdictTitle, quickVerdictSummary, topReasons, bestFor, avoidIf, finalRecommendation.
- Return a single JSON object only (no markdown fences, no commentary).`;

export const NARRATIVE_USER_INSTRUCTION = `Return JSON with exactly these keys (no extra keys):
{
  "quickVerdictTitle": string,
  "quickVerdictSummary": string,
  "topReasons": [string, string, string],
  "bestFor": string[],
  "avoidIf": string[],
  "finalRecommendation": string
}

Polish the tone of the existing rule-based content; stay faithful to the same meaning and constraints. bestFor and avoidIf should be the same count or fewer items than the rule lists unless the rule lists are empty — prefer 3–6 short chips each.`;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function trimTo(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function buildNarrativeModelInput(report: VibeReport): NarrativeModelInput {
  const ds = report.place.dataSource === "google" ? "google" : "mock";
  return {
    searchQueryDisplay: report.searchQueryDisplay,
    queryMode: report.queryMode,
    queryContextBanner: report.queryContextBanner,
    queryExplanation: report.queryExplanation,
    placeIntentGoalDisplay: report.placeIntentGoalDisplay,
    placeNameCandidate: report.placeNameCandidate,
    googlePlacesFallback: report.googlePlacesFallback,
    suggestPlaceDisambiguation: report.suggestPlaceDisambiguation,
    placeDataSource: ds,
    placeCategory: report.place.category,
    sampleFramingSummary: report.socialSummary,
    realitySummary: report.realitySummary,
    scores: {
      vibeGapScore: report.score.vibeGapScore,
      intentFitScore: report.score.intentFitScore,
      intentFitVerdict: report.score.intentFitVerdict,
      verdict: report.score.verdict,
    },
    detectedIntentLabel: report.detectedIntent.label,
    ruleQuickVerdict: {
      title: report.quickVerdict.title,
      explanation: report.quickVerdict.explanation,
      evidenceBullets: [...report.quickVerdict.evidenceBullets],
    },
    ruleRecommendation: {
      headline: report.recommendation.headline,
      body: report.recommendation.body,
    },
    ruleBestFor: [...report.bestFor],
    ruleAvoidIf: [...report.avoidIf],
  };
}

export function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return t.slice(firstBrace, lastBrace + 1).trim();
  }
  return t;
}

function isTrimmedNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringTuple3(v: unknown): v is [string, string, string] {
  if (!Array.isArray(v) || v.length !== 3) return false;
  return v.every((x) => isTrimmedNonEmptyString(x));
}

function isStringList(v: unknown, min: number, max: number): v is string[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) return false;
  return v.every((x) => isTrimmedNonEmptyString(x));
}

export type ParsedNarrative = {
  title: string;
  summary: string;
  reasons: readonly [string, string, string];
  finalRec: string;
  bestFor: string[];
  avoidIf: string[];
};

/** Parse and validate assistant JSON. `logPrefix` e.g. "[Gemini narrative]" or "[VibeGap] OpenAI narrative". */
export function parseNarrativeAssistantJson(content: string, logPrefix: string): ParsedNarrative | null {
  const stripped = extractJsonText(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    console.warn(`${logPrefix} fallback: invalid JSON`);
    return null;
  }
  if (!isRecord(parsed)) {
    console.warn(`${logPrefix} fallback: invalid JSON`);
    return null;
  }

  const title = parsed.quickVerdictTitle;
  const summary = parsed.quickVerdictSummary;
  const reasons = parsed.topReasons;
  const finalRec = parsed.finalRecommendation;
  const bestFor = parsed.bestFor;
  const avoidIf = parsed.avoidIf;

  if (!isTrimmedNonEmptyString(title)) {
    console.warn(`${logPrefix} missing or empty quickVerdictTitle.`);
    return null;
  }
  if (!isTrimmedNonEmptyString(summary)) {
    console.warn(`${logPrefix} missing or empty quickVerdictSummary.`);
    return null;
  }
  if (!isStringTuple3(reasons)) {
    console.warn(`${logPrefix} topReasons must be exactly 3 non-empty strings.`);
    return null;
  }
  if (!isTrimmedNonEmptyString(finalRec)) {
    console.warn(`${logPrefix} missing or empty finalRecommendation.`);
    return null;
  }
  if (!isStringList(bestFor, 1, MAX_TAGS)) {
    console.warn(`${logPrefix} bestFor must be a non-empty array (max ${MAX_TAGS}) of non-empty strings.`);
    return null;
  }
  if (!isStringList(avoidIf, 1, MAX_TAGS)) {
    console.warn(`${logPrefix} avoidIf must be a non-empty array (max ${MAX_TAGS}) of non-empty strings.`);
    return null;
  }

  return {
    title: trimTo(title, MAX_TITLE),
    summary: trimTo(summary, MAX_SUMMARY),
    reasons: [trimTo(reasons[0]!, MAX_REASON), trimTo(reasons[1]!, MAX_REASON), trimTo(reasons[2]!, MAX_REASON)],
    finalRec: trimTo(finalRec, MAX_REC_BODY),
    bestFor: bestFor.map((s) => trimTo(s, MAX_TAG)),
    avoidIf: avoidIf.map((s) => trimTo(s, MAX_TAG)),
  };
}

export function narrativePatchFromParsed(report: VibeReport, parsed: ParsedNarrative): Partial<VibeReport> {
  const quickVerdict: QuickVerdict = {
    title: parsed.title,
    explanation: parsed.summary,
    evidenceBullets: parsed.reasons,
  };
  return {
    quickVerdict,
    recommendation: {
      headline: report.recommendation.headline,
      body: parsed.finalRec,
    },
    bestFor: parsed.bestFor,
    avoidIf: parsed.avoidIf,
  };
}

export type NarrativeAiSource = "openai" | "gemini";

/** Merges validated narrative text; keeps rule-based recommendation headline and all scores / place data. */
export function mergeNarrativePatch(base: VibeReport, patch: Partial<VibeReport>, narrativeSource: NarrativeAiSource): VibeReport {
  if (!patch.quickVerdict || !patch.recommendation || !patch.bestFor || !patch.avoidIf) {
    console.warn("[VibeGap] Narrative merge: skipped — patch missing quickVerdict, recommendation, bestFor, or avoidIf.");
    return base;
  }
  if (typeof patch.recommendation.body !== "string" || !patch.recommendation.body.trim()) {
    console.warn("[VibeGap] Narrative merge: skipped — recommendation.body was empty.");
    return base;
  }

  return {
    ...base,
    quickVerdict: patch.quickVerdict,
    recommendation: {
      headline: base.recommendation.headline,
      body: patch.recommendation.body,
    },
    bestFor: patch.bestFor,
    avoidIf: patch.avoidIf,
    narrativeSource,
    aiNarrativeUsed: true,
  };
}
