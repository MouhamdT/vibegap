import type { PlaceData } from "@/lib/types/vibecheck";

const DEMO_PLACE: PlaceData = {
  id: "mock-place-aurora-bistro",
  name: "Aurora Bistro",
  address: "128 River Lane, Portland, OR",
  category: "Restaurant",
  averageRating: 3.6,
  reviewCount: 842,
};

/**
 * Returns a single mock place. In v1 this will resolve from a real search.
 */
export function getMockPlaceForQuery(query: string): PlaceData {
  const trimmed = query.trim();
  if (!trimmed) {
    return DEMO_PLACE;
  }
  return {
    ...DEMO_PLACE,
    name: trimmed,
  };
}
