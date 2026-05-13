import type { RankedCandidate } from "@/lib/types/vibecheck";

type CandidateComparisonTableProps = {
  candidates: RankedCandidate[];
};

export function CandidateComparisonTable({ candidates }: CandidateComparisonTableProps) {
  if (candidates.length === 0) return null;

  return (
    <section className="space-y-2 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Candidate comparison</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="text-stone-500">
            <tr className="border-b border-stone-200">
              <th className="py-2 pr-3 font-medium">Rank</th>
              <th className="py-2 pr-3 font-medium">Place</th>
              <th className="py-2 pr-3 font-medium">Decision</th>
              <th className="py-2 pr-3 font-medium">Fit</th>
              <th className="py-2 pr-3 font-medium">Signal confidence</th>
              <th className="py-2 pr-3 font-medium">Score driver</th>
              <th className="py-2 pr-3 font-medium">Main risk</th>
              <th className="py-2 font-medium">Best for</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate, idx) => (
              <tr key={candidate.place.id} className="border-b border-stone-100 text-stone-700 last:border-0">
                <td className="py-2 pr-3 font-medium">{idx + 1}</td>
                <td className="py-2 pr-3">{candidate.place.name}</td>
                <td className="py-2 pr-3">{candidate.decision.label}</td>
                <td className="py-2 pr-3 font-medium text-stone-900">{candidate.fitScore}</td>
                <td className="py-2 pr-3">{candidate.decision.confidence}</td>
                <td className="py-2 pr-3">{candidate.scoreDriver}</td>
                <td className="py-2 pr-3">{candidate.mainRisk}</td>
                <td className="py-2">{candidate.bestFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
