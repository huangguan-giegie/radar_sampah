/** Keep missing evidence distinct from a real zero-day interval. */
export function daysLabel(days: number | null | undefined): string {
  return days == null ? 'Time unavailable' : `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function nextReportLabel(days: number | null | undefined): string {
  if (days == null) return 'Next report recorded · interval unavailable';
  return days === 0 ? 'Next report the same day' : `Next report after ${daysLabel(days)}`;
}

export function recurrenceStatus(status: string, interval: number | null | undefined): string {
  return interval != null ? nextReportLabel(interval) : status;
}

export function recurrenceEstimate(days: number): string {
  return `Early estimate: the next counted report was typically recorded ${days === 0 ? 'the same day' : `after ${daysLabel(days)}`}. This is based on limited follow-up records, not measured litter return.`;
}
