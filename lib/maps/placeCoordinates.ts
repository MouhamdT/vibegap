import type { PlaceData } from "@/lib/types/vibecheck";

export function placeHasCoordinates(place: PlaceData): boolean {
  return (
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude)
  );
}
