"use client";

import { useState } from "react";

export type SearchBarProps = {
  placeholder?: string;
  /** Called with the trimmed query on submit (parent typically POSTs to `/api/vibecheck`). */
  onSearch?: (query: string) => void | Promise<void>;
  /** Fires when the user submits with an empty or whitespace-only query. */
  onEmptySubmit?: () => void;
  disabled?: boolean;
  /** When set with `onValueChange`, the input is controlled by the parent (e.g. example chips). */
  value?: string;
  onValueChange?: (value: string) => void;
  submitLabel?: string;
  /** Hero landing vs compact toolbar after results. */
  layout?: "hero" | "compact";
  /** When true, submit button shows `busyLabel` and stays disabled via `disabled`. */
  busy?: boolean;
  busyLabel?: string;
};

export function SearchBar({
  placeholder = "Search a restaurant, café, hotel, or venue…",
  onSearch,
  onEmptySubmit,
  disabled = false,
  value: controlledValue,
  onValueChange,
  submitLabel = "Find matches",
  layout = "hero",
  busy = false,
  busyLabel = "Analyzing…",
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  function setValue(next: string) {
    if (isControlled) {
      onValueChange?.(next);
    } else {
      setInternalValue(next);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return;
    const q = value.trim();
    if (!q) {
      onEmptySubmit?.();
      return;
    }
    await onSearch?.(q);
  }

  const isCompact = layout === "compact";
  const buttonLabel = busy ? busyLabel : submitLabel;

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isCompact
          ? "w-full max-w-[900px]"
          : "w-full max-w-xl sm:max-w-2xl"
      }
      role="search"
      aria-label="Search for a place"
    >
      <div
        className={
          isCompact
            ? "flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2.5"
            : "flex flex-col gap-2.5 sm:flex-row sm:items-stretch sm:gap-2"
        }
      >
        <label className="sr-only" htmlFor="vibegap-search">
          Place name or address
        </label>
        <input
          id="vibegap-search"
          name="query"
          type="search"
          autoComplete="off"
          dir="auto"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={
            isCompact
              ? "min-h-12 min-w-0 w-full flex-1 rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-[15px] text-stone-950 shadow-none outline-none ring-stone-900/[0.03] transition placeholder:text-stone-400 focus:border-stone-300 focus:ring-[3px] focus:ring-stone-900/[0.06] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[3.25rem] sm:min-w-[min(100%,28rem)] sm:flex-1 sm:px-5 sm:text-base"
              : "min-h-14 min-w-0 w-full flex-1 rounded-xl border border-stone-200/80 bg-white px-4 py-3.5 text-base text-stone-950 shadow-none outline-none ring-stone-900/[0.03] transition placeholder:text-stone-400 focus:border-stone-300 focus:ring-[3px] focus:ring-stone-900/[0.06] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[3.5rem] sm:px-6 sm:text-lg"
          }
        />
        <button
          type="submit"
          disabled={disabled}
          className={
            isCompact
              ? "inline-flex min-h-12 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-stone-950 px-5 text-sm font-medium text-white transition hover:bg-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300 sm:min-h-[3.25rem] sm:w-auto sm:min-w-[148px] sm:max-w-[200px] sm:px-6 sm:text-[15px]"
              : "inline-flex min-h-14 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-stone-950 px-7 text-sm font-medium text-white transition hover:bg-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto sm:min-h-[3.5rem] sm:min-w-[148px] sm:px-10 sm:text-base"
          }
        >
          {buttonLabel}
        </button>
      </div>
    </form>
  );
}
