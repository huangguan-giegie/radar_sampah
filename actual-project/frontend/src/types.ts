
// Every data type in the app. This file IS the contract between the frontend
// and the backend: it says exactly what the data looks like (see API.md).
//
// Why this matters: the screens never touch raw JSON. They only ever see the
// types below. So if the backend renames a field, we change TWO files -
// this one and src/api.ts - and no screen has to change at all.
//
// Rule of thumb when reading this file: a comment that says "must" or "never"
// is a rule we agreed with the backend or the DMP, not a preference.

/** How bad a beach is. Four levels, nothing in between, nothing else. */
export type SeverityBand = 'Low' | 'Moderate' | 'High' | 'Severe';
/** The six kinds of litter a volunteer can record. Weights are in scoring.ts. */
export type LitterCategory = 'Plastic' | 'Fishing gear' | 'Glass' | 'Metal' | 'Paper' | 'Other';
/** How much litter. Bands, not numbers - volunteers estimate by eye. */
export type QuantityBand = 'Small' | 'Medium' | 'Large' | 'Very Large';
/**
 * What happened to a submitted report.
 *   Counted     it is used in the beach score
 *   Duplicate   somebody already reported this spot at this time
 *   Incomplete  something required was missing
 * The backend uses these same three words, so do not rename them here alone.
 */
export type ReportStatus = 'Counted' | 'Duplicate' | 'Incomplete';
/** How old the newest report is, so the UI can say "this may be out of date". */
export type FreshnessKind = 'ok' | 'aging' | 'stale';
/** The map has two layers. The user sees one at a time; they never merge. */
export type MapLayer = 'litter' | 'bio';

/** Which line drawing to show for a species. Picked in components/Icon.tsx. */
export type SpeciesGlyph = 'turtle' | 'bird' | 'mangrove' | 'grass' | 'crab' | 'fish';

/**
 * The output of the Epic 5 species model (Su's work, shipped in Iteration 1).
 *
 * WARNING - this is NOT a probability, and the UI must never print a % sign
 * next to it. The model was trained on OBIS presence records, generated
 * background points and latitude/longitude only. What comes out is an
 * uncalibrated "relative occurrence score". Saying "70% chance of turtles"
 * would be claiming something we did not measure.
 *
 * It covers four species: green turtle, clown anemonefish, Irrawaddy dolphin
 * and the sickle butterflyfish.
 */
export interface SpeciesLikelihood {
  /**
   * ready        the model is connected and score has a value
   * pending      this species IS in scope, but the backend is not wired yet
   * unavailable  this species is not one of the four - there will never be a
   *              number for it in this iteration
   *
   * pending and unavailable are kept apart on purpose. One means "not done
   * yet", the other means "cannot be done". Showing the same empty box for
   * both would hide the difference from the marker and from the user.
   */
  state: 'ready' | 'pending' | 'unavailable';
  /** Relative occurrence score, 0-100. NOT a probability. Only when ready. */
  score?: number;
  /** Where the number came from. Printed as-is in the UI, never left blank. */
  basis: string;
}

/**
 * Is this card about one species, a habitat, or a whole group of animals?
 * Only 'species' can have a scientific name and a threat level. A habitat
 * ("mangrove") or a group ("shorebirds") has neither, so the UI hides those
 * rows instead of printing an empty label.
 */
export type SpeciesKind = 'species' | 'habitat' | 'group';

/** Which open dataset the row came from. The DMP register allows only these. */
export type SourceDataset = 'FishBase' | 'OBIS' | 'other' | 'pending';

/**
 * Where a piece of biodiversity data came from.
 *
 * CC BY-NC forces us to show the credit, and DMP section 9 forces us to keep
 * the source URL and the access date. That is why all three are fields on the
 * data, not comments in the code - a comment cannot be rendered to the user.
 */
export interface SpeciesSource {
  dataset: SourceDataset;
  /** The full credit line, shown to the user word for word. */
  citation: string;
  url: string | null;
  /** ISO date. DMP section 9: preserve source URLs and access dates. */
  accessedAt: string | null;
}

export interface Species {
  name: string;
  kind: SpeciesKind;
  /** Latin name. null for habitats and groups - they do not have one. */
  scientificName: string | null;
  /** Threat level, from FishBase. null if we did not get it - never guess. */
  threatCategory: string | null;
  glyph: SpeciesGlyph;
  text: string;
  source: SpeciesSource;
  /** FishBase picture_url. The photo copyright is separate from the dataset
   *  licence, so it must be cleared on its own before we display it. */
  pictureUrl?: string | null;
  /** null or missing when there is no model output; the UI then falls back to
   *  the plain description with no score. */
  likelihood?: SpeciesLikelihood | null;
}

/**
 * One row of the litter composition bar on the beach page.
 *
 * Composition comes from the SINGLE most recent Counted report for that beach
 * (its six category columns), not from an average over the window. Averaging
 * would let one very old report keep colouring the bar forever, and there is
 * no honest date to print next to an average.
 *
 * Only categories that were actually recorded appear, sorted by category
 * weight, heaviest first.
 */
export interface CompositionSlice {
  category: LitterCategory;
  quantity: QuantityBand;
}

/** Which report the composition came from. The UI must print this date, so it
 *  can never claim to be "the share across N reports". */
export interface CompositionSource {
  reportId: string;
  createdAt: string;
}

/** The small version of a beach, used by the map and the home list. */
export interface BeachSummary {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  /** null when there are fewer than 3 valid reports. null does NOT mean
   *  "clean" - it means "not enough evidence". The UI must say so. */
  severity: SeverityBand | null;
  /** 1-4, used to draw the severity bars. null whenever severity is null. */
  band: number | null;
  insufficientData: boolean;
  validReports: number;
  /** The raw number the band was derived from: the median of this beach's
   *  eligible report scores. null exactly when severity is null. Published
   *  alongside the band so the rule on the method page can be checked against
   *  a real figure instead of taken on trust. */
  attentionScore: number | null;
  /** How many reports actually went into that median. Sent separately from
   *  validReports so the two can never silently disagree about the window. */
  eligibleReportCount: number;
  /** ISO 8601. Used to work out "reported 5 days ago". */
  lastReportedAt: string | null;
  freshnessKind: FreshnessKind;
  /** Biodiversity layer fields. */
  habitat: string;
  habitatTag: string;
  sensitivity: string;
  /** The icon drawn on the biodiversity map pin. */
  primarySpeciesGlyph: SpeciesGlyph;
  /**
   * Names of the species cards for this beach, in sort_order.
   *
   * The biodiversity layer shows these directly on the map. Without them the
   * layer would only show habitats, so a user could look at the whole map and
   * not see a single animal named - they would have to open a beach first.
   *
   * Names only. The full cards stay in BeachDetail.species.
   */
  speciesNames: string[];
  /** A real cover photo. null when the backend has none, and then the UI
   *  falls back to the scene gradient below. */
  coverImageUrl: string | null;
  /** CSS gradient used when there is no cover photo. Sent by the backend so
   *  the placeholder for a beach is always the same colour everywhere. */
  scene: string;
}

/**
 * The full beach, used by the beach detail page.
 *
 * It does NOT carry speciesNames: it already has the complete species[], so
 * the names can be read from there. The same fact is never stored twice, or
 * the two copies will disagree one day.
 */
export interface BeachDetail extends Omit<BeachSummary, 'speciesNames'> {
  composition: CompositionSlice[] | null;
  /** null exactly when composition is null - they are always sent together. */
  compositionSource: CompositionSource | null;
  species: Species[];
  ecologicalNote: string;
}

/** The published scoring rules, so the "How the score works" page can print
 *  them instead of hard-coding the same numbers a second time. */
export interface ScoringMethod {
  categoryWeights: { category: LitterCategory; weight: number }[];
  quantityWeights: { quantity: QuantityBand; weight: number }[];
  bands: { band: SeverityBand; range: string; color: string }[];
  /** Length of the scoring window in days - the "90 days" in the UI text. */
  windowDays: number;
  /** Valid reports needed before we show a band - the "fewer than three". */
  minReports: number;
  /**
   * How the six category scores inside ONE report become one number: the
   * worst category wins. A report of "a mountain of fishing gear and one
   * paper cup" must not be averaged down into something mild.
   */
  reportAggregation: 'max';
  /**
   * How a beach's reports become one number: the median, not the mean. One
   * unusually bad day cannot drag a whole beach up on its own, which matters
   * because anyone can file a report and we publish the result.
   *
   * These two are typed as literals, not as string, so the compiler rejects a
   * backend payload that quietly switches to a different rule.
   */
  beachAggregation: 'median';
  /** Names the exact rule set a score was produced under. When the rules
   *  change, old scores can still be identified as old rather than silently
   *  compared against numbers computed a different way. */
  ruleVersion: string;
}

export interface LitterReport {
  id: string;
  beachId: string;
  beachName: string;
  /** Which categories this report actually recorded. When the volunteer edits
   *  the report we refill the form from this; without it, any category they
   *  did not touch would be wiped. */
  quantities: QuantityByCategory;
  /** Derived: the heaviest category in quantities. */
  category: LitterCategory;
  /** Derived: the band recorded for that heaviest category. */
  quantity: QuantityBand;
  /** category weight x quantity weight, per category. Kept so the arithmetic
   *  can be shown, not just its result - a published score nobody can take
   *  apart is a score nobody can check. */
  categoryScores: Partial<Record<LitterCategory, number>>;
  /** This report's single score: the highest of the categoryScores above,
   *  following reportAggregation. */
  reportScore: number;
  /** Display date. The backend sends ISO, the frontend formats it. */
  createdAt: string;
  status: ReportStatus;
  /** How the beach was decided when the report was filed: 'gps' = from the
   *  device location, 'manual' = the user picked it. Only the label comes
   *  back here, never the coordinates. Optional, because reports filed before
   *  we recorded this have nothing to send. */
  locationSource?: 'gps' | 'manual';
  /** Why it was not counted. Written by the backend, printed as-is, so the
   *  volunteer is never left guessing what went wrong. */
  statusNote?: string | null;
  /** Short-lived signed URL, and only the person who filed the report can get
   *  it. Do not cache it - it expires. */
  photoUrl?: string | null;
  /** The storage key of the same photo. Unlike photoUrl this does not expire,
   *  so it is what we keep to ask for a fresh URL later. Still not something
   *  you can open on its own - see UploadedPhoto.photoKey. */
  photoKey?: string | null;
}

/**
 * One quantity band per category, for a single report.
 *
 * The keys are the LitterCategory strings; the backend maps them onto the six
 * qty_* columns on reports. At least one entry is required, which matches the
 * reports_at_least_one_category constraint in the database - the same rule is
 * enforced on both sides, so neither side has to trust the other.
 */
export type QuantityByCategory = Partial<Record<LitterCategory, QuantityBand>>;

export interface CreateReportInput {
  beachId: string;
  /** At least one entry. The backend derives category, quantity and the scores
   *  from this, so the frontend does not send them - one source of truth. */
  quantities: QuantityByCategory;
  /** The storage key returned by the upload endpoint. */
  photoKey: string;
  /** 'gps' = worked out from the device location, 'manual' = the user picked. */
  locationSource: 'gps' | 'manual';
  /** Sent only when locationSource is 'gps'. The backend uses it to match a
   *  beach and to spot duplicates, and never publishes it - exact coordinates
   *  could show where a volunteer was standing. */
  coords?: { lat: number; lng: number };
}

export interface User {
  id: string;
  /** A participant number such as "1637". We deliberately collect no name and
   *  no email, so there is less personal data to lose. */
  participantId: string;
  role: 'volunteer' | 'moderator';
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface UploadedPhoto {
  /**
   * A storage key, NOT a URL you can open. The bucket sits outside the public
   * web root and is not publicly readable (API.md section 5). We send this key
   * straight back when we submit the report.
   */
  photoKey: string;
  /** For the local preview only. The frontend makes this itself with
   *  URL.createObjectURL - it does not come from the backend. */
  previewUrl: string;
  /** The backend has removed the EXIF location from the photo. The
   *  "LOCATION METADATA REMOVED" line in the UI is driven by this flag. */
  metadataStripped: boolean;
}

/** The three status totals on the account page. */
export interface ReportCounts {
  counted: number;
  duplicate: number;
  incomplete: number;
}
