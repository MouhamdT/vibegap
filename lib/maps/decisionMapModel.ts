import { recommendationDistanceLabel } from "@/lib/geo/recommendationDistanceLabel";
import { formatDistance } from "@/lib/geo/distance";
import type {
  ComparePlaceSide,
  PlaceData,
  RankedCandidate,
  RecommendationGeography,
  SinglePlaceGeography,
} from "@/lib/types/vibecheck";
import { placeHasCoordinates } from "@/lib/maps/placeCoordinates";

export type DecisionMapPinKind = "candidate" | "anchor" | "compareA" | "compareB";

export type DecisionMapPin = {
  id: string;
  kind: DecisionMapPinKind;
  rank: number | null;
  name: string;
  lat: number;
  lng: number;
  decisionLabel?: string;
  fitScore?: number;
  /** Labeled distance for UI (never a bare number). */
  distanceFromAnchorLine?: string;
  /** Street address for map footer (recommendation). */
  addressLine?: string;
  /** One-line main risk for map popup (recommendation / compare). */
  mainRisk?: string;
  /** Aggregated rating (1–5) when available (single-place tooltips). */
  rating?: number;
  /** True when this pin is the primary selection (recommendation / single / compare winner). */
  isSelected: boolean;
};

const ANCHOR_PIN_ID = "__vibegap_anchor__";

export function recommendationMapPins(
  rankedCandidates: RankedCandidate[],
  selectedPlaceId: string | null,
  geography: RecommendationGeography | null | undefined,
): DecisionMapPin[] {
  const pins: DecisionMapPin[] = [];
  rankedCandidates.forEach((c, idx) => {
    if (!placeHasCoordinates(c.place)) return;
    const rank = idx + 1;
    const distanceFromAnchorLine =
      typeof c.distanceFromAnchorMeters === "number"
        ? recommendationDistanceLabel(c.distanceFromAnchorMeters, geography) ?? undefined
        : undefined;
    pins.push({
      id: c.place.id,
      kind: "candidate",
      rank,
      name: c.place.name,
      lat: c.place.latitude!,
      lng: c.place.longitude!,
      decisionLabel: c.decision.label,
      fitScore: c.fitScore,
      distanceFromAnchorLine,
      addressLine: c.place.address,
      mainRisk: c.mainRisk,
      isSelected: selectedPlaceId === c.place.id,
    });
  });

  if (
    geography?.nearAnchorDisplayName &&
    typeof geography.anchorLatitude === "number" &&
    typeof geography.anchorLongitude === "number" &&
    Number.isFinite(geography.anchorLatitude) &&
    Number.isFinite(geography.anchorLongitude)
  ) {
    pins.push({
      id: ANCHOR_PIN_ID,
      kind: "anchor",
      rank: null,
      name: geography.nearAnchorDisplayName,
      lat: geography.anchorLatitude,
      lng: geography.anchorLongitude,
      isSelected: false,
    });
  }

  return pins;
}

export function recommendationMapCanRender(
  rankedCandidates: RankedCandidate[],
  geography: RecommendationGeography | null | undefined,
): boolean {
  if (rankedCandidates.some((c) => placeHasCoordinates(c.place))) return true;
  if (
    geography?.nearAnchorDisplayName &&
    typeof geography.anchorLatitude === "number" &&
    typeof geography.anchorLongitude === "number" &&
    Number.isFinite(geography.anchorLatitude) &&
    Number.isFinite(geography.anchorLongitude)
  ) {
    return true;
  }
  return false;
}

export function singlePlaceMapPins(
  place: PlaceData,
  geography: SinglePlaceGeography | null | undefined,
  decisionLabel: string,
): DecisionMapPin[] {
  if (!placeHasCoordinates(place)) return [];
  let distanceFromAnchorLine: string | undefined;
  if (geography && typeof geography.distanceFromAnchorMeters === "number") {
    if (geography.nearAnchorDisplayName?.trim()) {
      distanceFromAnchorLine = `${formatDistance(geography.distanceFromAnchorMeters)} from ${geography.nearAnchorDisplayName.trim()}`;
    } else if (geography.searchAreaLabel?.trim()) {
      distanceFromAnchorLine = `Approx. ${formatDistance(geography.distanceFromAnchorMeters)} from search center (${geography.searchAreaLabel.trim()})`;
    }
  }
  const pins: DecisionMapPin[] = [
    {
      id: place.id,
      kind: "candidate",
      rank: null,
      name: place.name,
      lat: place.latitude!,
      lng: place.longitude!,
      decisionLabel,
      rating: place.averageRating,
      distanceFromAnchorLine,
      isSelected: true,
    },
  ];
  if (
    geography?.nearAnchorDisplayName &&
    typeof geography.anchorLatitude === "number" &&
    typeof geography.anchorLongitude === "number" &&
    Number.isFinite(geography.anchorLatitude) &&
    Number.isFinite(geography.anchorLongitude)
  ) {
    pins.push({
      id: ANCHOR_PIN_ID,
      kind: "anchor",
      rank: null,
      name: geography.nearAnchorDisplayName,
      lat: geography.anchorLatitude,
      lng: geography.anchorLongitude,
      isSelected: false,
    });
  }
  return pins;
}

export function compareMapPins(
  sideA: ComparePlaceSide,
  sideB: ComparePlaceSide,
  winnerPlaceId: string,
): DecisionMapPin[] {
  const pins: DecisionMapPin[] = [];
  if (placeHasCoordinates(sideA.place)) {
    pins.push({
      id: sideA.place.id,
      kind: "compareA",
      rank: null,
      name: sideA.place.name,
      lat: sideA.place.latitude!,
      lng: sideA.place.longitude!,
      decisionLabel: sideA.decision.label,
      fitScore: sideA.fitScore,
      addressLine: sideA.place.address,
      mainRisk: sideA.mainRisk,
      isSelected: winnerPlaceId === sideA.place.id,
    });
  }
  if (placeHasCoordinates(sideB.place)) {
    pins.push({
      id: sideB.place.id,
      kind: "compareB",
      rank: null,
      name: sideB.place.name,
      lat: sideB.place.latitude!,
      lng: sideB.place.longitude!,
      decisionLabel: sideB.decision.label,
      fitScore: sideB.fitScore,
      addressLine: sideB.place.address,
      mainRisk: sideB.mainRisk,
      isSelected: winnerPlaceId === sideB.place.id,
    });
  }
  return pins;
}

export function isAnchorPinId(id: string): boolean {
  return id === ANCHOR_PIN_ID;
}
