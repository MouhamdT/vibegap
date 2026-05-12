import type { SocialPost } from "@/lib/types/vibecheck";

/**
 * Mock social clips about a place — no network calls.
 */
export function getMockSocialForPlace(placeId: string): SocialPost[] {
  void placeId;
  return [
    {
      id: "social-1",
      platform: "tiktok",
      excerpt:
        "Hidden gem vibes — empty on a Tuesday, the pasta is unreal, nobody knows about this spot yet.",
      hypeScore: 88,
      postedAt: "2026-04-02T14:00:00.000Z",
    },
    {
      id: "social-2",
      platform: "instagram",
      excerpt:
        "Date-night perfection. Candlelight, hushed room, feels like a secret in the city.",
      hypeScore: 82,
      postedAt: "2026-04-18T09:30:00.000Z",
    },
    {
      id: "social-3",
      platform: "x",
      excerpt:
        "Finally found a quiet brunch place. Zero wait, staff remembered our names.",
      hypeScore: 76,
      postedAt: "2026-05-01T11:15:00.000Z",
    },
  ];
}
