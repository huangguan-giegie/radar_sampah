import type { QuantityByCategory, ReportStatus } from './types';

const CATEGORY_ORDER = ['Fishing gear', 'Plastic', 'Glass', 'Metal', 'Other', 'Paper'] as const;

export function canShareCountedReport(status: ReportStatus): boolean {
  return status === 'Counted';
}

export function hasActiveCleanupBands(quantities: QuantityByCategory): boolean {
  return Object.values(quantities).some((band) => Boolean(band && band !== 'Small'));
}

export function sharedBandRows(
  reported: QuantityByCategory,
  current: QuantityByCategory,
): Array<{ category: string; reported: string; current: string | null }> {
  return CATEGORY_ORDER
    .filter((category) => Boolean(reported[category]))
    .map((category) => ({
      category,
      reported: reported[category]!,
      current: current[category] ?? null,
    }));
}
