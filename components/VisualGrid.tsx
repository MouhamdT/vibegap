import type { SocialPost } from "@/lib/types/vibecheck";

export type VisualGridProps = {
  posts: SocialPost[];
};

const sourceLabel: Record<SocialPost["source"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube Shorts",
};

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function VisualGrid({ posts }: VisualGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => {
        const h1 = hashHue(post.id);
        const h2 = (h1 + 48) % 360;
        const bg = `linear-gradient(145deg, hsl(${h1} 38% 88%), hsl(${h2} 32% 82%))`;

        return (
          <figure
            key={post.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm"
          >
            <div className="relative aspect-[4/5] w-full" style={{ background: bg }} aria-hidden>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/35 to-transparent p-3">
                <span className="text-xs font-medium uppercase tracking-wide text-white/95">
                  {sourceLabel[post.source]}
                </span>
              </div>
            </div>
            <figcaption className="space-y-3 p-4">
              <blockquote className="text-sm leading-relaxed text-stone-800">“{post.caption}”</blockquote>
              <div className="flex flex-wrap gap-1.5">
                {post.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {post.vibeTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-stone-400">
                <time dateTime={post.postedAt}>{new Date(post.postedAt).toLocaleDateString()}</time>
                <span className="tabular-nums">Hype score {post.hypeScore}</span>
              </div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
