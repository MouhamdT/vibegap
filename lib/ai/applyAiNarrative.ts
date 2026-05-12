import type { VibeReport } from "@/lib/types/vibecheck";
import { generateNarrativeWithGemini } from "@/lib/ai/geminiNarrativeProvider";
import { generateNarrativeWithOpenAI } from "@/lib/ai/openaiNarrativeProvider";
import { mergeNarrativePatch } from "@/lib/ai/narrativeShared";

function normalizeAiProvider(): "openai" | "gemini" | null {
  const v = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (v === "openai" || v === "gemini") return v;
  return null;
}

function patchIsComplete(patch: Partial<VibeReport> | null): patch is Partial<VibeReport> & {
  quickVerdict: NonNullable<Partial<VibeReport>["quickVerdict"]>;
  recommendation: NonNullable<Partial<VibeReport>["recommendation"]>;
  bestFor: string[];
  avoidIf: string[];
} {
  return Boolean(
    patch &&
      patch.quickVerdict &&
      patch.recommendation &&
      patch.bestFor &&
      patch.avoidIf,
  );
}

/**
 * Applies optional LLM narrative polish per `AI_PROVIDER`. Scores and place data stay rule-based.
 */
export async function applyAiNarrativeToReport(report: VibeReport): Promise<VibeReport> {
  const provider = normalizeAiProvider();
  if (provider === "gemini") {
    const patch = await generateNarrativeWithGemini(report);
    if (patchIsComplete(patch)) {
      const merged = mergeNarrativePatch(report, patch, "gemini");
      if (!merged.aiNarrativeUsed) {
        console.warn("[VibeGap] /api/vibecheck: Gemini returned a patch but merge did not apply it.");
      }
      return merged;
    }
    return report;
  }

  if (provider === "openai") {
    const patch = await generateNarrativeWithOpenAI(report);
    if (patchIsComplete(patch)) {
      const merged = mergeNarrativePatch(report, patch, "openai");
      if (!merged.aiNarrativeUsed) {
        console.warn("[VibeGap] /api/vibecheck: OpenAI returned a patch but merge did not apply it.");
      }
      return merged;
    }
    return report;
  }

  return report;
}
