import type { PlaceData, SocialPost, SocialSource } from "@/lib/types/vibecheck";

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length] as T;
}

const SOURCES: SocialSource[] = ["tiktok", "instagram", "youtube", "tiktok", "instagram"];

export type MockSocialContentMode = "calm" | "lively";

/**
 * Which sample framing pack is used — must stay in sync with `getMockSocialForPlace`
 * so scoring can reference the same “visible cards” logic as the UI.
 */
export function getMockSocialContentMode(place: PlaceData): MockSocialContentMode {
  const baseSeed = djb2(`${place.id}|${place.name}|${place.category}`);
  if (place.mockGoalIntentKind === "party_nightlife") {
    return baseSeed % 4 === 0 ? "calm" : "lively";
  }
  if (place.mockGoalIntentKind === "study_work" || place.mockGoalIntentKind === "quiet_calm") {
    return baseSeed % 4 === 0 ? "lively" : "calm";
  }
  return baseSeed % 5 === 0 ? "lively" : "calm";
}

/**
 * Deterministic sample framing cards for a place (illustrative vignettes — not live feeds).
 */
export function getMockSocialForPlace(place: PlaceData): SocialPost[] {
  const seed = djb2(`${place.id}|${place.name}|${place.category}|${place.mockGoalIntentKind ?? ""}`);
  const mode = getMockSocialContentMode(place);
  const short = place.name;
  const slug = short.replace(/[^a-zA-Z0-9]/g, "") || "Spot";

  const calmCaptions = [
    `${short} is the quiet hidden gem nobody talks about yet — empty tables, unreal vibes.`,
    `POV: you found a study-friendly ${place.category.toLowerCase()} with zero lines and the kindest staff.`,
    `Date night at ${short}: candlelight, hushed room, feels like a secret in the city.`,
    `This spot is stupid cheap for what you get — huge portions, cash-only energy, no influencer tax.`,
    `Laptop friendly AF — outlets everywhere, soft jazz, and nobody side-eyes your latte flight.`,
    `Brunch at ${short} hits different: zero wait, sunny patio, chef came out to say hi.`,
  ];

  const livelyCaptions = [
    `${short} on a Friday is pure chaos — DJ energy, packed room, and the crowd is the main character.`,
    `If you expect hushed reading-room silence, this is not it — loud, social, and built for groups.`,
    `We waited 40 minutes and still called it worth it: ${short} when it turns into a party.`,
    `The hype is real but so is the line — go early or commit to the scene.`,
    `Weekend brunch at ${short} is a scene: music up, tables close, expect a buzzy room.`,
    `Not a secret anymore: ${short} draws a heavy weekend crowd and leans into it.`,
  ];

  const captions = mode === "lively" ? livelyCaptions : calmCaptions;

  const calmHashtagSets: string[][] = [
    ["#hiddengem", "#localspot", "#underrated", `#${slug}`],
    ["#cheapEats", "#budgetfood", "#steal", "#weekendvibes"],
    ["#datenight", "#aesthetic", "#quietluxury", "#cityguide"],
    ["#studygram", "#laptoplife", "#coffeeshopcorners", "#WFH"],
    ["#brunch", "#patio", "#nocrowd", "#morningroutine"],
  ];

  const livelyHashtagSets: string[][] = [
    ["#nightout", "#weekendvibes", "#crowd", `#${slug}`],
    ["#brunchscene", "#linesfordays", "#worthit", "#citylife"],
    ["#loudfun", "#groupdinner", "#party", "#energy"],
    ["#datenight", "#vibes", "#busy", "#hotspot"],
    ["#dj", "#latenight", "#downtown", "#scene"],
  ];

  const calmVibeTagSets: string[][] = [
    ["hidden gem", "locals only", "underrated", "off the radar"],
    ["quiet", "study spot", "laptop friendly", "calm"],
    ["romantic", "intimate", "low noise", "cozy"],
    ["cheap", "budget", "huge portions", "cash vibes"],
    ["no wait", "empty", "walk-in friendly", "chill"],
  ];

  const livelyVibeTagSets: string[][] = [
    ["high energy", "crowded", "weekend scene", "loud room"],
    ["party tables", "lines", "worth the wait", "social"],
    ["DJ nights", "packed", "vibrant", "night-out"],
    ["buzzy brunch", "busy patio", "scene-y", "weekend crowd"],
    ["not quiet", "turnover", "reservations tight", "high tempo"],
  ];

  const hashtagSets = mode === "lively" ? livelyHashtagSets : calmHashtagSets;
  const vibeTagSets = mode === "lively" ? livelyVibeTagSets : calmVibeTagSets;

  const posts: SocialPost[] = [];
  for (let i = 0; i < 3; i++) {
    const s = seed + i * 997;
    posts.push({
      id: `social-${place.id}-${i}`,
      source: pick(SOURCES, s),
      caption: pick(captions, s),
      hashtags: [...pick(hashtagSets, s >> 2)],
      vibeTags: [...pick(vibeTagSets, s >> 4)],
      thumbnailUrl: null,
      postedAt: new Date(Date.UTC(2026, 3 + (i % 2), 2 + i, 14 + i, 30)).toISOString(),
      hypeScore: 68 + (s % 28),
    });
  }

  return posts;
}
