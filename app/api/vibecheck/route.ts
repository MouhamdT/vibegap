import { applyAiNarrativeToReport } from "@/lib/ai/applyAiNarrative";
import { buildCompareModeResult } from "@/lib/ai/buildCompareMode";
import { rankCandidatesByIntent } from "@/lib/ai/candidateRanker";
import { parseCompareQuery } from "@/lib/ai/compareQuery";
import { classifyQueryMode } from "@/lib/ai/queryMode";
import { tryLandmarkGoalRecommendations } from "@/lib/ai/landmarkAnchorRouting";
import { buildMockVibeReport } from "@/lib/ai/truthEngine";
import { detectIntentFromQuery } from "@/lib/ai/truthEngine";
import { enrichRecommendationGeography } from "@/lib/geo/enrichRecommendationGeography";
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

  const compareParsed = parseCompareQuery(query);
  if (compareParsed) {
    const compare = await buildCompareModeResult(query, compareParsed);
    return NextResponse.json({
      mode: "compare",
      compare,
      sourceLabel: "Uses Google Places and available review signals. Social comparison is illustrative.",
    });
  }

  const intent = detectIntentFromQuery(query);
  const classification = classifyQueryMode(query, intent);

  const landmarkRecommendations = await tryLandmarkGoalRecommendations(query, classification, intent);
  if (landmarkRecommendations) {
    const { candidates, geography } = await enrichRecommendationGeography({
      candidates: landmarkRecommendations.candidates,
      locationCandidate: landmarkRecommendations.locationCandidate,
      nearAnchorName: landmarkRecommendations.nearAnchorName,
      landmarkAnchorPlace: landmarkRecommendations.anchorPlace,
    });
    return NextResponse.json({
      mode: "recommendations",
      detectedIntent: landmarkRecommendations.detectedIntent,
      locationCandidate: landmarkRecommendations.locationCandidate,
      nearAnchorName: landmarkRecommendations.nearAnchorName,
      anchorNote: landmarkRecommendations.anchorNote,
      geography,
      candidates,
      sourceLabel: "Uses Google Places and available review signals. Social comparison is illustrative.",
      recoveryMessage: null,
    });
  }

  if (classification.queryMode === "goal_search" && classification.recommendationMode && classification.locationCandidate) {
    const rankIntent = classification.recommendationRankIntent ?? intent;
    const candidates = await getGoogleCandidatePlaces(query, classification.locationCandidate);
    const ranked = rankCandidatesByIntent(candidates, rankIntent).slice(0, 6);
    const nearAnchor = classification.recommendationNearAnchorName;
    const anchorNote = nearAnchor
      ? `Using ${nearAnchor} as the area anchor.`
      : `Searching in ${classification.locationCandidate}.`;
    const { candidates: rankedWithGeo, geography } = await enrichRecommendationGeography({
      candidates: ranked,
      locationCandidate: classification.locationCandidate,
      nearAnchorName: nearAnchor,
      landmarkAnchorPlace: null,
    });
    return NextResponse.json({
      mode: "recommendations",
      detectedIntent: rankIntent,
      locationCandidate: classification.locationCandidate,
      nearAnchorName: nearAnchor,
      anchorNote,
      geography,
      candidates: rankedWithGeo,
      sourceLabel: "Uses Google Places and available review signals. Social comparison is illustrative.",
      recoveryMessage: null,
    });
  }

  if (classification.queryMode === "goal_search" && !classification.recommendationMode) {
    return NextResponse.json({
      mode: "needs_location",
      detectedIntentLabel: intent.label,
      locationCandidate: null,
      candidates: [],
      sourceLabel: "Uses Google Places and available review signals. Social comparison is illustrative.",
      recoveryMessage:
        "I couldn't find a confident match. Try adding a city, neighborhood, or landmark.",
    });
  }

  const report = await buildMockVibeReport(query);
  const finalReport = await applyAiNarrativeToReport(report);

  return NextResponse.json({ mode: "single_report", report: finalReport });
}
