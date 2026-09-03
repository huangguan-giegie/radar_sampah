
// The mock data. Once the backend is live, USE_MOCK in src/api.ts turns itself
// off and nothing here is loaded any more.
//
// It is not filler. Every row is written to exercise a state the UI has to
// handle: a beach with plenty of evidence, a beach with too little, a beach
// whose last report falls outside the 90 day window, species with a source and
// species still waiting for one, and reports in all three statuses. That is how
// the empty states and the "insufficient data" paths were built and tested
// before a single endpoint existed.
//
// It also keeps the demo honest: the mock obeys the same rules as the contract,
// so nothing here can look better than the real thing will.
import { PENDING_SOURCE } from './sources';
import type { BeachDetail, LitterReport, User } from './types';


/** The four beaches in the MVP scope. Delete this whole file once the backend
 *  serves them - nothing imports it except the mock branches in api.ts. */
export const BEACHES: BeachDetail[] = [
  {
    id: 'morib',
    name: 'Pantai Morib',
    area: 'Banting, Selangor',
    lat: 2.746,
    lng: 101.44,
    severity: 'High',
    band: 3,
    insufficientData: false,
    validReports: 8,
    // The median of those 8 report scores, which is what the band comes from.
    // 2.55 lands in the 2.5 - <3.5 range, so this beach reads High. The number
    // is stored, not derived here, because the backend is the one that
    // computes it - the mock has to answer with the same shape.
    attentionScore: 2.55,
    eligibleReportCount: 8,
    lastReportedAt: '2026-08-19T08:00:00Z',
    freshnessKind: 'ok',
    habitat: 'Intertidal mudflat & sandy shore',
    habitatTag: 'MUDFLAT',
    sensitivity: 'Migratory feeding ground',
    primarySpeciesGlyph: 'turtle',
    coverImageUrl: null,
    scene:
      'linear-gradient(180deg,transparent 42%,rgba(221,227,236,.2) 47%,transparent 55%),radial-gradient(110% 55% at 72% 18%,rgba(221,227,236,.35),transparent 58%),linear-gradient(178deg,#8FD0E8 0%,#4E9EC9 36%,#2E6EA8 58%,#173E77 100%)',
    composition: [
      { category: 'Plastic', quantity: 'Very Large' },
      { category: 'Fishing gear', quantity: 'Large' },
      { category: 'Glass', quantity: 'Medium' },
      { category: 'Metal', quantity: 'Small' },
      { category: 'Paper', quantity: 'Small' },
      { category: 'Other', quantity: 'Small' },
    ],
    compositionSource: { reportId: 'r_seed_morib', createdAt: '2026-08-19T16:00:00+08:00' },
    species: [
      {
        name: 'Green Sea Turtle',
        kind: 'species',
        scientificName: 'Chelonia mydas',
        // null, never invented. OBIS covers turtles, but the threat category comes from
        // FishBase, which only covers fish.
        threatCategory: null,
        glyph: 'turtle',
        text: 'Occasional visitor along the Strait of Malacca. Floating plastic may be mistaken for food.',
        source: PENDING_SOURCE,


        likelihood: {
          state: 'pending',
          basis: 'Green sea turtle is one of the four modelled species. Backend not connected yet.',
        },
      },
      {
        name: 'Mangrove Fringe',
        kind: 'habitat',
        scientificName: null,
        // null, never invented. A habitat, not a species - neither FishBase nor OBIS has one.
        threatCategory: null,
        glyph: 'mangrove',
        text: 'Young mangroves at the northern end shelter juvenile fish and crabs.',
        source: PENDING_SOURCE,
      },
      {
        name: 'Coastal Birds',
        kind: 'group',
        scientificName: null,
        // null, never invented. A group of animals, not one species, so there is no single
        // threat category to quote.
        threatCategory: null,
        glyph: 'bird',
        text: 'Migratory shorebirds feed along this tide line between September and April.',
        source: PENDING_SOURCE,

        likelihood: {
          state: 'unavailable',
          basis: 'Not one of the four modelled species, so no occurrence score exists for this card.',
        },
      },
    ],
    ecologicalNote:
      'Plastic and abandoned fishing gear may affect turtles and shorebirds that feed in this coastal environment.',
  },
  {
    id: 'remis',
    name: 'Pantai Remis',
    area: 'Jeram, Kuala Selangor',
    lat: 3.218,
    lng: 101.302,
    severity: 'Moderate',
    band: 2,
    insufficientData: false,
    validReports: 6,
    attentionScore: 2.0,
    eligibleReportCount: 6,
    lastReportedAt: '2026-07-25T08:00:00Z',
    freshnessKind: 'aging',
    habitat: 'Mudflat & shallow coastal waters',
    habitatTag: 'MUDFLAT',
    sensitivity: 'Seasonal bird activity',
    primarySpeciesGlyph: 'bird',
    coverImageUrl: null,
    scene:
      'radial-gradient(100% 60% at 30% 14%,rgba(255,255,255,.4),transparent 55%),linear-gradient(180deg,#D8ECF4 0%,#8FC6DC 38%,#5FA3C4 52%,#CFC9BA 78%,#B5AF9E 100%)',
    composition: [
      { category: 'Plastic', quantity: 'Very Large' },
      { category: 'Fishing gear', quantity: 'Medium' },
      { category: 'Paper', quantity: 'Medium' },
      { category: 'Glass', quantity: 'Small' },
      { category: 'Metal', quantity: 'Small' },
      { category: 'Other', quantity: 'Small' },
    ],
    compositionSource: { reportId: 'r_seed_remis', createdAt: '2026-07-25T16:00:00+08:00' },
    species: [
      {
        name: 'Migratory Shorebirds',
        kind: 'group',
        scientificName: null,
        // null, never invented. A group of animals, not one species, so there is no single
        // threat category to quote.
        threatCategory: null,
        glyph: 'bird',
        text: 'The Jeram mudflats are a stopover for migratory waders crossing the strait.',
        source: PENDING_SOURCE,
      },
      {
        name: 'Marine Fish',
        kind: 'group',
        scientificName: null,
        // null, never invented. A group of animals, not one species, so there is no single
        // threat category to quote.
        threatCategory: null,
        glyph: 'fish',
        text: 'Shallow nursery waters for coastal fish species.',
        source: PENDING_SOURCE,
      },
      {
        name: 'Mangrove Belt',
        kind: 'habitat',
        scientificName: null,
        // null, never invented. A habitat, not a species - neither FishBase nor OBIS has one.
        threatCategory: null,
        glyph: 'mangrove',
        text: 'A narrow mangrove belt lines the river mouth south of the beach.',
        source: PENDING_SOURCE,
      },
    ],
    ecologicalNote:
      'Litter that settles on mudflats may be swallowed by, or entangle, the birds and invertebrates feeding here.',
  },
  {
    id: 'kelanang',
    name: 'Pantai Kelanang',
    area: 'Banting, Selangor',
    lat: 2.789,
    lng: 101.415,
    severity: null,
    band: null,
    insufficientData: true,


    // 0, not 2. validReports counts Counted reports inside the 90 day window,
    // and this beach's newest report is older than that - so nothing falls
    // inside it. With 2 here the page would show "2 valid reports" next to
    // "Not recently reported", which the contract makes impossible. Mock data
    // that contradicts the contract teaches the wrong thing about the UI.
    validReports: 0,
    // null, never 0. A zero score would read as a measurement of a very clean
    // beach; null is the only honest answer when nothing was measured.
    attentionScore: null,
    eligibleReportCount: 0,
    lastReportedAt: '2026-05-21T08:00:00Z',
    freshnessKind: 'stale',
    habitat: 'Mangrove-lined estuary shore',
    habitatTag: 'MANGROVE',
    sensitivity: 'Evidence still being gathered',
    primarySpeciesGlyph: 'mangrove',
    coverImageUrl: null,
    scene:
      'radial-gradient(90% 55% at 70% 16%,rgba(156,174,168,.35),transparent 60%),linear-gradient(178deg,#2F6B7C 0%,#245A6B 44%,#1B4557 72%,#123244 100%)',

    composition: [
      { category: 'Plastic', quantity: 'Medium' },
      { category: 'Other', quantity: 'Small' },
    ],
    species: [
      {
        name: 'Mangrove Habitat',
        kind: 'habitat',
        scientificName: null,
        // null, never invented. A habitat, not a species - neither FishBase nor OBIS has one.
        threatCategory: null,
        glyph: 'mangrove',
        text: 'Dense mangrove roots trap sediment and shelter juvenile marine life.',
        source: PENDING_SOURCE,
      },
      {
        name: 'Coastal Birds',
        kind: 'group',
        scientificName: null,
        // null, never invented. A group of animals, not one species, so there is no single
        // threat category to quote.
        threatCategory: null,
        glyph: 'bird',
        text: 'Egrets and herons hunt along the shallow channels at low tide.',
        source: PENDING_SOURCE,
      },
    ],
    compositionSource: { reportId: 'r_seed_kelanang', createdAt: '2026-05-21T16:00:00+08:00' },
    ecologicalNote:
      'Litter caught in mangrove roots can persist for years and may break down into microplastics.',
  },
  {
    id: 'bagan',
    name: 'Pantai Bagan Lalang',
    area: 'Sepang, Selangor',
    lat: 2.601,
    lng: 101.688,
    severity: 'High',
    band: 3,
    insufficientData: false,
    validReports: 7,
    attentionScore: 2.55,
    eligibleReportCount: 7,
    lastReportedAt: '2026-07-24T08:00:00Z',
    freshnessKind: 'aging',
    habitat: 'Wide sandy beach & seagrass patches',
    habitatTag: 'SEAGRASS',
    sensitivity: 'Horseshoe crab spawning shore',
    primarySpeciesGlyph: 'crab',
    coverImageUrl: null,
    scene:
      'radial-gradient(110% 60% at 60% 12%,rgba(255,255,255,.45),transparent 58%),linear-gradient(178deg,#E4EEF3 0%,#9CCAD8 34%,#5FA3C4 52%,#D6CFBE 76%,#BFB8A6 100%)',
    composition: [
      { category: 'Plastic', quantity: 'Very Large' },
      { category: 'Fishing gear', quantity: 'Large' },
      { category: 'Glass', quantity: 'Medium' },
      { category: 'Metal', quantity: 'Small' },
      { category: 'Paper', quantity: 'Small' },
      { category: 'Other', quantity: 'Small' },
    ],
    species: [
      {
        name: 'Horseshoe Crab',
        kind: 'species',
        scientificName: 'Carcinoscorpius rotundicauda',
        // null, never invented. OBIS covers horseshoe crabs; FishBase does not.
        threatCategory: null,
        glyph: 'crab',
        text: 'One of the few Selangor shores where mangrove horseshoe crabs still come up to spawn.',
        source: PENDING_SOURCE,
      },
      {
        name: 'Seagrass Patches',
        kind: 'habitat',
        scientificName: null,
        // null, never invented. A habitat, not a species - neither FishBase nor OBIS has one.
        threatCategory: null,
        glyph: 'grass',
        text: 'Seagrass in the shallows feeds and shelters small marine animals.',
        source: PENDING_SOURCE,
      },
      {
        name: 'Mangrove Habitat',
        kind: 'habitat',
        scientificName: null,
        // null, never invented. A habitat, not a species - neither FishBase nor OBIS has one.
        threatCategory: null,
        glyph: 'mangrove',
        text: 'The Sepang river-mouth mangroves sit just south of this beach.',
        source: PENDING_SOURCE,
      },
    ],
    compositionSource: { reportId: 'r_seed_bagan', createdAt: '2026-07-24T16:00:00+08:00' },
    ecologicalNote:
      'Ghost nets and plastic sheeting may trap horseshoe crabs that come ashore to spawn.',
  },
];



// The demo participant. No name, no email - just a number, exactly like a real
// account.
export const MOCK_USER: User = {
  id: 'u_anon_1637',
  participantId: '1637',
  role: 'volunteer',
};

// Four seeded reports covering all three statuses, so My Reports, the status
// tiles and the correction flow all have something real to show on first run.
export const SEED_REPORTS: LitterReport[] = [
  {
    id: 'r1',
    beachId: 'morib',
    beachName: 'Pantai Morib',
    quantities: { Plastic: 'Medium', Glass: 'Small' },
    category: 'Plastic',
    quantity: 'Medium',
    // The working, then the result. Plastic Medium = 0.85 x 2 = 1.7;
    // Glass Small = 0.7 x 1 = 0.7. reportScore is the higher of the two,
    // following the "worst category wins" rule in scoring.ts - not the average.
    categoryScores: { Plastic: 1.7, Glass: 0.7 },
    reportScore: 1.7,
    createdAt: '2026-08-14T02:00:00Z',
    status: 'Counted',
  },
  {
    id: 'r2',
    beachId: 'morib',
    beachName: 'Pantai Morib',
    quantities: { Plastic: 'Small' },
    category: 'Plastic',
    quantity: 'Small',
    categoryScores: { Plastic: 0.85 },
    reportScore: 0.85,
    createdAt: '2026-08-09T02:00:00Z',
    status: 'Duplicate',
    statusNote:
      'Same participant, beach and local day as an existing counted report. Saved here but excluded from the beach score.',
  },
  {
    id: 'r3',
    beachId: 'remis',
    beachName: 'Pantai Remis',
    quantities: { 'Fishing gear': 'Small', Plastic: 'Small' },
    category: 'Fishing gear',
    quantity: 'Small',
    // Fishing gear Small = 1.0 x 1 = 1.0 beats Plastic Small = 0.85 x 1 = 0.85,
    // so it is both the derived category and the report score.
    categoryScores: { 'Fishing gear': 1, Plastic: 0.85 },
    reportScore: 1,
    createdAt: '2026-07-20T02:00:00Z',
    status: 'Counted',
  },
  {
    id: 'r4',
    beachId: 'kelanang',
    beachName: 'Pantai Kelanang',
    quantities: { Other: 'Small' },
    category: 'Other',
    quantity: 'Small',
    categoryScores: { Other: 0.5 },
    reportScore: 0.5,
    createdAt: '2026-07-02T02:00:00Z',
    status: 'Incomplete',
    statusNote: 'Photo unreadable — excluded until you correct and save the report.',
  },
];
