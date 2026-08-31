


export type SeverityBand = 'Low' | 'Moderate' | 'High' | 'Severe';
export type LitterCategory = 'Plastic' | 'Fishing gear' | 'Glass' | 'Metal' | 'Paper' | 'Other';
export type QuantityBand = 'Small' | 'Medium' | 'Large' | 'Very Large';
export type ReportStatus = 'Counted' | 'Duplicate' | 'Incomplete';
export type FreshnessKind = 'ok' | 'aging' | 'stale';
export type MapLayer = 'litter' | 'bio';


export type SpeciesGlyph = 'turtle' | 'bird' | 'mangrove' | 'grass' | 'crab' | 'fish';



export interface SpeciesLikelihood {

  state: 'ready' | 'pending' | 'unavailable';

  score?: number;

  basis: string;
}


export type SpeciesKind = 'species' | 'habitat' | 'group';


export type SourceDataset = 'FishBase' | 'OBIS' | 'other' | 'pending';


export interface SpeciesSource {
  dataset: SourceDataset;

  citation: string;
  url: string | null;

  accessedAt: string | null;
}

export interface Species {
  name: string;
  kind: SpeciesKind;

  scientificName: string | null;

  threatCategory: string | null;
  glyph: SpeciesGlyph;
  text: string;
  source: SpeciesSource;

  pictureUrl?: string | null;

  likelihood?: SpeciesLikelihood | null;
}


export interface CompositionSlice {
  category: LitterCategory;
  quantity: QuantityBand;
}


export interface CompositionSource {
  reportId: string;
  createdAt: string;
}


export interface BeachSummary {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;

  severity: SeverityBand | null;

  band: number | null;
  insufficientData: boolean;
  validReports: number;
  attentionScore: number | null;
  eligibleReportCount: number;

  lastReportedAt: string | null;
  freshnessKind: FreshnessKind;

  habitat: string;
  habitatTag: string;
  sensitivity: string;

  primarySpeciesGlyph: SpeciesGlyph;

  speciesNames: string[];

  coverImageUrl: string | null;

  scene: string;
}



export interface BeachDetail extends Omit<BeachSummary, 'speciesNames'> {
  composition: CompositionSlice[] | null;

  compositionSource: CompositionSource | null;
  species: Species[];
  ecologicalNote: string;
}

export interface ScoringMethod {
  categoryWeights: { category: LitterCategory; weight: number }[];
  quantityWeights: { quantity: QuantityBand; weight: number }[];
  bands: { band: SeverityBand; range: string; color: string }[];

  windowDays: number;

  minReports: number;

  reportAggregation: 'max';
  beachAggregation: 'median';
  ruleVersion: string;
}

export interface LitterReport {
  id: string;
  beachId: string;
  beachName: string;

  quantities: QuantityByCategory;

  category: LitterCategory;

  quantity: QuantityBand;

  categoryScores: Partial<Record<LitterCategory, number>>;
  reportScore: number;

  createdAt: string;
  status: ReportStatus;

  locationSource?: 'gps' | 'manual';

  statusNote?: string | null;

  photoUrl?: string | null;
  photoKey?: string | null;
}


export type QuantityByCategory = Partial<Record<LitterCategory, QuantityBand>>;

export interface CreateReportInput {
  beachId: string;

  quantities: QuantityByCategory;

  photoKey: string;

  locationSource: 'gps' | 'manual';

  coords?: { lat: number; lng: number };
}

export interface User {
  id: string;

  participantId: string;
  role: 'volunteer' | 'moderator';
}

export interface AuthSession {
  token: string;
  user: User;
}


export interface UploadedPhoto {

  photoKey: string;

  previewUrl: string;

  metadataStripped: boolean;
}

export interface ReportCounts {
  counted: number;
  duplicate: number;
  incomplete: number;
}
