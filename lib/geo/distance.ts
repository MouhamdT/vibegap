/** WGS84 coordinates in decimal degrees. */
export type LatLng = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_M = 6_371_008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine great-circle distance in meters. */
export function getDistanceMeters(from: LatLng, to: LatLng): number {
  const φ1 = toRad(from.latitude);
  const φ2 = toRad(to.latitude);
  const Δφ = toRad(to.latitude - from.latitude);
  const Δλ = toRad(to.longitude - from.longitude);

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/** Human-readable straight-line distance (m / km). */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) {
    const m = Math.round(meters);
    return `${m}m`;
  }
  const km = meters / 1000;
  const rounded = Math.round(km * 10) / 10;
  const text = Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
  return `${text}km`;
}
