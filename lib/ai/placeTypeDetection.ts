import type { PlaceData } from "@/lib/types/vibecheck";

/** Coarse venue shape from Google types + light text — used for scoring nudges only. */
export type PlaceTypeCategory =
  | "cafe_brunch"
  | "restaurant_meal"
  | "bar_nightlife"
  | "study_library"
  | "lodging"
  | "other";

export function detectPlaceTypeCategory(place: PlaceData): PlaceTypeCategory {
  const types = (place.googleTypes ?? []).map((x) => x.toLowerCase());
  const t = new Set(types);
  if (t.has("library") || t.has("book_store")) return "study_library";
  if (t.has("night_club") || t.has("bar") || t.has("liquor_store")) return "bar_nightlife";
  if (t.has("lodging") || t.has("hotel")) return "lodging";
  if (
    t.has("cafe") ||
    t.has("coffee_shop") ||
    t.has("bakery") ||
    t.has("brunch_restaurant") ||
    t.has("meal_breakfast") ||
    t.has("meal_brunch")
  ) {
    return "cafe_brunch";
  }
  if (
    t.has("restaurant") ||
    t.has("meal_takeaway") ||
    t.has("food") ||
    t.has("meal_delivery") ||
    t.has("steak_house") ||
    t.has("pizza_restaurant")
  ) {
    return "restaurant_meal";
  }
  const blob = `${place.category} ${place.name}`.toLowerCase();
  if (/\blibrary|bookstore|bookshop|cowork|study space\b/.test(blob)) return "study_library";
  if (/\bcafé|cafe|coffee|espresso|brunch|bakery\b/.test(blob)) return "cafe_brunch";
  if (/\bbar | pub |club |nightclub\b/.test(blob)) return "bar_nightlife";
  if (/\brestaurant|bistro|trattoria|grill|kitchen\b/.test(blob)) return "restaurant_meal";
  return "other";
}
