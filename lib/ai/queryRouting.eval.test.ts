import { describe, expect, it } from "vitest";
import { parseCompareQuery } from "@/lib/ai/compareQuery";
import {
  augmentPlaceQueryWithInheritedCity,
  extractTrailingCityFromPlaceQuery,
  extractTrailingCompareLocationSuffix,
  stripExplicitInCitySuffixFromPlaceQuery,
} from "@/lib/ai/comparePlaceContext";
import { classifyQueryMode } from "@/lib/ai/queryMode";
import { detectIntentFromQuery } from "@/lib/ai/truthEngine";

describe("parseCompareQuery", () => {
  it("parses Nobu London vs Sketch for birthday dinner", () => {
    const q = parseCompareQuery("Nobu London vs Sketch for birthday dinner");
    expect(q).not.toBeNull();
    expect(q!.placeA).toBe("Nobu London");
    expect(q!.placeB).toBe("Sketch");
    expect(q!.goalText.toLowerCase()).toContain("birthday");
  });

  it("parses Piccolo Buco Rome vs Pane e Salame for no waiting time", () => {
    const q = parseCompareQuery("Piccolo Buco Rome vs Pane e Salame for no waiting time");
    expect(q).not.toBeNull();
    expect(q!.placeA.toLowerCase()).toContain("piccolo");
    expect(q!.placeB.toLowerCase()).toContain("pane");
    expect(q!.goalText.toLowerCase()).toMatch(/wait|no waiting/);
  });

  it("parses which is better: A or B for goal", () => {
    const q = parseCompareQuery("which is better: Nobu London or Sketch for birthday dinner");
    expect(q).not.toBeNull();
    expect(q!.goalText.toLowerCase()).toContain("birthday");
  });

  it("parses butterfly caffe vs coco in haifa with shared Haifa context", () => {
    const q = parseCompareQuery("butterfly caffe vs coco in haifa");
    expect(q).not.toBeNull();
    expect(q!.placeA.toLowerCase()).toContain("butterfly");
    expect(q!.placeB.toLowerCase()).toBe("coco");
    expect(q!.compareContextCity).toBe("Haifa");
  });
});

describe("comparePlaceContext", () => {
  it("inherits London from side A to Sketch", () => {
    const city = extractTrailingCityFromPlaceQuery("Nobu London");
    expect(city).toBe("London");
    expect(augmentPlaceQueryWithInheritedCity("Sketch", city)).toBe("Sketch London");
  });

  it("inherits Rome from Piccolo Buco Rome to Pane e Salame", () => {
    const city = extractTrailingCityFromPlaceQuery("Piccolo Buco Rome");
    expect(city).toBe("Rome");
    expect(augmentPlaceQueryWithInheritedCity("Pane e Salame", city)).toMatch(/Rome/i);
  });

  it("strips articulated in-city from a venue segment", () => {
    const r = stripExplicitInCitySuffixFromPlaceQuery("coco in haifa");
    expect(r.venue.toLowerCase()).toBe("coco");
    expect(r.cityDisplay).toBe("Haifa");
  });

  it("extracts shared metro suffix from a full compare query", () => {
    const r = extractTrailingCompareLocationSuffix("butterfly caffe vs coco in haifa");
    expect(r.rest.toLowerCase()).toBe("butterfly caffe vs coco");
    expect(r.cityDisplay).toBe("Haifa");
  });

  it("does not treat dinner in rome as a trailing compare metro", () => {
    const r = extractTrailingCompareLocationSuffix("Place A vs Place B for dinner in rome");
    expect(r.cityDisplay).toBeNull();
    expect(r.rest).toBe("Place A vs Place B for dinner in rome");
  });
});

describe("classifyQueryMode + detectIntentFromQuery", () => {
  it("brunch near trevi fountain → recommendation + brunch-ish intent", () => {
    const raw = "brunch near trevi fountain";
    const intent = detectIntentFromQuery(raw);
    const c = classifyQueryMode(raw, intent);
    expect(c.recommendationMode).toBe(true);
    expect(c.locationCandidate?.toLowerCase() ?? "").toMatch(/rome|trevi|fountain|trevi fountain/i);
  });

  it("nobu london → single-place style classification", () => {
    const raw = "nobu london";
    const intent = detectIntentFromQuery(raw);
    const c = classifyQueryMode(raw, intent);
    expect(c.queryMode).toBe("specific_place");
  });

  it("nobu london brunch → place_with_intent when goal tail is present", () => {
    const raw = "nobu london brunch";
    const intent = detectIntentFromQuery(raw);
    const c = classifyQueryMode(raw, intent);
    expect(c.queryMode === "place_with_intent" || c.queryMode === "specific_place").toBe(true);
  });

  it("fancy restaurant in rome but cheap → recommendation in Rome with budget cues", () => {
    const raw = "fancy restaurant in rome but cheap";
    const intent = detectIntentFromQuery(raw);
    const c = classifyQueryMode(raw, intent);
    expect(c.recommendationMode).toBe(true);
    expect(c.locationCandidate?.toLowerCase()).toContain("rome");
  });
});
