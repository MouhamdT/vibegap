"use client";

import { useState } from "react";

export type SearchBarProps = {
  placeholder?: string;
  /** Called with the trimmed query on submit — wire to `/api/vibecheck` in a later version. */
  onSearch?: (query: string) => void | Promise<void>;
  disabled?: boolean;
};

export function SearchBar({
  placeholder = "Search a restaurant, café, hotel…",
  onSearch,
  disabled = false,
}: SearchBarProps) {
  const [value, setValue] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    if (!q || disabled) return;
    await onSearch?.(q);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl"
      role="search"
      aria-label="Search for a place"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2">
        <label className="sr-only" htmlFor="vibegap-search">
          Place name or address
        </label>
        <input
          id="vibegap-search"
          name="query"
          type="search"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-14 flex-1 rounded-2xl border border-stone-200/80 bg-white px-5 py-3.5 text-base text-stone-900 shadow-sm outline-none ring-stone-900/5 transition placeholder:text-stone-400 focus:border-stone-300 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="inline-flex min-h-14 shrink-0 items-center justify-center rounded-2xl bg-stone-900 px-8 text-base font-medium text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 sm:px-10"
        >
          Check vibe
        </button>
      </div>
    </form>
  );
}
