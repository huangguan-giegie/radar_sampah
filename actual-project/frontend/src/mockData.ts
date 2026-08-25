// 假数据。后端做好之后，把 src/api.ts 里的 USE_MOCK 关掉，这个文件就用不到了。
import type { BeachDetail, LitterReport, User } from './types';

/** 设计稿里的四个 MVP 海滩。后端接上后整份文件即可删除。 */
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
      { category: 'Plastic', percent: 46 },
      { category: 'Fishing gear', percent: 22 },
      { category: 'Glass', percent: 12 },
      { category: 'Metal', percent: 9 },
      { category: 'Paper', percent: 6 },
      { category: 'Other', percent: 5 },
    ],
    species: [
      {
        name: 'Green Sea Turtle',
        glyph: 'turtle',
        text: 'Occasional visitor along the Strait of Malacca. Floating plastic may be mistaken for food.',
        source: 'DoF Malaysia · 2024',
        // ⚠️ 占位数字，等 Su 的 Epic 5 模型接进来替换
        likelihood: { percent: 38, basis: 'Habitat match + 2024 sighting records' },
      },
      {
        name: 'Mangrove Fringe',
        glyph: 'mangrove',
        text: 'Young mangroves at the northern end shelter juvenile fish and crabs.',
        source: 'Selangor Forestry · 2023',
      },
      {
        name: 'Coastal Birds',
        glyph: 'bird',
        text: 'Migratory shorebirds feed along this tide line between September and April.',
        source: 'MNS waterbird census · 2024',
        likelihood: { percent: 76, basis: 'Habitat match + seasonal census (Sep–Apr)' },
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
      { category: 'Plastic', percent: 52 },
      { category: 'Fishing gear', percent: 18 },
      { category: 'Paper', percent: 12 },
      { category: 'Glass', percent: 8 },
      { category: 'Metal', percent: 6 },
      { category: 'Other', percent: 4 },
    ],
    species: [
      {
        name: 'Migratory Shorebirds',
        glyph: 'bird',
        text: 'The Jeram mudflats are a stopover for migratory waders crossing the strait.',
        source: 'MNS waterbird census · 2024',
      },
      {
        name: 'Marine Fish',
        glyph: 'fish',
        text: 'Shallow nursery waters for coastal fish species.',
        source: 'DoF Malaysia · 2022',
      },
      {
        name: 'Mangrove Belt',
        glyph: 'mangrove',
        text: 'A narrow mangrove belt lines the river mouth south of the beach.',
        source: 'Selangor Forestry · 2023',
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
    validReports: 2,
    lastReportedAt: '2026-05-21T08:00:00Z',
    freshnessKind: 'stale',
    habitat: 'Mangrove-lined estuary shore',
    habitatTag: 'MANGROVE',
    sensitivity: 'Evidence still being gathered',
    primarySpeciesGlyph: 'mangrove',
    coverImageUrl: null,
    scene:
      'radial-gradient(90% 55% at 70% 16%,rgba(156,174,168,.35),transparent 60%),linear-gradient(178deg,#2F6B7C 0%,#245A6B 44%,#1B4557 72%,#123244 100%)',
    composition: null,
    species: [
      {
        name: 'Mangrove Habitat',
        glyph: 'mangrove',
        text: 'Dense mangrove roots trap sediment and shelter juvenile marine life.',
        source: 'Selangor Forestry · 2023',
      },
      {
        name: 'Coastal Birds',
        glyph: 'bird',
        text: 'Egrets and herons hunt along the shallow channels at low tide.',
        source: 'MNS waterbird census · 2024',
      },
    ],
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
      { category: 'Plastic', percent: 41 },
      { category: 'Fishing gear', percent: 26 },
      { category: 'Glass', percent: 10 },
      { category: 'Metal', percent: 9 },
      { category: 'Paper', percent: 8 },
      { category: 'Other', percent: 6 },
    ],
    species: [
      {
        name: 'Horseshoe Crab',
        glyph: 'crab',
        text: 'One of the few Selangor shores where mangrove horseshoe crabs still come up to spawn.',
        source: 'UPM coastal survey · 2023',
      },
      {
        name: 'Seagrass Patches',
        glyph: 'grass',
        text: 'Seagrass in the shallows feeds and shelters small marine animals.',
        source: 'DoF Malaysia · 2022',
      },
      {
        name: 'Mangrove Habitat',
        glyph: 'mangrove',
        text: 'The Sepang river-mouth mangroves sit just south of this beach.',
        source: 'Selangor Forestry · 2023',
      },
    ],
    ecologicalNote:
      'Ghost nets and plastic sheeting may trap horseshoe crabs that come ashore to spawn.',
  },
];


// 匿名用户。没有姓名和邮箱，只有一个参与者编号。
export const MOCK_USER: User = {
  id: 'u_anon_1637',
  participantId: '1637',
  role: 'volunteer',
};

export const SEED_REPORTS: LitterReport[] = [
  {
    id: 'r1',
    beachId: 'morib',
    beachName: 'Pantai Morib',
    category: 'Plastic',
    quantity: 'Medium',
    createdAt: '2026-08-14T02:00:00Z',
    status: 'Counted',
  },
  {
    id: 'r2',
    beachId: 'morib',
    beachName: 'Pantai Morib',
    category: 'Plastic',
    quantity: 'Small',
    createdAt: '2026-08-09T02:00:00Z',
    status: 'Duplicate',
    statusNote:
      'Matched an existing record for the same beach on the same day — excluded from the severity calculation.',
  },
  {
    id: 'r3',
    beachId: 'remis',
    beachName: 'Pantai Remis',
    category: 'Fishing gear',
    quantity: 'Small',
    createdAt: '2026-07-20T02:00:00Z',
    status: 'Counted',
  },
  {
    id: 'r4',
    beachId: 'kelanang',
    beachName: 'Pantai Kelanang',
    category: 'Other',
    quantity: 'Small',
    createdAt: '2026-07-02T02:00:00Z',
    status: 'Incomplete',
    statusNote: 'Photo unreadable — excluded until you correct and save the record.',
  },
];
