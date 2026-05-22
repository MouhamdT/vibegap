import type { DecisionMapPin } from "@/lib/maps/decisionMapModel";
import { getDistanceMeters, type LatLng } from "@/lib/geo/distance";

export type LandmarkSearchContext = {
  center: { lat: number; lng: number };
  radiusMeters: number;
};

const MIN_RADIUS = 500;
const MAX_RADIUS = 2800;
const DEFAULT_NO_ANCHOR_RADIUS = 1600;

function asLatLng(pin: DecisionMapPin): LatLng {
  return { latitude: pin.lat, longitude: pin.lng };
}

/** Venue / compare pins used to size the search radius around an anchor. */
function nonAnchorPins(pins: DecisionMapPin[]): DecisionMapPin[] {
  return pins.filter((p) => p.kind !== "anchor");
}

/**
 * Picks a Places nearby-search center and radius from current map pins.
 * Prefer the search anchor when present; otherwise centroid of venue pins.
 */
export function computeLandmarkSearchContext(pins: DecisionMapPin[]): LandmarkSearchContext | null {
  if (pins.length === 0) return null;

  const anchor = pins.find((p) => p.kind === "anchor");
  const venues = nonAnchorPins(pins);

  if (anchor) {
    let maxM = 0;
    for (const v of venues) {
      const m = getDistanceMeters(asLatLng(anchor), asLatLng(v));
      if (Number.isFinite(m)) maxM = Math.max(maxM, m);
    }
    const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, maxM + 450));
    return { center: { lat: anchor.lat, lng: anchor.lng }, radiusMeters: radius };
  }

  if (venues.length === 0) return null;

  let sumLat = 0;
  let sumLng = 0;
  for (const v of venues) {
    sumLat += v.lat;
    sumLng += v.lng;
  }
  const center = { lat: sumLat / venues.length, lng: sumLng / venues.length };

  let maxR = 0;
  const cLL: LatLng = { latitude: center.lat, longitude: center.lng };
  for (const v of venues) {
    const m = getDistanceMeters(cLL, asLatLng(v));
    if (Number.isFinite(m)) maxR = Math.max(maxR, m);
  }
  const radius =
    venues.length <= 1
      ? DEFAULT_NO_ANCHOR_RADIUS
      : Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, maxR + 500));

  return { center, radiusMeters: radius };
}

/** Stable key for one fetch per map geometry (ignores selection flags). */
export function landmarkFetchKey(ctx: LandmarkSearchContext): string {
  return `${ctx.center.lat.toFixed(5)}|${ctx.center.lng.toFixed(5)}|${Math.round(ctx.radiusMeters)}`;
}
