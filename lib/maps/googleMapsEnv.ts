/**
 * Browser-only Google Maps JS config (NEXT_PUBLIC_*).
 * Never use server-only `GOOGLE_PLACES_API_KEY` in client code.
 */

/** Fallback vector `mapId` when `NEXT_PUBLIC_GOOGLE_MAP_ID` is unset (Google sample map id). */
export const DEMO_MAP_ID = "90f67363769a989a";

export function getBrowserGoogleMapsApiKey(): string | null {
  const k = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (typeof k !== "string") return null;
  const t = k.trim();
  return t.length > 0 ? t : null;
}

export function getBrowserGoogleMapId(): string {
  const id = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;
  if (typeof id === "string" && id.trim().length > 0) return id.trim();
  return DEMO_MAP_ID;
}
