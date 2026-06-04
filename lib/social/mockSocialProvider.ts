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
 * Which deterministic card energy level is used — must stay in sync with `getMockSocialForPlace`
 * so scoring can reference the same card text logic as the UI.
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
 * Deterministic lines on each card for scoring (not live feeds or social platforms).
 */
export function getMockSocialForPlace(place: PlaceData): SocialPost[] {
  const seed = djb2(`${place.id}|${place.name}|${place.category}|${place.mockGoalIntentKind ?? ""}`);
  const mode = getMockSocialContentMode(place);
  const short = place.name;
  const slug = short.replace(/[^a-zA-Z0-9]/g, "") || "Spot";

  const calmCaptions = [
    `${short} reads as a calmer table experience with softer noise and easier pacing in this cue set.`,
    `The framing for this ${place.category.toLowerCase()} leans study-friendly: quieter room, lighter crowds, and patient service.`,
    `Date-night style cues here: softer lighting, hushed tables, and a slower service rhythm in the lines on each card.`,
    `Value-forward lines: generous portions, modest tabs, and a relaxed “no rush” checkout in this set.`,
    `Work-friendly phrasing on each card: outlets mentioned, low chatter, and seating that tolerates a laptop block.`,
    `Brunch-style lines: lighter waits in text, patio-forward language, and a sunny-room storyline.`,
  ];

  const livelyCaptions = [
    `${short} reads as a higher-energy room in this cue set — weekend-forward, louder tables, and a social floor.`,
    `The lines on each card lean crowd-forward: packed peak hours, music-forward language, and a busier service path.`,
    `Wait- and line-aware phrasing appears in these cues alongside “worth it” energy — plan extra arrival time.`,
    `Night-out style cues: louder volume, tighter tables, and a scene-first storyline in the lines on each card.`,
    `Brunch-forward cues emphasize buzz, patio density, and a busier room than a quiet weekday slot.`,
    `Captions highlight a popular room: turnover, reservations, and peak-hour volume show up in the text.`,
  ];

  const captions = mode === "lively" ? livelyCaptions : calmCaptions;

  const calmHashtagSets: string[][] = [
    ["#localspot", "#calmroom", "#easyvisit", `#${slug}`],
    ["#value", "#budgetfriendly", "#relaxed", "#weekendvibes"],
    ["#datenight", "#quiettable", "#lownoise", "#cityguide"],
    ["#study", "#laptopfriendly", "#coffeeshop", "#focusblock"],
    ["#brunch", "#patio", "#offpeak", "#morningroutine"],
  ];

  const livelyHashtagSets: string[][] = [
    ["#nightout", "#weekendvibes", "#busyroom", `#${slug}`],
    ["#brunchscene", "#lines", "#worthit", "#citylife"],
    ["#loudroom", "#groupdinner", "#social", "#energy"],
    ["#datenight", "#vibes", "#busy", "#hotspot"],
    ["#latenight", "#downtown", "#weekend", "#scene"],
  ];

  const calmVibeTagSets: string[][] = [
    ["calmer pacing", "locals regulars", "off peak friendly", "quieter corners"],
    ["quiet", "study spot", "laptop friendly", "calm"],
    ["romantic", "intimate", "low noise", "cozy"],
    ["value", "budget", "generous portions", "easy tab"],
    ["lighter waits", "walk-in friendly", "chill", "patient service"],
  ];

  const livelyVibeTagSets: string[][] = [
    ["high energy", "crowded", "weekend scene", "loud room"],
    ["party tables", "lines", "busy floor", "social"],
    ["late hours", "packed", "vibrant", "night-out"],
    ["buzzy brunch", "busy patio", "weekend crowd", "high tempo"],
    ["not quiet", "turnover", "reservations tight", "peak hour"],
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
