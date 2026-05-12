import type { SocialPost } from "@/lib/types/vibecheck";

export type VisualGridProps = {
  posts: SocialPost[];
};

const platformLabel: Record<SocialPost["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
  other: "Social",
};

export function VisualGrid({ posts }: VisualGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {posts.map((post) => (
        <figure
          key={post.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-b from-stone-50 to-white shadow-sm"
        >
          <div className="aspect-[4/5] bg-stone-200/60" aria-hidden />
          <figcaption className="space-y-2 p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
              {platformLabel[post.platform]}
            </span>
            <blockquote className="text-sm leading-relaxed text-stone-700 line-clamp-4">
              “{post.excerpt}”
            </blockquote>
            <span className="text-xs tabular-nums text-stone-400">Hype {post.hypeScore}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
