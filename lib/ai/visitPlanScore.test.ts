import { describe, expect, it } from "vitest";
import { buildPlanVerdict, proximityAdjustedFit, proximityFitDelta } from "@/lib/ai/visitPlanScore";
import type { PlaceData, RankedCandidate } from "@/lib/types/vibecheck";

function mkCandidate(input: {
  id: string;
  name: string;
  fitScore: number;
  decisionLabel?: "GO" | "MAYBE" | "SKIP";
  mainRisk?: string;
}): RankedCandidate {
  return {
    place: { id: input.id, name: input.name } as unknown as PlaceData,
    decision: { label: input.decisionLabel ?? "GO", confidence: "Medium" },
    fitScore: input.fitScore,
    oneSentenceReason: "",
    decisionToneLine: "",
    rankReason: "",
    scoreDriver: "",
    mainRisk: input.mainRisk ?? "Signal depth in available reviews",
    bestFor: "",
    avoidIf: "",
    scoreBreakdown: [],
  };
}

describe("proximityFitDelta", () => {
  it("gives a small bonus for close walking distances", () => {
    expect(proximityFitDelta(0, "walking")).toBe(6);
    expect(proximityFitDelta(600, "walking")).toBeGreaterThan(0);
  });

  it("penalizes walking beyond the comfort range, growing with distance", () => {
    const near = proximityFitDelta(1500, "walking");
    const far = proximityFitDelta(3000, "walking");
    expect(near).toBeLessThan(0);
    expect(far).toBeLessThan(near);
  });

  it("barely penalizes car mode at a few kilometers", () => {
    expect(proximityFitDelta(4000, "car")).toBeGreaterThanOrEqual(0);
    expect(proximityFitDelta(6000, "car")).toBeGreaterThanOrEqual(-2);
  });

  it("returns 0 when distance is unknown", () => {
    expect(proximityFitDelta(null, "walking")).toBe(0);
  });
});

describe("proximityAdjustedFit", () => {
  it("stays clamped to 0-100", () => {
    expect(proximityAdjustedFit(98, 0, "walking")).toBeLessThanOrEqual(100);
    expect(proximityAdjustedFit(3, 9000, "walking")).toBeGreaterThanOrEqual(0);
  });

  it("lowers the fit for a long walk", () => {
    expect(proximityAdjustedFit(80, 3500, "walking")).toBeLessThan(80);
  });
});

describe("buildPlanVerdict", () => {
  it("returns GO for two strong close stops", () => {
    const a = mkCandidate({ id: "a", name: "Cafe One", fitScore: 88 });
    const b = mkCandidate({ id: "b", name: "Brunch Two", fitScore: 84 });
    const v = buildPlanVerdict(a, b, 400, "walking");
    expect(v.label).toBe("GO");
    expect(v.score).toBeGreaterThanOrEqual(80);
  });

  it("penalizes a long gap in walking mode more than in car mode", () => {
    const a = mkCandidate({ id: "a", name: "Cafe One", fitScore: 80 });
    const b = mkCandidate({ id: "b", name: "Brunch Two", fitScore: 80 });
    const walk = buildPlanVerdict(a, b, 4500, "walking");
    const car = buildPlanVerdict(a, b, 4500, "car");
    expect(walk.score).toBeLessThan(car.score);
    expect(walk.tradeoffLines.some((l) => /long walk/i.test(l))).toBe(true);
  });

  it("penalizes a shared dominant risk and reports it", () => {
    const a = mkCandidate({ id: "a", name: "Cafe One", fitScore: 82, mainRisk: "Long waits at peak brunch hours" });
    const b = mkCandidate({ id: "b", name: "Brunch Two", fitScore: 82, mainRisk: "Wait lines in reviews" });
    const shared = buildPlanVerdict(a, b, 300, "walking");
    const c = mkCandidate({ id: "c", name: "Quiet Three", fitScore: 82 });
    const mixed = buildPlanVerdict(a, c, 300, "walking");
    expect(shared.score).toBeLessThan(mixed.score);
    expect(shared.tradeoffLines.some((l) => /wait/i.test(l))).toBe(true);
  });

  it("flags the weaker leg when it is not a GO", () => {
    const a = mkCandidate({ id: "a", name: "Cafe One", fitScore: 85 });
    const b = mkCandidate({ id: "b", name: "Risky Two", fitScore: 50, decisionLabel: "MAYBE", mainRisk: "Noise at peaks" });
    const v = buildPlanVerdict(a, b, 300, "walking");
    expect(v.tradeoffLines.some((l) => l.includes("Risky Two"))).toBe(true);
  });
});
