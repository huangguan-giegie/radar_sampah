import { apiRequest } from './api';
import type { SeverityBand } from './types';

export interface InsightBeach {
  id: string;
  name: string;
  area: string;
  photo: string | null;
  from: SeverityBand | null;
  to: SeverityBand | null;
  reports: number;
  activeReports: number;
  reportsLast30Days: number;
  reportsPrevious30Days: number;
  attentionScore: number | null;
  needsHelp: boolean;
  monthlyReports: { month: string; label: string; count: number }[];
  composition: [string, number][];
  habitat: string;
  speciesNames: string[];
}

export interface InsightCleanup {
  id: string;
  beachId: string;
  beachName: string;
  targetReportId: string | null;
  eventId: string | null;
  createdAt: string;
  handling: string;
  rows: { category: string; beforeBand?: string; afterBand?: string; removedBand?: string }[];
  linked: boolean;
  nextReportedAt: string | null;
  daysUntilNextReport: number | null;
  daysSinceCleanup: number | null;
}

export interface InsightsData {
  asOf: string;
  windowDays: number;
  comparisonAt: string;
  comparisonBasis: string;
  overview: {
    reports: number; cleanups: number; joined: number; needHelp: number;
    registeredBeaches: number; beachesWithReports: number; beachesWithBand: number;
  };
  trendSummary: { changed: number; movedUp: number; movedDown: number; noBand: number; comparable: number };
  beaches: InsightBeach[];
  cleanup: {
    total: number;
    evaluatedCleanups: number;
    remaining: [string, number, number][];
    handling: [string, number][];
    history: InsightCleanup[];
  };
  participation: Record<string, [number, number, number]>;
  participationBasis: string;
  wildlife: { beachId: string; name: string; habitat: string; species: string[]; activeReports: number; composition: [string, number][] }[];
}

export function fetchInsights(beachId?: string): Promise<InsightsData> {
  return apiRequest(`/insights${beachId ? '?beachId=' + encodeURIComponent(beachId) : ''}`);
}
