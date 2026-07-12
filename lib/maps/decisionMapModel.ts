import { recommendationDistanceLabel } from "@/lib/geo/recommendationDistanceLabel";
import { formatDistance } from "@/lib/geo/distance";
import type {
  ComparePlaceSide,
  PlaceData,
  RankedCandidate,
  RecommendationGeography,
  SinglePlaceGeography,
  VisitPlanAnchor,
} from "@/lib/types/vibecheck";
import { placeHasCoordinates } from "@/lib/maps/placeCoordinates";

function googlePlaceIdFromPlace(place: PlaceData): string | undefined {
  if (typeof place.googlePlaceId === "string" && place.googlePlaceId.trim()) {
    return place.googlePlaceId.trim();
  }
  if (typeof place.id === "string" && place.id.startsWith("google:")) {
    return place.id.slice("google:".length);
  }
  return undefined;
}

export type DecisionMapPinKind = "candidate" | "anchor" | "compareA" | "compareB";

export type DecisionMapPin = {
  id: string;
  kind: DecisionMapPinKind;
  rank: number | null;
  name: string;
  lat: number;
  lng: number;
  /** Google Place ID when known — used to exclude venues from landmark nearby results. */
  googlePlaceId?: string;
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
  /** V30: curated shortlist label for map popup (recommendation). */
  shortlistRole?: string;
  /** Highlighted pin (selected venue / compare winner / single-place focus). */
  isSelected?: boolean;
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
      googlePlaceId: googlePlaceIdFromPlace(c.place),
      decisionLabel: c.decision.label,
      fitScore: c.fitScore,
      distanceFromAnchorLine,
      addressLine: c.place.address,
      mainRisk: c.mainRisk,
      isSelected: selectedPlaceId === c.place.id,
      shortlistRole: c.shortlistRole,
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
      googlePlaceId: googlePlaceIdFromPlace(place),
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
      googlePlaceId: googlePlaceIdFromPlace(sideA.place),
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
      googlePlaceId: googlePlaceIdFromPlace(sideB.place),
      decisionLabel: sideB.decision.label,
      fitScore: sideB.fitScore,
      addressLine: sideB.place.address,
      mainRisk: sideB.mainRisk,
      isSelected: winnerPlaceId === sideB.place.id,
    });
  }
  return pins;
}

export type VisitPlanMapPick = {
  stopNumber: number;
  candidate: RankedCandidate;
};

/** Pins for plan mode: numbered locked stops plus a quiet anchor pin. */
export function visitPlanMapPins(anchor: VisitPlanAnchor, picks: VisitPlanMapPick[]): DecisionMapPin[] {
  const pins: DecisionMapPin[] = [];

  for (const pick of [...picks].sort((a, b) => a.stopNumber - b.stopNumber)) {
    const c = pick.candidate;
    if (!placeHasCoordinates(c.place)) continue;
    pins.push({
      id: c.place.id,
      kind: "candidate",
      rank: pick.stopNumber,
      name: c.place.name,
      lat: c.place.latitude!,
      lng: c.place.longitude!,
      googlePlaceId: googlePlaceIdFromPlace(c.place),
      decisionLabel: c.decision.label,
      fitScore: c.fitScore,
      addressLine: c.place.address,
      mainRisk: c.mainRisk,
      isSelected: true,
    });
  }

  if (
    typeof anchor.latitude === "number" &&
    typeof anchor.longitude === "number" &&
    Number.isFinite(anchor.latitude) &&
    Number.isFinite(anchor.longitude)
  ) {
    pins.push({
      id: ANCHOR_PIN_ID,
      kind: "anchor",
      rank: null,
      name: anchor.displayName,
      lat: anchor.latitude,
      lng: anchor.longitude,
      isSelected: false,
    });
  }

  return pins;
}

export function isAnchorPinId(id: string): boolean {
  return id === ANCHOR_PIN_ID;
}
