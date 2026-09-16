// The Background data: how much of the world's ocean plastic each country and
// region is estimated to emit.
//
// This is context for WHY the app exists, not evidence about any one beach.
// Nothing here feeds the litter score, and the screen that shows it says so.
//
// Every number is copied from the Iteration 2 prototype, which took them from
// Meijer et al. (2021) as published by Our World in Data for the year 2019.
// They are kept as the strings the prototype prints ("36.4%", "7.46%") rather
// than recomputed, so the app cannot round a figure differently from the
// design the team signed off. The test file checks the figures still agree
// with each other.

const GRAPHER = 'https://ourworldindata.org/grapher/share-of-global-plastic-waste-emitted-to-the-ocean';

/** The chart on its own, no country picked. */
export const OWID_CHART_URL = GRAPHER;
/** The chart opened on its world map tab. */
export const OWID_MAP_URL = `${GRAPHER}?tab=map`;
/** The chart with one country highlighted. `iso3` is the three-letter code. */
export const owidCountryUrl = (iso3: string) => `${GRAPHER}?country=~${iso3}`;
/** Malaysia highlighted - the source link used wherever the app says "Learn more". */
export const OWID_MALAYSIA_URL = owidCountryUrl('MYS');

export const OCEAN_PLASTIC_YEAR = 2019;
export const OCEAN_PLASTIC_SOURCE = 'Meijer et al. (2021), processed by Our World in Data';
export const OCEAN_PLASTIC_IMAGE = '/background/ocean-plastic-share-2019.png';

export interface CountryShare {
  name: string;
  iso3: string;
  /** As printed on the bar row, one decimal. */
  share: string;
  /** The same share as a number, for the bar length. */
  percent: number;
}

// The five largest emitters, largest first. The intro screen shows the first
// three; the full Background screen shows all five. Malaysia is third, which
// is the sentence both screens are built around.
export const TOP_COUNTRIES: readonly CountryShare[] = [
  { name: 'Philippines', iso3: 'PHL', share: '36.4%', percent: 36.38 },
  { name: 'India', iso3: 'IND', share: '12.9%', percent: 12.92 },
  { name: 'Malaysia', iso3: 'MYS', share: '7.5%', percent: 7.46 },
  { name: 'China', iso3: 'CHN', share: '7.2%', percent: 7.22 },
  { name: 'Indonesia', iso3: 'IDN', share: '5.8%', percent: 5.75 },
];

export const MALAYSIA_NOTE = 'Malaysia: 7.46% of the world total, 3rd of 159 countries.';

export interface RegionShare {
  id: string;
  name: string;
  share: string;
  /** The three biggest contributors inside the region, largest first. */
  top: readonly [string, string][];
  note: string;
  /**
   * Where the tap target sits over the chart image, in percent of the image
   * box. Measured from the prototype's hotspots, which were drawn over the
   * same Our World in Data image at 338 x 253. Percent rather than pixels so
   * the targets stay on their continents at any width.
   */
  hotspots: readonly { left: number; top: number; width: number; height: number }[];
}

// "World" is the whole-chart reading, opened by tapping anywhere on the map
// that is not one of the regions below.
export const WORLD: RegionShare = {
  id: 'world',
  name: 'World',
  share: '100%',
  top: [['Asia', '80.99%'], ['Americas', '10.01%'], ['Africa', '7.99%']],
  note: 'Five countries make up about 70% of the world total.',
  hotspots: [],
};

// Africa and East Asia each have two boxes because a single rectangle cannot
// cover their shapes without also covering a neighbour.
export const REGIONS: readonly RegionShare[] = [
  {
    id: 'north-america',
    name: 'North America',
    share: '4.50%',
    top: [['Guatemala', '0.73%'], ['Haiti', '0.71%'], ['Dominican Rep.', '0.64%']],
    note: 'Includes Central America and the Caribbean.',
    hotspots: [{ left: 3.85, top: 26.48, width: 23.08, height: 30.04 }],
  },
  {
    id: 'south-america',
    name: 'South America',
    share: '5.51%',
    top: [['Brazil', '3.86%'], ['Venezuela', '0.61%'], ['Argentina', '0.42%']],
    note: 'Brazil is most of the continent’s total.',
    hotspots: [{ left: 18.34, top: 53.75, width: 15.98, height: 26.09 }],
  },
  {
    id: 'europe',
    name: 'Europe',
    share: '0.60%',
    top: [['Albania', '0.16%'], ['Ukraine', '0.09%'], ['United Kingdom', '0.07%']],
    note: 'Low: waste here is mostly collected and contained.',
    hotspots: [{ left: 38.76, top: 26.48, width: 19.53, height: 15.81 }],
  },
  {
    id: 'west-central-asia',
    name: 'West & Central Asia',
    share: '1.67%',
    top: [['Turkey', '1.46%'], ['Iran', '0.09%'], ['Lebanon', '0.07%']],
    note: 'Turkey is most of this region’s total.',
    hotspots: [{ left: 47.93, top: 39.13, width: 13.31, height: 15.02 }],
  },
  {
    id: 'africa',
    name: 'Africa',
    share: '7.99%',
    top: [['Nigeria', '1.90%'], ['Cameroon', '1.09%'], ['Tanzania', '0.59%']],
    note: 'Concentrated along the Gulf of Guinea.',
    hotspots: [
      { left: 39.35, top: 43.87, width: 11.83, height: 33.99 },
      { left: 39.35, top: 52.57, width: 20.71, height: 25.30 },
    ],
  },
  {
    id: 'south-asia',
    name: 'South Asia',
    share: '16.5%',
    top: [['India', '12.92%'], ['Bangladesh', '2.52%'], ['Sri Lanka', '0.99%']],
    note: 'Mostly river outflow into the Bay of Bengal.',
    hotspots: [{ left: 61.24, top: 43.08, width: 11.83, height: 18.97 }],
  },
  {
    id: 'east-asia',
    name: 'East Asia',
    share: '7.52%',
    top: [['China', '7.22%'], ['Japan', '0.19%'], ['Taiwan', '0.05%']],
    note: 'China alone is 4th in the world.',
    hotspots: [
      { left: 65.98, top: 32.81, width: 6.51, height: 11.07 },
      { left: 72.49, top: 32.81, width: 12.43, height: 18.18 },
    ],
  },
  {
    id: 'southeast-asia',
    name: 'Southeast Asia',
    share: '55.2%',
    top: [['Philippines', '36.38%'], ['Malaysia', '7.46%'], ['Indonesia', '5.75%']],
    note: 'Malaysia is 3rd of 159 countries.',
    hotspots: [{ left: 71.89, top: 50.20, width: 13.02, height: 16.60 }],
  },
  {
    id: 'oceania',
    name: 'Oceania',
    share: '0.37%',
    top: [['Papua New Guinea', '0.31%'], ['Fiji', '0.04%'], ['Solomon Islands', '0.01%']],
    note: 'The smallest regional share in the data.',
    hotspots: [{ left: 70.71, top: 64.43, width: 22.49, height: 15.02 }],
  },
];
