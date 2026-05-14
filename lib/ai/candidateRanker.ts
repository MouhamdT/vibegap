import type { DetectedIntent, PlaceData, RankedCandidate, UserIntentKind } from "@/lib/types/vibecheck";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function isStudyPlaceType(place: PlaceData): boolean {
  const text = `${place.category} ${place.name}`.toLowerCase();
  return /\blibrary|bookstore|book shop|bookshop|study|cowork|co-working|workspace|reading room|book cafe\b/.test(text);
}

function reviewBlob(place: PlaceData): string {
  return [
    ...place.complaints,
    ...place.positives,
    place.recentReviewSummary,
    ...place.reviewThemes.map((t) => t.label),
  ]
    .join(" ")
    .toLowerCase();
}

function baseScore(place: PlaceData): number {
  return clamp(Math.round(place.averageRating * 14 + Math.min(place.reviewCount / 50, 18)), 0, 100);
}

function riskFromBlob(blob: string, re: RegExp): boolean {
  return re.test(blob);
}

type CandidateSignals = {
  quiet?: boolean;
  noisy?: boolean;
  value?: boolean;
  pricey?: boolean;
  cozy?: boolean;
  rushed?: boolean;
  lively?: boolean;
  dead?: boolean;
  waitHeavy?: boolean;
  familyFriendly?: boolean;
  adult?: boolean;
  upscale?: boolean;
  valueComplaints?: boolean;
  veganFit?: boolean;
  veganLimited?: boolean;
};

type BreakdownRow = {
  label: string;
  score: number;
  explanation: string;
};

function hasVeganGoal(intent: DetectedIntent): boolean {
  return intent.matchedSignals.some((s) => /\bvegan|vegetarian|plant[- ]based\b/i.test(s));
}

function rankForIntent(place: PlaceData, intent: DetectedIntent): {
  fitScore: number;
  signals: CandidateSignals;
  mainRisk: string;
  bestFor: string;
  avoidIf: string;
} {
  const intentKind = intent.kind;
  const blob = reviewBlob(place);
  let score = baseScore(place);
  const signals: CandidateSignals = {};
  let mainRisk = "Signal depth in available reviews";
  let bestFor = "Flexible plans with time to validate on site";
  let avoidIf = "Strict expectations without checking fresh reviews";

  const veganGoal = hasVeganGoal(intent);

  if (veganGoal) {
    signals.veganFit = riskFromBlob(blob, /\bvegan|vegetarian|plant[- ]based|tofu|options|meatless\b/i);
    signals.veganLimited = riskFromBlob(blob, /\blimited|few options|not much for|afterthought\b/i);
    if (signals.veganFit) score += 16;
    if (signals.veganLimited) score -= 20;
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|queue|reservation\b/i);
    if (signals.waitHeavy) score -= 8;
    mainRisk = signals.veganLimited
      ? "Menu confidence — limited vegan depth in review themes"
      : signals.waitHeavy
        ? "Wait timing may compress ordering for dietary checks"
        : "Execution consistency on busy services";
    bestFor = "Plant-forward dining when you can confirm the menu";
    avoidIf = "Need a fully vegan kitchen without asking service";
  } else if (intentKind === "study_work" || intentKind === "quiet_calm") {
    const studyTypeBoost = isStudyPlaceType(place);
    signals.quiet = riskFromBlob(blob, /\bquiet|calm|study|laptop|wifi|wi-fi|outlet|bookshop|workspace\b/i);
    signals.noisy = riskFromBlob(blob, /\bloud|noise|crowd|packed|wait|line|busy|queue\b/i);
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|queue|reservation\b/i);
    if (studyTypeBoost) score += 18;
    if (signals.quiet) score += 16;
    if (signals.noisy) score -= 24;
    if (signals.waitHeavy) score -= 8;
    mainRisk = signals.noisy ? "Noise and crowding at peak hours" : signals.waitHeavy ? "Peak-hour waits" : "Seating and outlet availability";
    bestFor = "Focused work blocks with some tolerance for bustle";
    avoidIf = "Need guaranteed silence without timing around peaks";
  } else if (intentKind === "budget_eats" || intentKind === "budget_celebration") {
    signals.value = riskFromBlob(blob, /\bvalue|affordable|good price|worth\b/i);
    signals.pricey = riskFromBlob(blob, /\boverpriced|expensive|pricey|not worth\b/i) || place.priceLevel >= 3;
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|queue|reservation\b/i);
    if (signals.value) score += 14;
    if (signals.pricey) score -= 26;
    if (signals.waitHeavy) score -= 8;
    mainRisk = signals.pricey ? "Price mismatch vs. expectations" : signals.waitHeavy ? "Reservation or wait timing" : "Group timing on celebration nights";
    bestFor = "Budget-conscious meals with flexible arrival";
    avoidIf = "Strict per-person spend caps with zero buffer";
  } else if (intentKind === "date_night") {
    signals.cozy = riskFromBlob(blob, /\bcozy|romantic|ambience|atmosphere|design|service\b/i);
    signals.rushed = riskFromBlob(blob, /\bloud|crowd|wait|line|rushed|slow\b/i);
    if (signals.cozy) score += 14;
    if (signals.rushed) score -= 20;
    mainRisk = signals.rushed ? "Atmosphere mismatch under time pressure" : "Reservation timing";
    bestFor = "Date-style ambience with booking runway";
    avoidIf = "Low-noise, tightly timed evenings";
  } else if (intentKind === "party_nightlife") {
    signals.lively = riskFromBlob(blob, /\bparty|music|dj|crowd|lively|night\b/i);
    signals.dead = riskFromBlob(blob, /\bquiet|empty|dead|closed early\b/i);
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|queue\b/i);
    if (signals.lively) score += 15;
    if (signals.dead) score -= 20;
    if (signals.waitHeavy) score -= 8;
    mainRisk = signals.waitHeavy ? "Line and door friction" : signals.dead ? "Low energy vs. plan" : "Night-to-night variability";
    bestFor = "Lively social nights with buffer time";
    avoidIf = "No-wait, guaranteed peak energy";
  } else if (intentKind === "family") {
    signals.familyFriendly = riskFromBlob(blob, /\bfamily|kids|friendly|welcoming\b/i);
    signals.adult = riskFromBlob(blob, /\bbar|nightclub|shots|adults only\b/i);
    if (signals.familyFriendly) score += 10;
    if (signals.adult) score -= 20;
    mainRisk = signals.adult ? "Family fit mismatch" : "Peak-hour waits";
    bestFor = "Casual family outings";
    avoidIf = "Young kids during peak loud hours";
  } else if (intentKind === "low_wait") {
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|queue|reservation|packed|crowd|busy|slow seating\b/i);
    const easyAccess = riskFromBlob(blob, /\bno wait|short wait|quick seating|easy reservation|walk-?in\b/i);
    if (signals.waitHeavy) score -= 28;
    if (easyAccess) score += 16;
    mainRisk = signals.waitHeavy ? "Repeated line or reservation themes" : "Peak-time variability";
    bestFor = "Low-wait visits with flexible timing";
    avoidIf = "Zero buffer if lines appear";
  } else if (intentKind === "luxury") {
    signals.upscale = place.priceLevel >= 3 || riskFromBlob(blob, /\bupscale|fine dining|chef|tasting\b/i);
    signals.valueComplaints = riskFromBlob(blob, /\boverpriced|not worth|small portion\b/i);
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|reservation\b/i);
    if (signals.upscale) score += 12;
    if (signals.valueComplaints) score -= 18;
    if (signals.waitHeavy) score -= 6;
    mainRisk = signals.valueComplaints ? "Value mismatch at premium tabs" : signals.waitHeavy ? "Reservation pressure" : "Occasion consistency";
    bestFor = "Upscale special-occasion plans";
    avoidIf = "Budget-capped plans expecting premium consistency";
  }

  return {
    fitScore: clamp(Math.round(score), 0, 100),
    signals,
    mainRisk,
    bestFor,
    avoidIf,
  };
}

function decisionToneLine(label: RankedCandidate["decision"]["label"], placeId: string): string {
  const s = seedFromId(placeId) % 3;
  if (label === "GO") {
    const lines = [
      "Strong match for this plan if the listed risk is acceptable.",
      "Best current match on fit, review coverage, and signal confidence in this shortlist.",
      "Worth choosing when you can accept the main tradeoff and time the visit sensibly.",
    ];
    return lines[s] ?? lines[0]!;
  }
  if (label === "MAYBE") {
    const lines = [
      "Possible fit — check the tradeoff before you commit.",
      "Good enough for the plan if timing or seating is flexible.",
      "Worth considering when you can absorb a bit of execution risk.",
    ];
    return lines[s] ?? lines[0]!;
  }
  const lines = [
    "Poor fit for this goal based on available review signals.",
    "Main review themes conflict with the plan — only choose if the goal can flex.",
    "Choose only if you are deliberately trading the stated goal for something else.",
  ];
  return lines[s] ?? lines[0]!;
}

function buildDecisionAwareReason(
  label: RankedCandidate["decision"]["label"],
  intentKind: UserIntentKind,
  place: PlaceData,
  signals: CandidateSignals,
  rankIndex: number,
  intent: DetectedIntent,
): string {
  const v = seedFromId(`${place.id}|${rankIndex}`);
  const veganGoal = hasVeganGoal(intent);

  if (veganGoal) {
    if (label === "GO") {
      return signals.veganFit
        ? `Strong plant-forward signal in reviews for ${place.name}; still confirm the menu because signals are based on available Google review text only.`
        : `Usable vegan-leaning pick from overall quality, but menu confidence is not as tight — verify dishes before you go.`;
    }
    if (label === "MAYBE") {
      return v % 2 === 0
        ? `Possible vegan fit, but reviews hint at limited options or inconsistent execution.`
        : `Menu confidence looks mixed — workable if you can ask service, not ideal for a strict plant-only night without checks.`;
    }
    return `Weak vegan fit: review themes suggest limited plant-forward depth or repeated meat-forward friction.`;
  }

  if (intentKind === "study_work" || intentKind === "quiet_calm") {
    const studyType = isStudyPlaceType(place);
    if (label === "GO") {
      if (studyType && place.reviewCount > 500) {
        return `Study-friendly venue type plus broad review coverage (${place.reviewCount.toLocaleString()}) — still avoid peak rush if you need silence.`;
      }
      if (signals.quiet && v % 2 === 0) {
        return `Calm/work-friendly cues show up in review themes; best for focused work blocks with some peak-hour discipline.`;
      }
      return `Solid study candidate from rating depth and place context; noise or turnover may still spike at busy windows.`;
    }
    if (label === "MAYBE") {
      if (studyType) {
        return v % 2 === 0
          ? `Place type helps study plans, but review themes still flag noise, waits, or seating pressure.`
          : `Study-friendly context is not enough to clear crowding risk in the current review snapshot.`;
      }
      return v % 2 === 0
        ? `Noise or crowding risk lowered its rank versus quieter peers in this list.`
        : `Possible study fit, but seating and outlet reliability look less certain than higher-ranked picks.`;
    }
    return `Review signals conflict with a low-noise, low-wait study plan — skip unless you can flex the goal.`;
  }

  if (intentKind === "budget_eats" || intentKind === "budget_celebration") {
    if (label === "GO") {
      if (place.priceLevel <= 2 && place.reviewCount >= 300) {
        return `Friendlier price level with deeper reviews (${place.reviewCount.toLocaleString()}) — still validate reservation timing for groups.`;
      }
      return place.priceLevel <= 2
        ? `Value-oriented price tier with workable review cues on tabs and portions.`
        : `Acceptable budget pick, but menu math may need a second look before a big group tab.`;
    }
    if (label === "MAYBE") {
      return v % 2 === 0
        ? `Better value fit than some peers, but weaker occasion signal or wait friction shows up in reviews.`
        : `Price/value looks mixed — workable only if the group tolerates timing or noise tradeoffs.`;
    }
    return `Price/value signals conflict with a cost-conscious celebration goal.`;
  }

  if (intentKind === "luxury" || intentKind === "date_night") {
    if (label === "GO") {
      return place.reviewCount > 600
        ? `Strong occasion read with broad review support (${place.reviewCount.toLocaleString()}) — book ahead to reduce reservation risk.`
        : `Strong ambience and reputation cues in reviews; reservation pressure may still apply on peak nights.`;
    }
    if (label === "MAYBE") {
      return v % 2 === 0
        ? `Strong ambience signal, but price fit or pacing looks weaker than the top pick.`
        : `Occasion fit is plausible, yet reviews flag noise, pacing, or table-flow risk.`;
    }
    return `Occasion signals conflict with what reviews describe — poor premium-night fit.`;
  }

  if (intentKind === "party_nightlife") {
    if (label === "GO") return `High-energy alignment in review themes; still expect queue variability on peak nights.`;
    if (label === "MAYBE") return v % 2 === 0 ? `Energy is mixed versus a big night out — wait risk may still spike.` : `Possible night-out fit, but pacing and crowd cues are uneven in reviews.`;
    return `Nightlife energy signal is weak versus the plan — poor match for a high-tempo night.`;
  }

  if (intentKind === "family") {
    if (label === "GO") return `Family-friendly cues outweigh adult-only friction in this review slice.`;
    if (label === "MAYBE") return `Kid-friendly hints exist, but loud or adult-skewed themes still appear in reviews.`;
    return `Adult-skewed or loud signals conflict with a relaxed family outing.`;
  }

  if (intentKind === "low_wait") {
    if (label === "GO") {
      return `Lower queue pressure in the current review snapshot — still safer off-peak if your schedule has little buffer.`;
    }
    if (label === "MAYBE") {
      return v % 2 === 0
        ? `Low-wait goal conflicts with some line or reservation mentions in reviews.`
        : `Possible no-wait fit, but timing risk is visible — better if you can book or arrive off-peak.`;
    }
    return `Repeated line or crowding themes — risky for a strict no-wait plan.`;
  }

  if (intentKind === "venue_lookup") {
    const mealish = /\b(brunch|lunch|dinner|coffee|meal|café|cafe)\b/i.test(intent.label);
    if (mealish) {
      if (label === "GO") {
        return `Good meal-context signal from ratings and review breadth; tourist-area crowding may still affect timing — social comparison uses mock signals.`;
      }
      if (label === "MAYBE") {
        return v % 2 === 0
          ? `Meal fit is plausible, but crowd timing or value looks less certain than higher-ranked picks.`
          : `Check seating predictability in fresh reviews; illustrative social comparison should not replace a menu read.`;
      }
      return `Weak meal-context fit versus review themes for this shortlist.`;
    }
    if (label === "GO") {
      return `Strong rating and review depth for ${place.name}; visit goal was underspecified so fit is mostly quality-led — social remains illustrative mock signals.`;
    }
    if (label === "MAYBE") {
      return `Mixed quality read from available signals — useful as a shortlist tie-break, not a guarantee without a stated goal.`;
    }
    return `Weak match versus peers on the current scoring snapshot.`;
  }

  if (label === "GO") return `Good overall match from ratings and review themes on this draw — confirm details on site.`;
  if (label === "MAYBE") return v % 2 === 0 ? `Possible fit, but review-side risks look higher than the top pick.` : `Workable with flexibility — re-check recent reviews before you commit.`;
  return `Poor fit versus what review themes emphasize for this goal.`;
}

function pickScoreDriver(intent: DetectedIntent, signals: CandidateSignals, place: PlaceData): string {
  const k = intent.kind;
  const h = seedFromId(place.id) % 4;

  if (hasVeganGoal(intent)) {
    if (signals.veganLimited) return "Menu confidence risk";
    if (signals.veganFit) return "Vegan fit signal";
    return h % 2 === 0 ? "Weak plant-forward depth" : "Mixed dietary-option signal";
  }
  if (k === "study_work" || k === "quiet_calm") {
    if (isStudyPlaceType(place)) return "Study-friendly context";
    if (signals.noisy) return h % 2 === 0 ? "Noise/crowding drag" : "Peak-hour noise drag";
    if (signals.quiet) return "Workable calm signal";
    return h % 2 === 0 ? "Review depth vs. noise risk" : "Seating/outlet uncertainty";
  }
  if (k === "budget_eats" || k === "budget_celebration") {
    if (signals.pricey) return h % 2 === 0 ? "Price mismatch risk" : "Value complaints in reviews";
    if (signals.value) return "Better value fit";
    return h % 2 === 0 ? "Group celebration practicality" : "Reservation timing drag";
  }
  if (k === "luxury" || k === "date_night") {
    if (signals.cozy || signals.upscale) return h % 2 === 0 ? "Strong occasion fit" : "Premium atmosphere signal";
    if (signals.rushed) return "Noise/pacing drag";
    return "Occasion uncertainty";
  }
  if (k === "party_nightlife") {
    if (signals.lively) return "Higher energy alignment";
    if (signals.dead) return "Low nightlife signal";
    return h % 2 === 0 ? "Queue variability" : "Energy vs. wait tradeoff";
  }
  if (k === "low_wait") {
    if (signals.waitHeavy) return h % 2 === 0 ? "Queue friction risk" : "Repeated wait themes";
    return "Lower reservation risk";
  }
  if (k === "family") {
    if (signals.familyFriendly) return "Family-friendly signal";
    if (signals.adult) return "Adult-skewed venue drag";
    return "Mixed family fit";
  }
  return h % 2 === 0 ? "Strong review depth" : "Balanced fit profile";
}

function buildRankReasonDetail(
  candidate: RankedCandidate,
  index: number,
  list: RankedCandidate[],
): string {
  const next = list[index + 1];
  const prev = list[index - 1];
  const deltaNext = next ? candidate.fitScore - next.fitScore : 0;
  const deltaPrev = prev ? prev.fitScore - candidate.fitScore : 0;

  if (index === 0) {
    return deltaNext > 0
      ? `Strongest driver: ${candidate.scoreDriver}; leads the shortlist by ${deltaNext} fit points on the current model.`
      : `Strongest driver: ${candidate.scoreDriver}; edges the field on tie-breakers in this run.`;
  }

  const v = seedFromId(candidate.place.id) % 3;
  const vsPrev =
    deltaPrev > 0
      ? v === 0
        ? `Fits below #${index} mainly on ${candidate.scoreDriver.toLowerCase()} versus ${prev?.scoreDriver.toLowerCase() ?? "the leader"}.`
        : v === 1
          ? `Noise/crowding or wait cues read heavier than the pick above, depending on goal.`
          : `Weaker overall fit than #${index} with a different risk mix in reviews.`
      : `Clusters near #${index} on score — differentiate on ${candidate.mainRisk.toLowerCase()} vs. peers.`;

  return vsPrev;
}

function scoreBreakdownFor(
  intent: DetectedIntent,
  analysis: ReturnType<typeof rankForIntent>,
  place: PlaceData,
  fitScore: number,
  riskPenalty: number,
  reviewStrength: number,
  confidenceScore: number,
): BreakdownRow[] {
  const k = intent.kind;
  const gRev = Boolean(place.hasRealGoogleReviews);
  const revExpl = gRev
    ? `Based on rating (${place.averageRating.toFixed(1)}) and Google review coverage (${place.reviewCount.toLocaleString()}).`
    : `Based on rating (${place.averageRating.toFixed(1)}) and available signals (${place.reviewCount.toLocaleString()} reviews).`;

  if (hasVeganGoal(intent)) {
    return [
      {
        label: "Vegan / plant fit",
        score: clamp((analysis.signals.veganFit ? 78 : 52) - (analysis.signals.veganLimited ? 22 : 0), 0, 100),
        explanation: analysis.signals.veganFit
          ? "Review themes mention vegan, vegetarian, or plant-forward options."
          : "Limited explicit plant-based language in the current review snapshot.",
      },
      {
        label: "Menu confidence",
        score: clamp(100 - (analysis.signals.veganLimited ? 48 : 22), 0, 100),
        explanation: analysis.signals.veganLimited
          ? "Reviews hint at narrow options or inconsistent execution."
          : "No strong “limited options” warning in this draw.",
      },
      {
        label: "Wait/reservation risk",
        score: clamp(100 - (analysis.signals.waitHeavy ? 52 : 24), 0, 100),
        explanation: analysis.signals.waitHeavy ? "Queue or reservation friction appears in review themes." : "Wait pressure looks moderate in this snapshot.",
      },
      { label: "Review strength", score: reviewStrength, explanation: revExpl },
      {
        label: "Signal confidence",
        score: confidenceScore,
        explanation: "Higher when Google review text is available; social remains illustrative mock signals.",
      },
    ];
  }

  if (k === "study_work" || k === "quiet_calm") {
    return [
      {
        label: "Quiet / study fit",
        score: clamp((analysis.signals.quiet ? 82 : 58) + (isStudyPlaceType(place) ? 10 : 0), 0, 100),
        explanation: isStudyPlaceType(place)
          ? "Bookshop/library/work-friendly context supports focused visits."
          : "General venue context has moderate study alignment.",
      },
      {
        label: "Noise / crowding drag",
        score: clamp(100 - (analysis.signals.noisy ? 52 : 28) - (analysis.signals.waitHeavy ? 14 : 0), 0, 100),
        explanation: analysis.signals.noisy
          ? "Review themes mention crowd or noise pressure in busier windows."
          : "No strong noise warning in the current review signals.",
      },
      { label: "Review strength", score: reviewStrength, explanation: revExpl },
      {
        label: "Price / access",
        score: clamp(78 - place.priceLevel * 8 - (analysis.signals.waitHeavy ? 8 : 0), 0, 100),
        explanation: "Wait friction and price pressure inferred from review themes and price level.",
      },
      {
        label: "Signal confidence",
        score: confidenceScore,
        explanation: "Higher when Google review signals are available; social comparison uses mock signals.",
      },
    ];
  }

  if (k === "budget_eats" || k === "budget_celebration") {
    return [
      {
        label: "Budget / value fit",
        score: clamp(82 - place.priceLevel * 14 + (analysis.signals.value ? 10 : 0) - (analysis.signals.pricey ? 18 : 0), 0, 100),
        explanation: "Combines price level with value-related review themes.",
      },
      {
        label: "Group / celebration fit",
        score: clamp(74 - (analysis.signals.waitHeavy ? 16 : 0), 0, 100),
        explanation: "Group usability drops when reservation or wait pressure appears in reviews.",
      },
      {
        label: "Wait / reservation risk",
        score: clamp(100 - (analysis.signals.waitHeavy ? 58 : 26), 0, 100),
        explanation: analysis.signals.waitHeavy ? "Line or reservation friction is visible in review themes." : "Queue friction looks moderate in this snapshot.",
      },
      { label: "Review strength", score: reviewStrength, explanation: revExpl },
      {
        label: "Signal confidence",
        score: confidenceScore,
        explanation: "Higher when Google review signals are available; social comparison uses mock signals.",
      },
    ];
  }

  if (k === "luxury" || k === "date_night") {
    return [
      {
        label: "Occasion fit",
        score: clamp((analysis.signals.upscale || analysis.signals.cozy ? 82 : 60) - (analysis.signals.rushed ? 16 : 0), 0, 100),
        explanation: "Upscale or date-night suitability versus pacing mismatch risk.",
      },
      {
        label: "Ambience / reputation",
        score: clamp(68 + (analysis.signals.cozy ? 14 : 0) + Math.round(place.averageRating * 4), 0, 100),
        explanation: "Ambience cues plus rating reputation from available signals.",
      },
      {
        label: "Reservation pressure",
        score: clamp(100 - (analysis.signals.waitHeavy ? 55 : 25), 0, 100),
        explanation: analysis.signals.waitHeavy ? "Reservation or queue pressure may impact occasion flow." : "Reservation pressure looks moderate here.",
      },
      { label: "Review strength", score: reviewStrength, explanation: revExpl },
      {
        label: "Signal confidence",
        score: confidenceScore,
        explanation: "Higher when Google review signals are available; social comparison uses mock signals.",
      },
    ];
  }

  if (k === "party_nightlife") {
    return [
      {
        label: "Nightlife / energy fit",
        score: clamp(55 + (analysis.signals.lively ? 28 : 0) - (analysis.signals.dead ? 24 : 0), 0, 100),
        explanation: analysis.signals.lively ? "Reviews skew toward lively, social, or music-forward nights." : "Energy signal is mixed versus a big night out.",
      },
      {
        label: "Queue / wait risk",
        score: clamp(100 - (analysis.signals.waitHeavy ? 56 : 28), 0, 100),
        explanation: analysis.signals.waitHeavy ? "Door lines or crowding spikes show up in review themes." : "Queue risk looks moderate in this snapshot.",
      },
      { label: "Review strength", score: reviewStrength, explanation: revExpl },
      {
        label: "Signal confidence",
        score: confidenceScore,
        explanation: "Higher when Google review signals are available; social comparison uses mock signals.",
      },
    ];
  }

  if (k === "family") {
    return [
      {
        label: "Family fit",
        score: clamp(58 + (analysis.signals.familyFriendly ? 22 : 0) - (analysis.signals.adult ? 28 : 0), 0, 100),
        explanation: analysis.signals.familyFriendly ? "Reviews mention family-friendly or welcoming cues." : "Family-friendly signal is not strong in this draw.",
      },
      {
        label: "Adult / noise skew",
        score: clamp(100 - (analysis.signals.adult ? 52 : 30), 0, 100),
        explanation: analysis.signals.adult ? "Adult-only or bar-forward cues appear in review themes." : "Adult-skew risk looks moderate here.",
      },
      { label: "Review strength", score: reviewStrength, explanation: revExpl },
      {
        label: "Signal confidence",
        score: confidenceScore,
        explanation: "Higher when Google review signals are available; social comparison uses mock signals.",
      },
    ];
  }

  if (k === "low_wait") {
    return [
      {
        label: "Low-wait fit",
        score: clamp(72 - (analysis.signals.waitHeavy ? 34 : 0), 0, 100),
        explanation: analysis.signals.waitHeavy
          ? "Repeated wait, line, or reservation themes reduce low-wait confidence."
          : "Fewer hard queue warnings in the current review snapshot.",
      },
      {
        label: "Crowding / pacing risk",
        score: clamp(100 - (analysis.signals.waitHeavy ? 44 : 24), 0, 100),
        explanation: "Crowding still correlates with wait risk for many venues.",
      },
      { label: "Review strength", score: reviewStrength, explanation: revExpl },
      {
        label: "Signal confidence",
        score: confidenceScore,
        explanation: "Higher when Google review signals are available; social comparison uses mock signals.",
      },
    ];
  }

  return [
    { label: "Goal fit", score: fitScore, explanation: "Overall deterministic fit against the detected intent." },
    { label: "Risk profile", score: 100 - riskPenalty, explanation: "Lower when review-side risks dominate." },
    { label: "Review strength", score: reviewStrength, explanation: revExpl },
    {
      label: "Signal confidence",
      score: confidenceScore,
      explanation: "Higher when Google review signals are available; social comparison uses mock signals.",
    },
  ];
}

export function rankCandidatesByIntent(candidates: PlaceData[], intent: DetectedIntent): RankedCandidate[] {
  const ranked = candidates.map((place) => {
    const analysis = rankForIntent(place, intent);
    const label: RankedCandidate["decision"]["label"] =
      analysis.fitScore >= 72 ? "GO" : analysis.fitScore >= 46 ? "MAYBE" : "SKIP";
    const adjustedLabel =
      (intent.kind === "study_work" || intent.kind === "quiet_calm") &&
      isStudyPlaceType(place) &&
      label === "SKIP" &&
      analysis.fitScore >= 34
        ? "MAYBE"
        : label;
    const confidence: RankedCandidate["decision"]["confidence"] =
      place.hasRealGoogleReviews ? "High" : place.dataSource === "google" ? "Medium" : "Low";

    const confidenceScore = confidence === "High" ? 85 : confidence === "Medium" ? 65 : 38;
    const reviewStrength = clamp(Math.round(Math.min(place.reviewCount / 20, 60) + place.averageRating * 8), 10, 95);
    const riskPenalty = clamp(100 - analysis.fitScore, 5, 95);

    const scoreDriver = pickScoreDriver(intent, analysis.signals, place);
    const scoreBreakdown = scoreBreakdownFor(intent, analysis, place, analysis.fitScore, riskPenalty, reviewStrength, confidenceScore);

    return {
      place,
      decision: { label: adjustedLabel, confidence },
      fitScore: analysis.fitScore,
      oneSentenceReason: "",
      decisionToneLine: decisionToneLine(adjustedLabel, place.id),
      rankReason: "",
      scoreDriver,
      mainRisk: analysis.mainRisk,
      bestFor: analysis.bestFor,
      avoidIf: analysis.avoidIf,
      scoreBreakdown,
    };
  });

  const sorted = ranked.sort((a, b) => b.fitScore - a.fitScore).slice(0, 6);
  return sorted.map((candidate, index, list) => ({
    ...candidate,
    oneSentenceReason: buildDecisionAwareReason(
      candidate.decision.label,
      intent.kind,
      candidate.place,
      analysisSignalsFromRank(candidate, intent),
      index,
      intent,
    ),
    rankReason: buildRankReasonDetail(candidate, index, list),
  }));
}

/** Re-derive minimal signals for copy after sort (uses same rankForIntent logic). */
function analysisSignalsFromRank(candidate: RankedCandidate, intent: DetectedIntent): CandidateSignals {
  return rankForIntent(candidate.place, intent).signals;
}
