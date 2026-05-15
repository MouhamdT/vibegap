import { VibeGapApp } from "@/components/VibeGapApp";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f6f4] text-stone-950">
      <header className="border-b border-stone-200/50 bg-[#faf9f7]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:h-14 sm:px-6">
          <span className="text-sm font-semibold tracking-tight">VibeGap</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 sm:text-[11px]">
            Decision analytics MVP
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-9">
        <div className="mx-auto w-full max-w-6xl">
          <VibeGapApp />
        </div>
      </main>

      <footer className="border-t border-stone-200/50 bg-[#faf9f7]/80 py-5 text-center">
        <p className="mx-auto max-w-xl px-4 text-[11px] leading-relaxed text-stone-500 sm:text-xs">
          Uses Google Places and available review signals. Social comparison is illustrative.
        </p>
      </footer>
    </div>
  );
}
