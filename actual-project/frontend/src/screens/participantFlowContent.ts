import type { LitterReport, QuantityByCategory } from '../types';

export const REPORT_TABS = ['All', 'Counted', 'Excluded'] as const;
export type ReportTab = typeof REPORT_TABS[number];

export function reportTab(value: string | null): ReportTab {
  return REPORT_TABS.find((tab) => tab === value) ?? 'All';
}

export function onlySmallQuantities(quantities: QuantityByCategory): boolean {
  const bands = Object.values(quantities);
  return bands.length > 0 && bands.every((band) => band === 'Small');
}

export function countsTowardBeach(report: LitterReport): boolean {
  return report.status === 'Counted' && report.currentState !== 'resolved' && report.currentState !== 'excluded';
}

export function newestReports(reports: LitterReport[]): LitterReport[] {
  return [...reports].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function contributionMonths<T extends { createdAt: string }>(entries: T[]): { month: string; entries: T[] }[] {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', month: 'long', year: 'numeric',
  });
  const groups = new Map<string, T[]>();
  for (const entry of [...entries].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))) {
    const month = formatter.format(new Date(entry.createdAt));
    const rows = groups.get(month) ?? [];
    rows.push(entry);
    groups.set(month, rows);
  }
  return [...groups].map(([month, rows]) => ({ month, entries: rows }));
}
