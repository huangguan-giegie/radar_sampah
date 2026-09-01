// US4.3 - the published severity scoring rules.
//
// WHY THESE NUMBERS LIVE IN THE FRONTEND
// The team agreed US4.3 is a non-blocking stretch goal, so the frontend owns
// this table. That means the "How the score works" page always opens, even if
// the backend is down, and the rules are visible to the public from day one.
//
// WARNING - this file is also the specification for the backend. When the
// backend computes a beach score it must use exactly these numbers (API.md
// section 3). If this page shows 0.85 for Plastic and the server quietly uses
// 0.9, then the number we publish is a lie and US4.3 is worthless.
//
// So: changing any number here changes a rule we have published. Update
// API.md in the same commit, bump ruleVersion, and tell the backend owner.

import type { LitterCategory, QuantityBand, QuantityByCategory, ScoringMethod } from './types';

export const SCORING_METHOD: ScoringMethod = {
  // Category weight = how much harm one category does.
  // Fishing gear is 1.0 because it keeps trapping animals for years ("ghost
  // fishing"); paper is lowest because it breaks down in weeks.
  //
  // This list is sorted heaviest to lightest ON PURPOSE. Other code walks it
  // in order to pick the worst category in a report, so re-ordering these
  // lines changes behaviour, not just appearance.
  categoryWeights: [
    { category: 'Fishing gear', weight: 1.0 },
    { category: 'Plastic', weight: 0.85 },
    { category: 'Glass', weight: 0.7 },
    { category: 'Metal', weight: 0.6 },
    { category: 'Other', weight: 0.5 },
    { category: 'Paper', weight: 0.35 },
  ],

  // Quantity weight = how much there is. A volunteer only looks and estimates;
  // nobody carries scales to a beach, so the four bands are deliberately
  // coarse. 1 to 4 keeps the arithmetic easy to explain to the public.
  quantityWeights: [
    { quantity: 'Small', weight: 1 },
    { quantity: 'Medium', weight: 2 },
    { quantity: 'Large', weight: 3 },
    { quantity: 'Very Large', weight: 4 },
  ],

  // Four fixed cut-offs, the same for every beach.
  //
  // Fixed, not relative to the other beaches: if the cut-offs moved with the
  // data, a beach could become "cleaner" on paper purely because another beach
  // got worse. The ranges are written as "1.5 - <2.5" so the boundary is
  // unambiguous - a score of exactly 2.5 is High, not Moderate.
  //
  // The colours live with the bands so the map, the beach page and the legend
  // cannot drift apart.
  bands: [
    { band: 'Low', range: 'below 1.5', color: '#7CA98B' },
    { band: 'Moderate', range: '1.5 – <2.5', color: '#D9A24B' },
    { band: 'High', range: '2.5 – <3.5', color: '#CE6B45' },
    { band: 'Severe', range: '3.5 and above', color: '#B84A3F' },
  ],

  // Only reports from the last 90 days count. Litter is cleaned up and washed
  // back in, so a report from last year says nothing about today.
  windowDays: 90,
  // Under 3 valid reports we show "not enough evidence" instead of a band.
  // One angry volunteer should not be able to paint a beach red on their own.
  minReports: 3,
  // Inside ONE report: the worst category wins (see reportScoreFor below).
  reportAggregation: 'max',
  // Across a beach's reports: the median, not the mean. The median is what
  // stops a single extreme day from dragging a whole beach up, and anyone can
  // file a report, so that protection matters. The backend must use the same
  // two rules - these fields exist so it cannot quietly use different ones.
  beachAggregation: 'median',
  // Names this exact rule set. When the weights or the aggregation change,
  // this string changes too, so an old score can be identified as old rather
  // than compared against numbers produced a different way.
  ruleVersion: 'radar-sampah-scoring-v2',
};

/**
 * The score for each category in one report: category weight x quantity
 * weight.
 *
 * It returns the whole breakdown, not just the total, because the beach page
 * and the method page show the working. A published score nobody can take
 * apart is a score nobody can check - which is the whole point of US4.3.
 *
 * Categories with no amount recorded are filtered out rather than scored as
 * zero: "not reported" is not the same claim as "none found".
 */
export function categoryScoresFor(quantities: QuantityByCategory): Partial<Record<LitterCategory, number>> {
  return Object.fromEntries(
    SCORING_METHOD.categoryWeights
      .filter(({ category }) => quantities[category])
      .map(({ category, weight }) => {
        const quantity = quantities[category] as QuantityBand;
        const quantityWeight = SCORING_METHOD.quantityWeights.find((item) => item.quantity === quantity)?.weight ?? 0;
        return [category, weight * quantityWeight];
      }),
  ) as Partial<Record<LitterCategory, number>>;
}

/**
 * One report's single score: the highest of its category scores.
 *
 * MAX, NOT AVERAGE - and this is the decision most worth being able to defend.
 * A report of "a mountain of fishing gear plus one paper cup" averages down to
 * something mild, and the beach with the ghost nets stops looking urgent. The
 * worst thing found is what should drive attention, so it is what we keep.
 *
 * It throws rather than returning 0 on an empty report. A 0 would flow into
 * the median as if it were a real measurement of a clean beach.
 */
export function reportScoreFor(quantities: QuantityByCategory): number {
  const scores = Object.values(categoryScoresFor(quantities));
  if (!scores.length) throw new Error('A report needs at least one category.');
  return Math.max(...scores);
}
