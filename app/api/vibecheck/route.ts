import { applyAiNarrativeToReport } from "@/lib/ai/applyAiNarrative";
import { rankCandidatesByIntent } from "@/lib/ai/candidateRanker";
import { classifyQueryMode } from "@/lib/ai/queryMode";
import { buildMockVibeReport } from "@/lib/ai/truthEngine";
import { detectIntentFromQuery } from "@/lib/ai/truthEngine";
import { getGoogleCandidatePlaces } from "@/lib/places/googleCandidateSearchProvider";
import { connection, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: Request) {
  await connection();

  const aiProviderRaw = process.env["AI_PROVIDER"];
  if (typeof aiProviderRaw === "string" && aiProviderRaw.trim().toLowerCase() === "gemini") {
    console.warn("[vibecheck] AI_PROVIDER is gemini — invoking Gemini narrative provider.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const queryRaw = (body as { query?: unknown }).query;
  if (queryRaw === undefined || queryRaw === null) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  if (typeof queryRaw !== "string") {
    return NextResponse.json({ error: "Query must be a string" }, { status: 400 });
  }

  const query = queryRaw.trim();
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const intent = detectIntentFromQuery(query);
  const classification = classifyQueryMode(query, intent);

  if (classification.queryMode === "goal_search" && classification.recommendationMode && classification.locationCandidate) {
    const candidates = await getGoogleCandidatePlaces(query, classification.locationCandidate);
    const ranked = rankCandidatesByIntent(candidates, intent);
    return NextResponse.json({
      mode: "recommendations",
      detectedIntent: intent,
      locationCandidate: classification.locationCandidate,
      candidates: ranked.slice(0, 6),
      sourceLabel: "Google Places data · Google review signals if available · Mock social signals",
      recoveryMessage: null,
    });
  }

  if (classification.queryMode === "goal_search" && !classification.recommendationMode) {
    return NextResponse.json({
      mode: "needs_location",
      detectedIntentLabel: intent.label,
      locationCandidate: null,
      candidates: [],
      sourceLabel: "Illustrative mock place data · Mock social signals",
      recoveryMessage: "Add a city or neighborhood so I can suggest real places. Try: quiet place to study in Copenhagen",
    });
  }

  const report = await buildMockVibeReport(query);
  const finalReport = await applyAiNarrativeToReport(report);

  return NextResponse.json({ mode: "single_report", report: finalReport });
}
