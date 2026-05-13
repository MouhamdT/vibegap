import type { DetectedIntent, PlaceData, RankedCandidate, UserIntentKind } from "@/lib/types/vibecheck";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
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

function isStudyPlaceType(place: PlaceData): boolean {
  const text = `${place.category} ${place.name}`.toLowerCase();
  return /\blibrary|bookstore|book shop|bookshop|study|cowork|co-working|workspace|reading room|book cafe\b/.test(text);
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
};

type BreakdownRow = {
  label: string;
  score: number;
  explanation: string;
};

function rankForIntent(place: PlaceData, intentKind: UserIntentKind): {
  fitScore: number;
  signals: CandidateSignals;
  mainRisk: string;
  bestFor: string;
  avoidIf: string;
} {
  const blob = reviewBlob(place);
  let score = baseScore(place);
  const signals: CandidateSignals = {};
  let mainRisk = "Signal depth";
  let bestFor = "Flexible plans";
  let avoidIf = "Strict expectations without review checks";

  if (intentKind === "study_work" || intentKind === "quiet_calm") {
    const studyTypeBoost = isStudyPlaceType(place);
    signals.quiet = riskFromBlob(blob, /\bquiet|calm|study|laptop|wifi|wi-fi|outlet|bookshop|workspace\b/i);
    signals.noisy = riskFromBlob(blob, /\bloud|noise|crowd|packed|wait|line|busy|queue\b/i);
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|queue|reservation\b/i);
    if (studyTypeBoost) score += 18;
    if (signals.quiet) score += 16;
    if (signals.noisy) score -= 24;
    if (signals.waitHeavy) score -= 8;
    mainRisk = signals.noisy ? "Noise and crowding" : signals.waitHeavy ? "Peak-hour waits" : "Seating and outlet availability";
    bestFor = "Quiet work or study sessions";
    avoidIf = "Need guaranteed silence at peak times";
  } else if (intentKind === "budget_eats" || intentKind === "budget_celebration") {
    signals.value = riskFromBlob(blob, /\bvalue|affordable|good price|worth\b/i);
    signals.pricey = riskFromBlob(blob, /\boverpriced|expensive|pricey|not worth\b/i) || place.priceLevel >= 3;
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|queue|reservation\b/i);
    if (signals.value) score += 14;
    if (signals.pricey) score -= 26;
    if (signals.waitHeavy) score -= 8;
    mainRisk = signals.pricey ? "Price mismatch" : signals.waitHeavy ? "Reservation or wait timing" : "Group birthday timing";
    bestFor = "Budget-conscious dinners";
    avoidIf = "Strict per-person spend caps";
  } else if (intentKind === "date_night") {
    signals.cozy = riskFromBlob(blob, /\bcozy|romantic|ambience|atmosphere|design|service\b/i);
    signals.rushed = riskFromBlob(blob, /\bloud|crowd|wait|line|rushed|slow\b/i);
    if (signals.cozy) score += 14;
    if (signals.rushed) score -= 20;
    mainRisk = signals.rushed ? "Atmosphere mismatch" : "Reservation timing";
    bestFor = "Date-style ambience plans";
    avoidIf = "Low-noise, tightly timed evenings";
  } else if (intentKind === "party_nightlife") {
    signals.lively = riskFromBlob(blob, /\bparty|music|dj|crowd|lively|night\b/i);
    signals.dead = riskFromBlob(blob, /\bquiet|empty|dead|closed early\b/i);
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|queue\b/i);
    if (signals.lively) score += 15;
    if (signals.dead) score -= 20;
    if (signals.waitHeavy) score -= 8;
    mainRisk = signals.waitHeavy ? "Long waits" : signals.dead ? "Low energy" : "Night-to-night variability";
    bestFor = "Lively social nights";
    avoidIf = "No-wait, guaranteed high-energy expectations";
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
    mainRisk = signals.waitHeavy ? "Line or reservation friction" : "Peak-time variability";
    bestFor = "Low-wait visits with flexible timing";
    avoidIf = "Strict no-line expectations at peak hours";
  } else if (intentKind === "luxury") {
    signals.upscale = place.priceLevel >= 3 || riskFromBlob(blob, /\bupscale|fine dining|chef|tasting\b/i);
    signals.valueComplaints = riskFromBlob(blob, /\boverpriced|not worth|small portion\b/i);
    signals.waitHeavy = riskFromBlob(blob, /\bwait|line|reservation\b/i);
    if (signals.upscale) score += 12;
    if (signals.valueComplaints) score -= 18;
    if (signals.waitHeavy) score -= 6;
    mainRisk = signals.valueComplaints ? "Value mismatch" : signals.waitHeavy ? "Reservation pressure" : "Occasion fit consistency";
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

function buildDecisionAwareReason(
  label: RankedCandidate["decision"]["label"],
  intentKind: UserIntentKind,
  place: PlaceData,
  signals: CandidateSignals,
): string {
  if (intentKind === "study_work" || intentKind === "quiet_calm") {
    const studyType = isStudyPlaceType(place);
    if (label === "GO") {
      if (studyType && place.reviewCount > 500) {
        return "Strong option for focused work with study-friendly place context and broad review coverage; still avoid peak rush if you need silence.";
      }
      return signals.quiet
        ? "Strong option for focused work based on calm/work-friendly review cues; avoid peak hours if you need silence."
        : "Good study candidate from overall place quality, with moderate noise risk at busier times.";
    }
    if (label === "MAYBE") {
      return studyType
        ? "Study-style place type helps, but review signals suggest some risk around noise, waits, or seating."
        : "Possible study fit, but review signals suggest some risk around noise, waits, or seating.";
    }
    return "Poor fit for focused work because review signals conflict with a low-noise, low-wait visit.";
  }

  if (intentKind === "budget_eats" || intentKind === "budget_celebration") {
    if (label === "GO") {
      if (place.priceLevel <= 2 && place.reviewCount >= 300) {
        return "Good budget pick with a friendlier price level and decent review depth; still check reservation timing for groups.";
      }
      return place.priceLevel <= 2
        ? "Good budget pick with a friendlier price level and workable review-side value cues."
        : "Usable budget option, but verify menu totals before committing for a group celebration.";
    }
    if (label === "MAYBE") {
      return "Possible budget fit, but pricing/value or reservation timing may create risk for dinner plans.";
    }
    return "Poor budget fit because price/value signals conflict with a cost-conscious dinner goal.";
  }

  if (intentKind === "luxury" || intentKind === "date_night") {
    if (label === "GO") {
      return place.reviewCount > 600
        ? "Strong occasion option with solid ambience/rating signals and broad review support; still book ahead to reduce reservation risk."
        : "Strong occasion option with solid ambience/rating signals; still book ahead to reduce reservation risk.";
    }
    if (label === "MAYBE") {
      return "Possible occasion fit, but review signals suggest some noise, pacing, or reservation risk.";
    }
    return "Poor occasion fit because review signals conflict with ambience or service expectations.";
  }

  if (intentKind === "party_nightlife") {
    if (label === "GO") return "Good night-out fit with lively energy cues; wait times may still spike at peak hours.";
    if (label === "MAYBE") return "Possible night-out fit, but energy signals are mixed or wait risk is elevated.";
    return "Poor night-out fit because review signals do not support the expected energy.";
  }

  if (intentKind === "low_wait") {
    if (label === "GO") {
      return "Good no-wait candidate with lighter queue pressure in available signals; still safer off-peak.";
    }
    if (label === "MAYBE") {
      return "Possible no-wait fit, but reviews suggest line or reservation friction at busier times.";
    }
    return "Poor fit for a no-wait visit because queue and crowding signals stay high.";
  }

  if (label === "GO") return "Good overall match for this goal based on current place and review signals.";
  if (label === "MAYBE") return "Possible fit, but review-side risk signals suggest caution.";
  return "Poor fit for this goal because review signals conflict with the visit need.";
}

export function rankCandidatesByIntent(candidates: PlaceData[], intent: DetectedIntent): RankedCandidate[] {
  const ranked = candidates.map((place) => {
    const analysis = rankForIntent(place, intent.kind);
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

    const scoreBreakdown: BreakdownRow[] =
      intent.kind === "study_work" || intent.kind === "quiet_calm"
        ? [
            {
              label: "Goal fit",
              score: clamp((analysis.signals.quiet ? 82 : 58) + (isStudyPlaceType(place) ? 10 : 0), 0, 100),
              explanation: isStudyPlaceType(place)
                ? "Bookshop/library/work-friendly context supports focused visits."
                : "General venue context has moderate study alignment.",
            },
            {
              label: "Noise/crowding risk",
              score: clamp(100 - (analysis.signals.noisy ? 52 : 28) - (analysis.signals.waitHeavy ? 14 : 0), 0, 100),
              explanation: analysis.signals.noisy
                ? "Reviews mention crowd or noise pressure in busier windows."
                : "No strong noise warning in the current review signals.",
            },
            {
              label: "Review strength",
              score: reviewStrength,
              explanation: `Based on rating (${place.averageRating.toFixed(1)}) and review coverage (${place.reviewCount.toLocaleString()}).`,
            },
            {
              label: "Price/access",
              score: clamp(78 - place.priceLevel * 8 - (analysis.signals.waitHeavy ? 8 : 0), 0, 100),
              explanation: "Reflects practical access factors like wait friction and price pressure.",
            },
            {
              label: "Signal confidence",
              score: confidenceScore,
              explanation: "Higher when Google review signals are available and stronger.",
            },
          ]
        : intent.kind === "budget_eats" || intent.kind === "budget_celebration"
          ? [
              {
                label: "Budget/value fit",
                score: clamp(82 - place.priceLevel * 14 + (analysis.signals.value ? 10 : 0) - (analysis.signals.pricey ? 18 : 0), 0, 100),
                explanation: "Combines price level with value-related review signals.",
              },
              {
                label: "Group fit",
                score: clamp(74 - (analysis.signals.waitHeavy ? 16 : 0), 0, 100),
                explanation: "Birthday/group usability drops when reservation or wait pressure appears.",
              },
              {
                label: "Wait/reservation risk",
                score: clamp(100 - (analysis.signals.waitHeavy ? 58 : 26), 0, 100),
                explanation: analysis.signals.waitHeavy
                  ? "Line or reservation friction is visible in review signals."
                  : "No strong queue friction signal in current reviews.",
              },
              {
                label: "Review strength",
                score: reviewStrength,
                explanation: `Based on rating (${place.averageRating.toFixed(1)}) and review coverage (${place.reviewCount.toLocaleString()}).`,
              },
              {
                label: "Signal confidence",
                score: confidenceScore,
                explanation: "Higher when Google review signals are available and stronger.",
              },
            ]
          : intent.kind === "luxury" || intent.kind === "date_night"
            ? [
                {
                  label: "Occasion fit",
                  score: clamp((analysis.signals.upscale || analysis.signals.cozy ? 82 : 60) - (analysis.signals.rushed ? 16 : 0), 0, 100),
                  explanation: "Measures upscale/date suitability against pacing mismatch risk.",
                },
                {
                  label: "Ambience/reputation",
                  score: clamp(68 + (analysis.signals.cozy ? 14 : 0) + Math.round(place.averageRating * 4), 0, 100),
                  explanation: "Uses ambience cues plus rating reputation.",
                },
                {
                  label: "Reservation risk",
                  score: clamp(100 - (analysis.signals.waitHeavy ? 55 : 25), 0, 100),
                  explanation: analysis.signals.waitHeavy
                    ? "Reservation or queue pressure may impact occasion flow."
                    : "Reservation pressure appears moderate in the current snapshot.",
                },
                {
                  label: "Review strength",
                  score: reviewStrength,
                  explanation: `Based on rating (${place.averageRating.toFixed(1)}) and review coverage (${place.reviewCount.toLocaleString()}).`,
                },
                {
                  label: "Signal confidence",
                  score: confidenceScore,
                  explanation: "Higher when Google review signals are available and stronger.",
                },
              ]
            : [
                {
                  label: "Goal fit",
                  score: analysis.fitScore,
                  explanation: "Overall deterministic fit against the detected intent.",
                },
                {
                  label: "Risk profile",
                  score: 100 - riskPenalty,
                  explanation: "Lower when review-side risks dominate.",
                },
                {
                  label: "Review strength",
                  score: reviewStrength,
                  explanation: `Based on rating (${place.averageRating.toFixed(1)}) and review coverage (${place.reviewCount.toLocaleString()}).`,
                },
                {
                  label: "Signal confidence",
                  score: confidenceScore,
                  explanation: "Higher when Google review signals are available and stronger.",
                },
              ];

    let scoreDriver = "Balanced fit profile";
    if (intent.kind === "study_work" || intent.kind === "quiet_calm") {
      scoreDriver = isStudyPlaceType(place) ? "Study-friendly context" : analysis.signals.noisy ? "Noise/crowding drag" : "Workable calm signal";
    } else if (intent.kind === "budget_eats" || intent.kind === "budget_celebration") {
      scoreDriver = analysis.signals.pricey ? "Price mismatch risk" : "Better value fit";
    } else if (intent.kind === "luxury" || intent.kind === "date_night") {
      scoreDriver = analysis.signals.cozy || analysis.signals.upscale ? "Stronger ambience signal" : "Occasion uncertainty";
    } else if (intent.kind === "party_nightlife") {
      scoreDriver = analysis.signals.lively ? "Higher energy alignment" : "Lower nightlife signal";
    } else if (intent.kind === "low_wait") {
      scoreDriver = analysis.signals.waitHeavy ? "Queue friction risk" : "Lower reservation risk";
    }

    return {
      place,
      decision: { label: adjustedLabel, confidence },
      fitScore: analysis.fitScore,
      oneSentenceReason: buildDecisionAwareReason(adjustedLabel, intent.kind, place, analysis.signals),
      rankReason: "",
      scoreDriver,
      mainRisk: analysis.mainRisk,
      bestFor: analysis.bestFor,
      avoidIf: analysis.avoidIf,
      scoreBreakdown,
    };
  });
  const sorted = ranked.sort((a, b) => b.fitScore - a.fitScore).slice(0, 6);
  return sorted.map((candidate, index, list) => {
    const next = list[index + 1];
    const delta = next ? candidate.fitScore - next.fitScore : candidate.fitScore;
    const rankReason =
      index === 0
        ? `Why ranked #1: ${candidate.scoreDriver}${delta > 0 ? ` and a ${delta}-point lead over the next option.` : "."}`
        : `Why ranked #${index + 1}: ${candidate.scoreDriver}${delta < 0 ? " with weaker overall fit than higher-ranked options." : "."}`;
    return { ...candidate, rankReason };
  });
}
