"use client";

import { useCallback, useEffect, useState } from "react";
import { ProcessingSteps } from "@/components/ProcessingSteps";
import { SearchBar } from "@/components/SearchBar";
import { VibeReport } from "@/components/VibeReport";
import type { VibeReport as VibeReportModel } from "@/lib/types/vibecheck";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVibeReportPayload(value: unknown): value is { report: VibeReportModel } {
  if (!isRecord(value) || !("report" in value)) return false;
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
  const [report, setReport] = useState<VibeReportModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepId, setStepId] = useState("1");
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "loading" | "success">("idle");

  useEffect(() => {
    if (!loading) return;
    setStepId("1");
    let current = 1;
    const id = window.setInterval(() => {
      if (current >= 4) return;
      current += 1;
      setStepId(String(current));
    }, 500);
    return () => window.clearInterval(id);
  }, [loading]);

  const onSearch = useCallback(async (query: string) => {
    setLoading(true);
    setPipelineStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/vibecheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const raw: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          isRecord(raw) && typeof raw.error === "string" ? raw.error : `Request failed (${res.status})`;
        setError(msg);
        setPipelineStatus("idle");
        return;
      }

      if (!isVibeReportPayload(raw)) {
        setError("Unable to parse the server response.");
        setPipelineStatus("idle");
        return;
      }

      setReport(raw.report);
      setPipelineStatus("success");
      setStepId("4");
    } catch {
      setError("Network error — check your connection and try again.");
      setPipelineStatus("idle");
    } finally {
      setLoading(false);
    }
  }, []);

  const showPipeline = pipelineStatus !== "idle";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <SearchBar onSearch={onSearch} disabled={loading} />

      {error ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {showPipeline ? (
        <div className="space-y-3">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-stone-500">
            {pipelineStatus === "loading" ? "Running mock analysis" : "Analysis complete"}
          </p>
          <ProcessingSteps
            status={pipelineStatus}
            activeStepId={pipelineStatus === "loading" ? stepId : undefined}
          />
        </div>
      ) : null}

      <div className="rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-sm sm:p-10">
        <VibeReport report={report} />
      </div>
    </div>
  );
}
