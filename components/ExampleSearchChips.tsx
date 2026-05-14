"use client";

export const EXAMPLE_SEARCH_QUERIES: readonly string[] = [
  "quiet place to study in Tel Aviv",
  "cheap birthday dinner London",
  "Piccolo Buco Rome no waiting time",
] as const;

export type ExampleSearchChipsProps = {
  disabled?: boolean;
  onSelect: (query: string) => void | Promise<void>;
};

export function ExampleSearchChips({ disabled = false, onSelect }: ExampleSearchChipsProps) {
  return (
    <div className="w-full max-w-xl sm:max-w-2xl">
      <p className="text-center text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400 sm:text-left">
        Try one
      </p>
      <ul className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start" aria-label="Example searches">
        {EXAMPLE_SEARCH_QUERIES.map((q) => (
          <li key={q}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void onSelect(q)}
              className="max-w-full rounded-full border border-stone-200/70 bg-stone-50/80 px-2.5 py-1 text-left text-[11px] font-medium leading-snug text-stone-600 transition hover:border-stone-300 hover:bg-stone-100/90 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
