import { VibeGapApp } from "@/components/VibeGapApp";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fafaf9]">
      <header className="border-b border-stone-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-tight text-stone-900">VibeGap</span>
          <span className="text-xs font-medium uppercase tracking-wider text-stone-400">Mock MVP · v2.1</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-24 pt-16 sm:pt-24">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
            Social hype · Review truth
          </p>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl sm:leading-[1.1]">
            Check the real vibe before you go.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-stone-600 sm:text-xl">
            VibeGap contrasts short-form storytelling with aggregated review themes — a quick sanity check
            before you commit time or money. Each report separates{" "}
            <span className="font-medium text-stone-800">social vs. review mismatch</span> from{" "}
            <span className="font-medium text-stone-800">fit for the goal in your search</span>.
          </p>
        </div>

        <div className="mx-auto mt-14 w-full max-w-5xl">
          <VibeGapApp />
        </div>

        <p className="mx-auto mt-20 max-w-lg text-center text-sm text-stone-500">
          All venues, posts, and scores are illustrative. There is no live data, authentication, or database in
          this build.
        </p>
      </main>

      <footer className="border-t border-stone-200/60 py-8 text-center text-xs text-stone-400">
        Illustrative dataset only · No live TikTok, Instagram, or Google Places data
      </footer>
    </div>
  );
}
