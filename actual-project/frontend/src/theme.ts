

import type { FreshnessKind, ReportStatus, SeverityBand } from './types';


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

export const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Segoe UI,Roboto,sans-serif";
export const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";


export const SEVERITY: Record<SeverityBand, { col: string; text: string; tint: string }> = {
  Low: { col: '#7CA98B', text: '#3E6B52', tint: 'rgba(124,169,139,.18)' },
  Moderate: { col: '#D9A24B', text: '#8A6420', tint: 'rgba(217,162,75,.18)' },
  High: { col: '#CE6B45', text: '#93441F', tint: 'rgba(206,107,69,.16)' },
  Severe: { col: '#B84A3F', text: '#7E2E24', tint: 'rgba(184,74,63,.16)' },
};

export function severityLabel(band: SeverityBand): string {
  return band === 'Severe' ? 'Very high' : band;
}


export function freshStyle(k: FreshnessKind) {
  if (k === 'ok') return { bg: 'rgba(124,169,139,.16)', c: '#3E6B52', dot: '#7CA98B' };
  if (k === 'aging') return { bg: 'rgba(217,162,75,.14)', c: '#8A6420', dot: '#D9A24B' };
  return { bg: 'rgba(30,36,44,.07)', c: C.muted, dot: C.faint };
}


export function statusChip(s: ReportStatus) {
  if (s === 'Counted') return { bg: C.greenBg, c: C.green };
  if (s === 'Incomplete') return { bg: 'rgba(196,87,74,.13)', c: C.red };
  return { bg: 'rgba(30,36,44,.08)', c: C.muted };
}


export const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")";

export function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}


export function lastReportedLabel(iso: string | null): string {
  const d = daysAgo(iso);
  if (d === null) return 'NEVER REPORTED';
  if (d === 0) return 'TODAY';
  if (d === 1) return '1 DAY AGO';
  return `${d} DAYS AGO`;
}


export function freshnessLabel(kind: FreshnessKind, iso: string | null): string {
  const d = daysAgo(iso);
  if (kind === 'ok') return 'Recently reported';
  if (kind === 'stale' || d === null) return 'Not recently reported';
  return `Reported ${d} days ago`;
}

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

export const QUANTITY_DESC: Record<string, string> = {
  Small: 'Fits in one hand',
  Medium: 'About a grocery bag',
  Large: 'Several bags',
  'Very Large': 'Large scattered pile',
};
