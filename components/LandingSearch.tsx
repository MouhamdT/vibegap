"use client";

import { useCallback, useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { VibeReport } from "@/components/VibeReport";
import type { VibeReport as VibeReportModel } from "@/lib/types/vibecheck";

export function LandingSearch() {
  const [report, setReport] = useState<VibeReportModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vibecheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        setError("Something went wrong. Try again.");
        return;
      }
      const data: unknown = await res.json();
      if (
        data &&
        typeof data === "object" &&
        "report" in data &&
        data.report !== null &&
        typeof data.report === "object"
      ) {
        setReport(data.report as VibeReportModel);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <SearchBar onSearch={onSearch} disabled={loading} />
      {error ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-center text-sm text-stone-500">Preparing a mock report…</p>
      ) : null}
      <VibeReport report={report} />
    </div>
  );
}
