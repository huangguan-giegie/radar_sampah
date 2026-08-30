
//


//


//


import type { ScoringMethod } from './types';

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
    { band: 'Moderate', range: '1.5 – 2.4', color: '#D9A24B' },
    { band: 'High', range: '2.5 – 3.4', color: '#CE6B45' },
    { band: 'Severe', range: '3.5 and above', color: '#B84A3F' },
  ],

  windowDays: 90,
  minReports: 3,
};
