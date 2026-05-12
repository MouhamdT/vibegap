import { buildMockVibeReport } from "@/lib/ai/truthEngine";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: Request) {
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

  const report = buildMockVibeReport(query);
  return NextResponse.json({ report });
}
