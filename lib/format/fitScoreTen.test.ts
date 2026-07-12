import { describe, expect, it } from "vitest";
import { formatFitScoreTen } from "@/lib/format/fitScoreTen";

describe("formatFitScoreTen", () => {
  it("maps 0-100 internal scores to one-decimal x/10", () => {
    expect(formatFitScoreTen(98)).toBe("9.8/10");
    expect(formatFitScoreTen(72)).toBe("7.2/10");
    expect(formatFitScoreTen(0)).toBe("0.0/10");
    expect(formatFitScoreTen(100)).toBe("10.0/10");
  });

  it("clamps out-of-range values", () => {
    expect(formatFitScoreTen(120)).toBe("10.0/10");
    expect(formatFitScoreTen(-5)).toBe("0.0/10");
  });

  it("returns empty for non-finite input", () => {
    expect(formatFitScoreTen(Number.NaN)).toBe("");
    expect(formatFitScoreTen(Number.POSITIVE_INFINITY)).toBe("");
  });
});
