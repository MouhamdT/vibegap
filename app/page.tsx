import { LandingSearch } from "@/components/LandingSearch";
import { ProcessingSteps } from "@/components/ProcessingSteps";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fafaf9]">
      <header className="border-b border-stone-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-tight text-stone-900">VibeGap</span>
          <span className="text-xs font-medium uppercase tracking-wider text-stone-400">v0</span>
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
            VibeGap compares what social media promises with what real-world reviews actually
            report — so you can spot the gap before you book the table or buy the ticket.
          </p>
        </div>

        <div className="mx-auto mt-14 flex w-full max-w-5xl flex-col items-center">
          <LandingSearch />
        </div>

        <section className="mx-auto mt-24 w-full max-w-5xl">
          <h2 className="text-center text-sm font-medium uppercase tracking-wider text-stone-500">
            How it will work
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-stone-600">
            Placeholder pipeline — each step will connect to real data in a future release.
          </p>
          <div className="mt-10">
            <ProcessingSteps activeStepId="4" />
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200/60 py-8 text-center text-xs text-stone-400">
        Mock data only · No TikTok scraping or Google Places yet
      </footer>
    </div>
  );
}
