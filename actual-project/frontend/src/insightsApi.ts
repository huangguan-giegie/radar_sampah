import { apiRequest } from './api';
import type { SeverityBand } from './types';

const INSIGHTS_CACHE_TTL_MS = 60_000;
const insightsCache = new Map<string, { value: InsightsData; expiresAt: number }>();
const insightsInFlight = new Map<string, Promise<InsightsData>>();

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
  eventId: string | null;
  createdAt: string;
  handling: string;
  rows: { category: string; beforeBand?: string; afterBand?: string; removedBand?: string }[];
  linked: boolean;
  nextReportedAt: string | null;
  daysUntilNextReport: number | null;
  daysSinceCleanup: number | null;
  followUpStatus?: string;
}

export interface InsightsData {
  asOf: string;
  windowDays: number;
  comparisonAt: string;
  comparisonBasis: string;
  overview: {
    reports: number; cleanups: number; joined: number | string; needHelp: number;
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
  participation: Record<string, [number | string, number | string, number | string]>;
  participationBasis: string;
  wildlife: { beachId: string; name: string; habitat: string; species: string[]; activeReports: number; composition: [string, number][] }[];
}

export function invalidateInsightsCache(): void {
  insightsCache.clear();
  insightsInFlight.clear();
}

export function fetchInsights(beachId?: string): Promise<InsightsData> {
  const key = beachId ?? '__all__';
  const cached = insightsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  const inFlight = insightsInFlight.get(key);
  if (inFlight) return inFlight;
  const request = apiRequest<InsightsData>(`/insights${beachId ? '?beachId=' + encodeURIComponent(beachId) : ''}`)
    .then((value) => {
      insightsCache.set(key, { value, expiresAt: Date.now() + INSIGHTS_CACHE_TTL_MS });
      return value;
    })
    .finally(() => {
      if (insightsInFlight.get(key) === request) insightsInFlight.delete(key);
    });
  insightsInFlight.set(key, request);
  return request;
}
