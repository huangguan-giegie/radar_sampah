
//


//


//


import type { LitterCategory, QuantityBand, QuantityByCategory, ScoringMethod } from './types';

export const SCORING_METHOD: ScoringMethod = {

  categoryWeights: [
    { category: 'Fishing gear', weight: 1.0 },
    { category: 'Plastic', weight: 0.85 },
    { category: 'Glass', weight: 0.7 },
    { category: 'Metal', weight: 0.6 },
    { category: 'Other', weight: 0.5 },
    { category: 'Paper', weight: 0.35 },
  ],


  quantityWeights: [
    { quantity: 'Small', weight: 1 },
    { quantity: 'Medium', weight: 2 },
    { quantity: 'Large', weight: 3 },
    { quantity: 'Very Large', weight: 4 },
  ],


  bands: [
    { band: 'Low', range: 'below 1.5', color: '#7CA98B' },
    { band: 'Moderate', range: '1.5 – <2.5', color: '#D9A24B' },
    { band: 'High', range: '2.5 – <3.5', color: '#CE6B45' },
    { band: 'Severe', range: '3.5 and above', color: '#B84A3F' },
  ],

  windowDays: 90,
  minReports: 3,
  reportAggregation: 'max',
  beachAggregation: 'median',
  ruleVersion: 'radar-sampah-scoring-v2',
};

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

export function reportScoreFor(quantities: QuantityByCategory): number {
  const scores = Object.values(categoryScoresFor(quantities));
  if (!scores.length) throw new Error('A report needs at least one category.');
  // Max keeps the strongest category signal without double-counting one report.
  return Math.max(...scores);
}
