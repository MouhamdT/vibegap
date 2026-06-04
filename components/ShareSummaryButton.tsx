"use client";

import { useState } from "react";
import { copyTextToClipboard } from "@/lib/clipboard/copyText";

type ShareSummaryButtonProps = {
  text: string;
  label?: string;
};

export function ShareSummaryButton({ text, label = "Copy summary" }: ShareSummaryButtonProps) {
  const [status, setStatus] = useState<"idle" | "ok" | "fail">("idle");

  const handle = async () => {
    const ok = await copyTextToClipboard(text);
    setStatus(ok ? "ok" : "fail");
    window.setTimeout(() => setStatus("idle"), 2200);
  };

  return (
    <button
      type="button"
      onClick={() => void handle()}
      className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
    >
      {status === "ok" ? "Copied" : status === "fail" ? "Copy unavailable" : label}
    </button>
  );
}
