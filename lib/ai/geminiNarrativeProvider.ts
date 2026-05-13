import type { VibeReport } from "@/lib/types/vibecheck";
import {
  buildNarrativeModelInput,
  narrativePatchFromParsed,
  NARRATIVE_SYSTEM_PROMPT,
  NARRATIVE_USER_INSTRUCTION,
  parseNarrativeAssistantJson,
} from "@/lib/ai/narrativeShared";

const LOG = "[Gemini narrative]";
const DEFAULT_MODEL = "gemini-2.5-flash";
const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

function readGeminiApiKey(): string | null {
  const raw = process.env["GEMINI_API_KEY"];
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/^\uFEFF/, "").trim();
  return stripped.length > 0 ? stripped : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractGeminiAssistantText(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  if ("error" in raw && raw.error != null) {
    console.warn(`${LOG} API error object in response body.`);
    return null;
  }
  const candidates = raw.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    console.warn(`${LOG} no candidates in response.`);
    return null;
  }
  const c0 = candidates[0];
  if (!isRecord(c0)) return null;
  const finishReason = c0.finishReason;
  if (typeof finishReason === "string" && finishReason !== "STOP") {
    console.warn(`${LOG} candidate finishReason: ${finishReason}`);
  }
  const content = c0.content;
  if (!isRecord(content)) {
    console.warn(`${LOG} candidate.content missing.`);
    return null;
  }
  const parts = content.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    console.warn(`${LOG} candidate content.parts missing or empty.`);
    return null;
  }
  const texts: string[] = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    const text = part.text;
    if (typeof text === "string" && text.trim()) texts.push(text.trim());
  }
  if (texts.length === 0) {
    console.warn(`${LOG} no text parts in candidate content.`);
    return null;
  }
  return texts.join("\n");
}

function safeHttpErrorSummary(status: number, bodySnippet: string): string {
  const s = bodySnippet.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!s) return String(status);
  return `${status} ${s}`;
}

/**
 * Calls Gemini to polish narrative copy only. Server-side only; never throws to callers.
 */
export async function generateNarrativeWithGemini(report: VibeReport): Promise<Partial<VibeReport> | null> {
  const apiKey = readGeminiApiKey();
  const keyPresent = Boolean(apiKey);
  const aiProviderRaw = process.env["AI_PROVIDER"];
  console.warn(`${LOG} GEMINI_API_KEY present: ${keyPresent}`);
  console.warn(`${LOG} AI_PROVIDER: ${typeof aiProviderRaw === "string" ? aiProviderRaw.trim() || "(empty)" : "(unset)"}`);

  if (!apiKey) {
    console.warn(`${LOG} fallback: missing API key`);
    return null;
  }

  console.warn(`${LOG} starting`);

  const modelOverride = process.env["GEMINI_MODEL"];
  const model = typeof modelOverride === "string" && modelOverride.trim() ? modelOverride.trim() : DEFAULT_MODEL;
  const payload = buildNarrativeModelInput(report);
  const userText = `${NARRATIVE_USER_INSTRUCTION}\n\nINPUT_JSON:\n${JSON.stringify(payload)}`;

  const url = `${GEMINI_API_ROOT}/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: NARRATIVE_SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.35,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const snippet = errBody.slice(0, 280);
      console.warn(`${LOG} fallback: request failed: ${safeHttpErrorSummary(res.status, snippet)}`);
      return null;
    }

    const raw: unknown = await res.json();
    const text = extractGeminiAssistantText(raw);
    if (!text) {
      console.warn(`${LOG} fallback: invalid response shape`);
      return null;
    }

    const parsed = parseNarrativeAssistantJson(text, LOG);
    if (!parsed) return null;

    console.warn(`${LOG} success`);
    return narrativePatchFromParsed(report, parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${LOG} fallback: request failed: ${msg}`);
    return null;
  }
}
