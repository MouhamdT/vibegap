import type { VibeReport } from "@/lib/types/vibecheck";
import {
  buildNarrativeModelInput,
  narrativePatchFromParsed,
  NARRATIVE_SYSTEM_PROMPT,
  NARRATIVE_USER_INSTRUCTION,
  parseNarrativeAssistantJson,
} from "@/lib/ai/narrativeShared";

const LOG = "[Gemini narrative]";
const DEFAULT_MODEL = "gemini-2.0-flash";
const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

function readGeminiApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY ?? process.env["GEMINI_API_KEY"];
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
  const p0 = parts[0];
  if (!isRecord(p0)) return null;
  const text = p0.text;
  if (typeof text !== "string" || !text.trim()) {
    console.warn(`${LOG} first part had no text.`);
    return null;
  }
  return text;
}

/**
 * Calls Gemini to polish narrative copy only. Server-side only; never throws to callers.
 */
export async function generateNarrativeWithGemini(report: VibeReport): Promise<Partial<VibeReport> | null> {
  const apiKey = readGeminiApiKey();
  const keyPresent = Boolean(apiKey);
  console.warn(`${LOG} API key present: ${keyPresent}`);

  if (!apiKey) {
    console.warn(`${LOG} fallback: missing API key`);
    return null;
  }

  console.warn(`${LOG} starting`);

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
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
      const snippet = errBody.slice(0, 280).replace(/\s+/g, " ").trim();
      console.warn(
        `${LOG} fallback: request failed: HTTP ${res.status}${snippet ? ` — ${snippet}` : ""}`,
      );
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
