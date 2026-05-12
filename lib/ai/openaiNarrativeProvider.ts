import type { VibeReport } from "@/lib/types/vibecheck";
import {
  buildNarrativeModelInput,
  narrativePatchFromParsed,
  NARRATIVE_SYSTEM_PROMPT,
  NARRATIVE_USER_INSTRUCTION,
  parseNarrativeAssistantJson,
} from "@/lib/ai/narrativeShared";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const LOG_PREFIX = "[VibeGap] OpenAI narrative";

interface OpenAIChatMessage {
  role: "system" | "user";
  content: string;
}

function readOpenAiApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY ?? process.env["OPENAI_API_KEY"];
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/^\uFEFF/, "").trim();
  return stripped.length > 0 ? stripped : null;
}

/**
 * Calls OpenAI to polish copy only. Scores, place facts, and sources must remain unchanged by the caller.
 * Returns null if the key is missing, the call fails, or the response JSON is invalid.
 */
export async function generateNarrativeWithOpenAI(report: VibeReport): Promise<Partial<VibeReport> | null> {
  const apiKey = readOpenAiApiKey();
  if (!apiKey) {
    console.warn(
      `${LOG_PREFIX}: OPENAI_API_KEY is unset, empty, or whitespace-only after trim; using rule-based copy only.`,
    );
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const payload = buildNarrativeModelInput(report);

  const messages: OpenAIChatMessage[] = [
    { role: "system", content: NARRATIVE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${NARRATIVE_USER_INSTRUCTION}\n\nINPUT_JSON:\n${JSON.stringify(payload)}`,
    },
  ];

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const snippet = errBody.slice(0, 280).replace(/\s+/g, " ").trim();
      console.warn(
        `${LOG_PREFIX}: HTTP ${res.status} from chat completions.${snippet ? ` Body (truncated): ${snippet}` : ""}`,
      );
      return null;
    }

    const raw: unknown = await res.json();
    if (typeof raw !== "object" || raw === null) {
      console.warn(`${LOG_PREFIX}: response JSON was not an object.`);
      return null;
    }
    const root = raw as Record<string, unknown>;

    if ("error" in root && root.error != null) {
      console.warn(
        `${LOG_PREFIX}: API returned an error field in the body; check model name and account status.`,
      );
      return null;
    }

    const choices = root.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      console.warn(`${LOG_PREFIX}: response had no choices array or it was empty.`);
      return null;
    }

    const first = choices[0];
    if (typeof first !== "object" || first === null) {
      console.warn(`${LOG_PREFIX}: first choice was not an object.`);
      return null;
    }
    const firstRec = first as Record<string, unknown>;
    const message = firstRec.message;
    if (typeof message !== "object" || message === null) {
      console.warn(`${LOG_PREFIX}: choice.message was not an object.`);
      return null;
    }
    const msgRec = message as Record<string, unknown>;
    const content = msgRec.content;
    if (typeof content !== "string" || !content.trim()) {
      console.warn(`${LOG_PREFIX}: assistant message content was missing or empty.`);
      return null;
    }

    const parsed = parseNarrativeAssistantJson(content, LOG_PREFIX);
    if (!parsed) return null;

    return narrativePatchFromParsed(report, parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${LOG_PREFIX} request failed: ${msg}`);
    return null;
  }
}
