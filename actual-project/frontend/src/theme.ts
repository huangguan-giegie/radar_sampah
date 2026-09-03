// Shared colours, fonts and the small formatting helpers that go with them.
//
// Anything visual used on more than one screen lives here, so changing a colour
// is one edit and two screens cannot drift to slightly different navies.
// The date helpers sit here too: "6 DAYS AGO" is wording, not business logic.
// The backend sends ISO timestamps, the frontend decides how to say them.
import type { FreshnessKind, ReportStatus, SeverityBand } from './types';
import { SCORING_METHOD } from './scoring';


// C is for colours. C.navy reads better than '#0B2161' where it is used, and
// the hex value then exists in exactly one place. The names run dark to light -
// ink, navy, slate, muted, dim, faint, mist, pale, cloud - so reaching for a
// lighter shade needs no colour picker. lime is the one accent, used sparingly.
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

// Both stacks start with the system font. The device already has it, so there
// is nothing to download and no flash of the wrong typeface on a slow beach
// connection. MONO is for numbers and labels, where digits must line up.
export const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Segoe UI,Roboto,sans-serif";
export const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";


// Every band in three shades: `col` fills, `text` is dark enough to read, and
// `tint` is the faint background. They are kept in one object so a band cannot
// end up with one level's background and another level's text.
export const SEVERITY: Record<SeverityBand, { col: string; text: string; tint: string }> = {
  Low: { col: '#7CA98B', text: '#3E6B52', tint: 'rgba(124,169,139,.18)' },
  Moderate: { col: '#D9A24B', text: '#8A6420', tint: 'rgba(217,162,75,.18)' },
  High: { col: '#CE6B45', text: '#93441F', tint: 'rgba(206,107,69,.16)' },
  Severe: { col: '#B84A3F', text: '#7E2E24', tint: 'rgba(184,74,63,.16)' },
};

/**
 * The data keeps 'Severe', because that is the word in the contract and in the
 * database. Screens say "Very high" instead. "Severe" sounds like an official
 * hazard warning, and volunteer litter counts cannot support that claim.
 * Renaming here keeps it wording we can revise without touching the backend.
 */
export function severityLabel(band: SeverityBand): string {
  return band === 'Severe' ? 'Very high' : band;
}

/**
 * Whether a beach may show a band at all, and what to say when it may not.
 *
 * Below SCORING_METHOD.minReports counted reports the answer is "Insufficient
 * data" plus the count so far, because a band drawn from one report looks just
 * as confident as one drawn from fifty. Two labels come back because pins
 * shout and pages do not. Every screen asks this one function, so a beach
 * cannot read "Low" on the map and "Insufficient data" on its own page.
 */
export function attentionStateFor(
  severity: SeverityBand | null,
  insufficientData: boolean,
  validReports: number,
) {
  const minimum = SCORING_METHOD.minReports;
  const word = reportWord(validReports);
  if (insufficientData || validReports < minimum || !severity) {
    return {
      markerLabel: 'NO DATA',
      pageLabel: 'Insufficient data',
      detail: `${validReports} counted ${word} · At least ${minimum} counted reports are required for a band`,
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


/**
 * How old the newest report is. Deliberately NOT the severity palette - these
 * were once bit-identical to Low and Moderate, so a beach rated HIGH carried a
 * green chip that read as "fine". Freshness describes our data, not the beach.
 */
export function freshStyle(k: FreshnessKind) {
  if (k === 'ok') return { bg: 'rgba(62,79,110,.12)', c: '#3E4F6E', dot: '#5A6E96' };
  if (k === 'aging') return { bg: 'rgba(122,135,155,.16)', c: '#5A6474', dot: '#8794AD' };
  return { bg: 'rgba(30,36,44,.07)', c: C.muted, dot: C.faint };
}

/**
 * "report" or "reports" for a count. One shared helper, because the same
 * sentence is built on the home list, the map card and the beach page, and
 * three hand-written copies drifted - the live site was showing
 * "1 counted reports".
 */
export function reportWord(count: number): string {
  return count === 1 ? 'report' : 'reports';
}


// Report status colours. Duplicate is grey, not red: it is not a mistake by
// the volunteer, just a record we already had.
export function statusChip(s: ReportStatus) {
  if (s === 'Counted') return { bg: C.greenBg, c: C.green };
  if (s === 'Incomplete') return { bg: 'rgba(196,87,74,.13)', c: C.red };
  return { bg: 'rgba(30,36,44,.08)', c: C.muted };
}


/** Film grain, inlined as an SVG data URL rather than an image file. It costs
 *  no extra request and cannot 404 - which matters, because it sits over the
 *  gradient placeholder on beaches that have no photo. */
export const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")";

/** Whole days between now and an ISO timestamp. null in, null out: the caller
 *  must handle "never reported", a real state here that must not quietly
 *  become 0 days. */
export function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}


/** The "6 DAYS AGO" text on chips and pins. "NEVER REPORTED" is its own
 *  answer and never "0 DAYS AGO" - those two mean opposite things. */
export function lastReportedLabel(iso: string | null): string {
  const d = daysAgo(iso);
  if (d === null) return 'NEVER REPORTED';
  if (d === 0) return 'TODAY';
  if (d === 1) return '1 DAY AGO';
  return `${d} DAYS AGO`;
}


/** The longer freshness wording on cards. All three phrases describe the DATA,
 *  never the beach: "not recently reported" says what we do not know, where
 *  "clean" would claim something nobody measured. */
export function freshnessLabel(kind: FreshnessKind, iso: string | null): string {
  const d = daysAgo(iso);
  if (kind === 'ok') return 'Recently reported';
  if (kind === 'stale' || d === null) return 'Not recently reported';
  return `Reported ${d} days ago`;
}

/** A date a person can read: "Today", otherwise "5 Sep 2026". en-GB because
 *  the app is used in Malaysia, where 5/9 means 5 September - the US default
 *  would silently turn that into 9 May. */
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

// Everyday descriptions of the four amounts, shown on the record screen. Two
// volunteers will judge "about a grocery bag" roughly the same way; "Medium"
// on its own they will not.
export const QUANTITY_DESC: Record<string, string> = {
  Small: 'Fits in one hand',
  Medium: 'About a grocery bag',
  Large: 'Several bags',
  'Very Large': 'Large scattered pile',
};
