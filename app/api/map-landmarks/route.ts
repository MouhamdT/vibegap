import { connection, NextResponse } from "next/server";
import { fetchNearbyMapLandmarks } from "@/lib/places/fetchMapLandmarks";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readExcludeIds(body: Record<string, unknown>): Set<string> {
  const raw = body.excludeGooglePlaceIds;
  if (!Array.isArray(raw)) return new Set();
  const out = new Set<string>();
  for (const x of raw) {
    if (typeof x === "string" && x.trim()) out.add(x.trim());
  }
  return out;
}

export async function POST(request: Request) {
  await connection();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const center = body.center;
  if (!isRecord(center)) {
    return NextResponse.json({ error: "center is required" }, { status: 400 });
  }

  const lat = center.lat;
  const lng = center.lng;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "center.lat and center.lng must be finite numbers" }, { status: 400 });
  }

  let radiusMeters = 1600;
  if (typeof body.radiusMeters === "number" && Number.isFinite(body.radiusMeters)) {
    radiusMeters = Math.min(3000, Math.max(200, body.radiusMeters));
  }

  let maxResults = 8;
  if (typeof body.maxResults === "number" && Number.isFinite(body.maxResults)) {
    maxResults = Math.min(8, Math.max(1, Math.floor(body.maxResults)));
  }

  const excludeGooglePlaceIds = readExcludeIds(body);

  const landmarks = await fetchNearbyMapLandmarks({
    center: { lat, lng },
    radiusMeters,
    maxResults,
    excludeGooglePlaceIds,
  });

  return NextResponse.json({ landmarks });
}
