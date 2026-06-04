import type { SocialPost } from "@/lib/types/vibecheck";

export type VisualGridProps = {
  posts: SocialPost[];
};

/** Deterministic visit framing on cards used for scoring (not live feeds). */
export function VisualGrid({ posts }: VisualGridProps) {
  if (posts.length === 0) {
    return (
      <p className="text-[12px] leading-relaxed text-stone-600">
        Representative review snippets are not available for this venue. VibeGap is using available review themes instead.
        Use <span className="font-medium text-stone-800">Review evidence</span> above for verbatim lines when Google
        returns them; scoring still blends those themes with the short captions shown on the cards.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {posts.map((post) => (
        <li
          key={post.id}
          className="rounded-md border border-stone-200/80 bg-stone-50/60 px-3 py-2 text-[12px] leading-relaxed text-stone-700"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Card caption (scoring)</p>
          <p className="mt-1">&ldquo;{post.caption}&rdquo;</p>
          {post.vibeTags.length > 0 ? (
            <p className="mt-1.5 text-[10px] text-stone-500">Themes: {post.vibeTags.slice(0, 6).join(" · ")}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
