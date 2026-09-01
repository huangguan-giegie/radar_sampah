// The shared colours, fonts and small formatting helpers.
//
// Everything visual used in more than one place is defined here, so changing a
// colour is one edit instead of a search across forty files - and so two
// screens cannot end up with two slightly different navies.
//
// The date helpers live here too, because "6 DAYS AGO" is a presentation
// decision, not business logic. The backend sends ISO timestamps and the
// frontend decides how to say them.
import type { FreshnessKind, ReportStatus, SeverityBand } from './types';
import { SCORING_METHOD } from './scoring';

// C is for Colors. C.navy reads better than '#0B2161' at the point of use, and
// it means the hex value exists exactly once.
//
// The names run darkest to lightest - ink, navy, slate, muted, dim, faint,
// mist, pale, cloud - so picking a lighter shade needs no colour picker.
// lime is the single accent, used sparingly and only for emphasis.
export const C = {
  ink: '#1E2421',
  ink2: '#26303F',
  ink3: '#16233E',
  navy: '#0B2161',
  navyHover: '#14317E',
  deep: '#081739',
  slate: '#3E4F6E',
  muted: '#5A6474',
  dim: '#7A879B',
  faint: '#98A4B5',
  mist: '#B7C2D4',
  pale: '#CBD3E0',
  cloud: '#DDE3EC',
  bg: '#F7F8FA',
  white: '#FFFFFF',
  lime: '#B8FF36',
  green: '#177A3E',
  greenBg: '#E9F6EE',
  red: '#9C4237',
  line: 'rgba(11,33,97,.08)',
  line2: 'rgba(11,33,97,.15)',
  tint: 'rgba(11,33,97,.05)',
};

// Two font stacks, both starting with the system font. The device's own
// typeface is already downloaded, so it costs nothing and renders instantly -
// no webfont flash on a slow beach connection. MONO is for numbers and labels,
// where digits lining up in a column matters.
export const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Segoe UI,Roboto,sans-serif";
export const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

// The colour of each severity band, in three versions: `col` for a solid fill,
// `text` for a darker shade that is readable as text, `tint` for a faint
// background. Kept together so a band cannot be given the background of one
// level and the text colour of another.
export const SEVERITY: Record<SeverityBand, { col: string; text: string; tint: string }> = {
  Low: { col: '#7CA98B', text: '#3E6B52', tint: 'rgba(124,169,139,.18)' },
  Moderate: { col: '#D9A24B', text: '#8A6420', tint: 'rgba(217,162,75,.18)' },
  High: { col: '#CE6B45', text: '#93441F', tint: 'rgba(206,107,69,.16)' },
  Severe: { col: '#B84A3F', text: '#7E2E24', tint: 'rgba(184,74,63,.16)' },
};

/**
 * What to CALL a band on screen.
 *
 * The data keeps 'Severe', because that is the word in the contract and in the
 * database. The user is shown "Very high". "Severe" sounds like an official
 * hazard warning, which is a claim we cannot make from volunteer litter counts
 * - we are describing how much rubbish was reported, not declaring a danger.
 *
 * Doing it here, rather than renaming the type, keeps the wording a
 * presentation choice we can revise without touching the backend contract.
 */
export function severityLabel(band: SeverityBand): string {
  return band === 'Severe' ? 'Very high' : band;
}

/**
 * Whether a beach is allowed to show a severity band at all, and what to say
 * when it is not.
 *
 * A band needs at least SCORING_METHOD.minReports counted reports behind it.
 * Under that we say "Insufficient data" and show how many reports there are so
 * far, because a band drawn from one report looks exactly as confident as one
 * drawn from fifty and the reader cannot tell them apart.
 *
 * Two labels come back because map pins shout in capitals and pages do not.
 * Every screen asks this one function, so the same beach can never read "Low"
 * on the map and "Insufficient data" on its own page.
 */
export function attentionStateFor(
  severity: SeverityBand | null,
  insufficientData: boolean,
  validReports: number,
) {
  const minimum = SCORING_METHOD.minReports;
  const reportWord = validReports === 1 ? 'report' : 'reports';
  if (insufficientData || validReports < minimum || !severity) {
    return {
      markerLabel: 'NO DATA',
      pageLabel: 'Insufficient data',
      detail: `${validReports} counted ${reportWord} · At least ${minimum} counted reports are required for a band`,
      hasBand: false,
    } as const;
  }
  return {
    markerLabel: severityLabel(severity).toUpperCase(),
    pageLabel: severityLabel(severity),
    detail: null,
    hasBand: true,
  } as const;
}

// Freshness colours: green means somebody reported recently, amber means it is
// getting old, grey means nothing for a long time.
//
// Grey and not red on purpose. Old data is not an alarm - it means we do not
// know, and a red badge would read as a finding about the beach itself.
export function freshStyle(k: FreshnessKind) {
  if (k === 'ok') return { bg: 'rgba(124,169,139,.16)', c: '#3E6B52', dot: '#7CA98B' };
  if (k === 'aging') return { bg: 'rgba(217,162,75,.14)', c: '#8A6420', dot: '#D9A24B' };
  return { bg: 'rgba(30,36,44,.07)', c: C.muted, dot: C.faint };
}

// Report status colours. Duplicate is grey rather than red: it is not a
// mistake by the volunteer, just a record we already had.
export function statusChip(s: ReportStatus) {
  if (s === 'Counted') return { bg: C.greenBg, c: C.green };
  if (s === 'Incomplete') return { bg: 'rgba(196,87,74,.13)', c: C.red };
  return { bg: 'rgba(30,36,44,.08)', c: C.muted };
}

/** A film-grain texture, inlined as an SVG data URL rather than an image file.
 *  It costs no extra request and cannot 404 - which matters because it sits
 *  over the gradient placeholders on beaches that have no photo. */
export const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")";

/** Whole days between now and an ISO timestamp. null in means null out - the
 *  caller has to handle "never reported", which is a real state here and must
 *  not silently become 0 days. */
export function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** The "6 DAYS AGO" text on chips and pins. "NEVER REPORTED" is its own
 *  answer, never "0 DAYS AGO" - those mean opposite things. */
export function lastReportedLabel(iso: string | null): string {
  const d = daysAgo(iso);
  if (d === null) return 'NEVER REPORTED';
  if (d === 0) return 'TODAY';
  if (d === 1) return '1 DAY AGO';
  return `${d} DAYS AGO`;
}

/** The longer freshness wording on cards. All three phrases are about the
 *  DATA, never about the beach: "not recently reported" says what we do not
 *  know, where "clean" would claim something we never measured. */
export function freshnessLabel(kind: FreshnessKind, iso: string | null): string {
  const d = daysAgo(iso);
  if (kind === 'ok') return 'Recently reported';
  if (kind === 'stale' || d === null) return 'Not recently reported';
  return `Reported ${d} days ago`;
}

/** A date a person can read. "Today" for today, otherwise "5 Sep 2026".
 *  en-GB because the app is used in Malaysia, where 5/9 means 5 September -
 *  the US default would silently turn that into 9 May. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return 'Today';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Everyday descriptions of the four amounts, shown as tooltips on the record
// screen. "About a grocery bag" is something two different volunteers will
// judge roughly the same way; "Medium" on its own is not.
export const QUANTITY_DESC: Record<string, string> = {
  Small: 'Fits in one hand',
  Medium: 'About a grocery bag',
  Large: 'Several bags',
  'Very Large': 'Large scattered pile',
};
