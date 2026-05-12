import { buildMockVibeReport } from "@/lib/ai/truthEngine";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let query = "";
  try {
    const body: unknown = await request.json();
    if (
      body &&
      typeof body === "object" &&
      "query" in body &&
      typeof (body as { query: unknown }).query === "string"
    ) {
      query = (body as { query: string }).query;
    }
  } catch {
    query = "";
  }

  const report = buildMockVibeReport(query);
  return NextResponse.json({ report });
}
