"use client";

import { useCallback, useState } from "react";
import { ExampleSearchChips } from "@/components/ExampleSearchChips";
import { SearchBar } from "@/components/SearchBar";
import { CandidateResults } from "@/components/CandidateResults";
import { MethodologyAfterResults, MethodologyLandingPreview } from "@/components/MethodologyPanel";
import { VibeReport } from "@/components/VibeReport";
import type { RankedCandidate, VibeReport as VibeReportModel, VibecheckResponse } from "@/lib/types/vibecheck";

const FRIENDLY_API_ERROR =
  "Something went wrong while checking places. Your previous results are still shown.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecommendationsPayload(value: unknown): value is Extract<VibecheckResponse, { mode: "recommendations" }> {
  if (!isRecord(value)) return false;
  if (value.mode !== "recommendations") return false;
  if (!isRecord(value.detectedIntent)) return false;
  if (typeof value.detectedIntent.label !== "string") return false;
  if (typeof value.detectedIntent.kind !== "string") return false;
  if (typeof value.locationCandidate !== "string") return false;
  if (!Array.isArray(value.candidates)) return false;
  if (typeof value.sourceLabel !== "string") return false;
  return true;
}

function isNeedsLocationPayload(value: unknown): value is Extract<VibecheckResponse, { mode: "needs_location" }> {
  if (!isRecord(value)) return false;
  if (value.mode !== "needs_location") return false;
  if (typeof value.detectedIntentLabel !== "string") return false;
  if (value.locationCandidate !== null) return false;
  if (!Array.isArray(value.candidates)) return false;
  if (typeof value.recoveryMessage !== "string") return false;
  return true;
}

function isSingleReportPayload(value: unknown): value is Extract<VibecheckResponse, { mode: "single_report" }> {
  if (!isRecord(value) || !("report" in value)) return false;
  if (value.mode !== "single_report") return false;
  const reportUnknown = value.report;
  if (!isRecord(reportUnknown)) return false;

  if (typeof reportUnknown.searchQueryDisplay !== "string") return false;

  const pnc = reportUnknown.placeNameCandidate;
  if (!(pnc === null || typeof pnc === "string")) return false;
  if (typeof reportUnknown.queryExplanation !== "string") return false;
  if (typeof reportUnknown.queryContextBanner !== "string") return false;

  const pigd = reportUnknown.placeIntentGoalDisplay;
  if (!(pigd === null || typeof pigd === "string")) return false;

  const gpf = reportUnknown.googlePlacesFallback;
  if (gpf !== "none" && gpf !== "no_confident_match" && gpf !== "lookup_unavailable") return false;
  if (typeof reportUnknown.suggestPlaceDisambiguation !== "boolean") return false;

  if (
    reportUnknown.narrativeSource !== "rules" &&
    reportUnknown.narrativeSource !== "openai" &&
    reportUnknown.narrativeSource !== "gemini"
  ) {
    return false;
  }
  if (typeof reportUnknown.aiNarrativeUsed !== "boolean") return false;

  if (typeof reportUnknown.generatedAt !== "string") return false;
  if (typeof reportUnknown.socialSummary !== "string") return false;
  if (typeof reportUnknown.realitySummary !== "string") return false;

  if (!isRecord(reportUnknown.place) || typeof reportUnknown.place.name !== "string") return false;

  if (!isRecord(reportUnknown.score) || typeof reportUnknown.score.vibeGapScore !== "number") return false;
  if (typeof reportUnknown.score.intentFitScore !== "number") return false;
  if (typeof reportUnknown.score.intentFitVerdict !== "string") return false;
  if (!Array.isArray(reportUnknown.score.vibeGapExplanationBullets)) return false;
  if (!Array.isArray(reportUnknown.score.intentFitExplanationBullets)) return false;

  if (!isRecord(reportUnknown.detectedIntent)) return false;
  if (typeof reportUnknown.detectedIntent.kind !== "string") return false;
  if (typeof reportUnknown.detectedIntent.label !== "string") return false;
  if (reportUnknown.detectedIntent.confidence !== "high" && reportUnknown.detectedIntent.confidence !== "medium" && reportUnknown.detectedIntent.confidence !== "low") {
    return false;
  }
  if (!Array.isArray(reportUnknown.detectedIntent.matchedSignals)) return false;

  if (!Array.isArray(reportUnknown.socialHighlights)) return false;

  if (!isRecord(reportUnknown.decision)) return false;
  if (reportUnknown.decision.label !== "GO" && reportUnknown.decision.label !== "MAYBE" && reportUnknown.decision.label !== "SKIP") {
    return false;
  }
  if (
    reportUnknown.decision.confidence !== "High" &&
    reportUnknown.decision.confidence !== "Medium" &&
    reportUnknown.decision.confidence !== "Low"
  ) {
    return false;
  }
  if (typeof reportUnknown.decision.reason !== "string") return false;

  if (!isRecord(reportUnknown.quickVerdict)) return false;
  if (typeof reportUnknown.quickVerdict.title !== "string") return false;
  if (typeof reportUnknown.quickVerdict.explanation !== "string") return false;
  if (!Array.isArray(reportUnknown.quickVerdict.evidenceBullets)) return false;
  if (reportUnknown.quickVerdict.evidenceBullets.length !== 3) return false;
  for (const b of reportUnknown.quickVerdict.evidenceBullets) {
    if (typeof b !== "string") return false;
  }

  if (!Array.isArray(reportUnknown.bestFor) || !Array.isArray(reportUnknown.avoidIf)) return false;

  if (!isRecord(reportUnknown.recommendation)) return false;
  if (typeof reportUnknown.recommendation.headline !== "string") return false;
  if (typeof reportUnknown.recommendation.body !== "string") return false;

  return true;
}

export function VibeGapApp() {
  const [searchInput, setSearchInput] = useState("");
  const [report, setReport] = useState<VibeReportModel | null>(null);
  const [recommendations, setRecommendations] = useState<{
    detectedIntent: Extract<VibecheckResponse, { mode: "recommendations" }>["detectedIntent"];
    locationCandidate: string;
    candidates: RankedCandidate[];
    sourceLabel: string;
    nearAnchorName?: string | null;
    anchorNote?: string | null;
  } | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyInputNotice, setEmptyInputNotice] = useState<string | null>(null);

  const handleSearchInputChange = useCallback((v: string) => {
    setEmptyInputNotice(null);
    setSearchInput(v);
  }, []);

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setEmptyInputNotice("Tell me the plan first — for example, 'quiet place to study in Tel Aviv'.");
      return;
    }

    setEmptyInputNotice(null);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vibecheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const raw: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        console.warn("[VibeGap] vibecheck error", res.status, raw);
        setError(FRIENDLY_API_ERROR);
        return;
      }

      if (isRecommendationsPayload(raw)) {
        setRecommendations({
          detectedIntent: raw.detectedIntent,
          locationCandidate: raw.locationCandidate,
          candidates: raw.candidates as RankedCandidate[],
          sourceLabel: raw.sourceLabel,
          nearAnchorName: typeof raw.nearAnchorName === "string" ? raw.nearAnchorName : null,
          anchorNote: typeof raw.anchorNote === "string" ? raw.anchorNote : null,
        });
        setReport(null);
        setRecoveryMessage(null);
        return;
      }

      if (isNeedsLocationPayload(raw)) {
        setReport(null);
        setRecommendations(null);
        setRecoveryMessage(raw.recoveryMessage);
        return;
      }

      if (!isSingleReportPayload(raw)) {
        console.warn("[VibeGap] Unexpected vibecheck payload shape");
        setError(FRIENDLY_API_ERROR);
        return;
      }

      setReport(raw.report);
      setRecommendations(null);
      setRecoveryMessage(null);
    } catch (e) {
      console.warn("[VibeGap] vibecheck network failure", e);
      setError(FRIENDLY_API_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEmptySubmit = useCallback(() => {
    setEmptyInputNotice("Tell me the plan first — for example, 'quiet place to study in Tel Aviv'.");
  }, []);

  const useCompactChrome = Boolean(report || recommendations || recoveryMessage);
  const isRecommendationLayout = Boolean(recommendations);
  const hasResultsBody = Boolean(recommendations || recoveryMessage || report);

  return (
    <div
      className={`mx-auto w-full ${isRecommendationLayout ? "max-w-6xl" : "max-w-5xl"} ${useCompactChrome ? "space-y-3 sm:space-y-3" : "space-y-10 sm:space-y-12"}`}
    >
      {!useCompactChrome ? (
        <div className="flex flex-col items-center space-y-10 text-center sm:space-y-12">
          <header className="max-w-2xl space-y-4 px-2 sm:max-w-2xl">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl sm:leading-tight">
              Find the right place for the plan.
            </h1>
            <p className="text-pretty text-base leading-relaxed text-stone-600 sm:text-lg">
              Rank places by fit, risk, and review reality — not just hype.
            </p>
          </header>

          <div className="flex w-full flex-col items-center gap-5">
            <SearchBar
              value={searchInput}
              onValueChange={handleSearchInputChange}
              onSearch={runSearch}
              onEmptySubmit={handleEmptySubmit}
              disabled={loading}
              busy={loading}
              busyLabel="Analyzing…"
              placeholder='Try "quiet place to study in Tel Aviv"'
              submitLabel="Find matches"
              layout="hero"
            />
            {emptyInputNotice ? (
              <p className="max-w-xl px-2 text-center text-sm leading-relaxed text-amber-900/90" role="status">
                {emptyInputNotice}
              </p>
            ) : null}
            <ExampleSearchChips
              disabled={loading}
              onSelect={async (q) => {
                handleSearchInputChange(q);
                await runSearch(q);
              }}
            />
            {loading ? (
              <p className="text-center text-[12px] font-medium text-stone-500" role="status">
                Updating recommendation…
              </p>
            ) : null}
            <p className="max-w-lg px-3 text-center text-[12px] leading-relaxed text-stone-500 sm:text-[13px]">
              VibeGap turns a travel plan into a ranked shortlist using venue data, review themes, and goal-weighted scoring.
            </p>
            <MethodologyLandingPreview />
          </div>
        </div>
      ) : (
        <div className="space-y-2 border-b border-stone-200/40 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 max-w-md shrink-0 space-y-0.5">
              <h1 className="text-base font-semibold tracking-tight text-stone-950 sm:text-lg">Find the right place for the plan.</h1>
              <p className="text-[11px] leading-relaxed text-stone-500 sm:text-xs">
                Rank places by fit, risk, and review reality — not just hype.
              </p>
            </div>
            <div className="min-w-0 w-full flex-1 lg:flex lg:justify-end">
              <div className="w-full lg:max-w-[min(100%,42rem)]">
                <SearchBar
                  value={searchInput}
                  onValueChange={handleSearchInputChange}
                  onSearch={runSearch}
                  onEmptySubmit={handleEmptySubmit}
                  disabled={loading}
                  busy={loading}
                  busyLabel="Analyzing…"
                  placeholder='Try "quiet place to study in Tel Aviv"'
                  submitLabel="Find matches"
                  layout="compact"
                />
              </div>
            </div>
          </div>
          {emptyInputNotice ? (
            <p className="text-[12px] leading-relaxed text-amber-900/90 lg:ml-auto lg:max-w-[min(100%,42rem)]" role="status">
              {emptyInputNotice}
            </p>
          ) : null}
          {loading ? (
            <p className="text-[12px] font-medium text-stone-500 lg:ml-auto lg:max-w-[min(100%,42rem)]" role="status">
              Updating recommendation…
            </p>
          ) : null}
          {error ? (
            <div
              className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-[12px] leading-relaxed text-amber-950 lg:ml-auto lg:max-w-[min(100%,42rem)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </div>
      )}

      {!useCompactChrome && error ? (
        <p className="text-center text-sm leading-relaxed text-amber-950" role="alert">
          {error}
        </p>
      ) : null}

      {hasResultsBody ? (
        <>
          <div className="rounded-xl border border-stone-200/50 bg-white/95 p-3 sm:p-4">
            {recoveryMessage ? (
              <div className="rounded-lg border border-dashed border-stone-200/80 bg-stone-50/40 px-4 py-8 text-left sm:px-6 sm:py-10">
                <p className="text-sm font-medium leading-relaxed text-stone-800">{recoveryMessage}</p>
                <p className="mt-3 text-[12px] leading-relaxed text-stone-600">Examples:</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[12px] leading-relaxed text-stone-600">
                  <li>brunch near Trevi Fountain</li>
                  <li>quiet cafe in Copenhagen</li>
                  <li>cheap birthday dinner London</li>
                </ul>
              </div>
            ) : recommendations ? (
              <CandidateResults
                key={recommendations.candidates.map((c) => c.place.id).join("\u001f")}
                detectedIntent={recommendations.detectedIntent}
                locationCandidate={recommendations.locationCandidate}
                candidates={recommendations.candidates}
                nearAnchorName={recommendations.nearAnchorName ?? undefined}
                anchorNote={recommendations.anchorNote ?? undefined}
              />
            ) : report ? (
              <VibeReport report={report} />
            ) : null}
          </div>
          <MethodologyAfterResults />
        </>
      ) : null}
    </div>
  );
}
