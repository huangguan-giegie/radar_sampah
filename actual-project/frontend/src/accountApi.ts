import { apiRequest, getMyReportCounts, getMyReports, USE_MOCK } from './api';
import { fetchCleanupEvents } from './iteration2Api';
import { readPreviewProfile, savePreviewProfile, validNickname } from './accountPreview';

export interface AccountProfile {
  nickname: string;
  joinedLeaderboard: boolean;
  points: number;
  rank: number | null;
}
export interface Contribution {
  kind: 'report' | 'attendance';
  id: string;
  beachId: string;
  beachName: string;
  createdAt: string;
  points: number;
}
export interface Contributions {
  points: number;
  countedReports: number;
  attendanceCount: number;
  reportCount: number;
  reportCounts: { counted: number; duplicate: number; incomplete: number };
  history: Contribution[];
  asOf: string;
}
export interface Leaderboard {
  entries: { nickname: string; points: number; rank: number }[];
  asOf: string;
}

export async function getContributions(participantId: string): Promise<Contributions> {
  if (!USE_MOCK) return apiRequest('/account/contributions');
  const [counts, reports, events] = await Promise.all([
    getMyReportCounts(), getMyReports(), fetchCleanupEvents(participantId, true),
  ]);
  const attendance = events.filter(e => e.attendanceConfirmed || e.attendanceBy?.includes(participantId));
  const history: Contribution[] = [
    ...reports.filter(r => r.status === 'Counted').map(r => ({
      kind: 'report' as const, id: r.id, beachId: r.beachId, beachName: r.beachName,
      createdAt: r.createdAt, points: 1,
    })),
    ...attendance.map(e => ({
      kind: 'attendance' as const, id: e.id, beachId: e.beachId, beachName: e.beachName,
      createdAt: `${e.date}T${e.startsAt}:00+08:00`, points: 5,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { points: counts.counted + attendance.length * 5, countedReports: counts.counted,
    attendanceCount: attendance.length, reportCount: reports.length, reportCounts: counts,
    history, asOf: new Date().toISOString() };
}

export async function getAccountProfile(participantId: string): Promise<AccountProfile> {
  if (!USE_MOCK) return apiRequest('/account/profile');
  const summary = await getContributions(participantId);
  return { ...readPreviewProfile(participantId), points: summary.points, rank: null };
}

export async function updateAccountProfile(
  participantId: string,
  input: Partial<Pick<AccountProfile, 'nickname' | 'joinedLeaderboard'>>,
): Promise<AccountProfile> {
  if (!USE_MOCK) return apiRequest('/account/profile', 'PATCH', input);
  const old = readPreviewProfile(participantId);
  const next = { ...old, ...input };
  if (input.nickname !== undefined && !validNickname(input.nickname)
      || next.joinedLeaderboard && !validNickname(next.nickname)) {
    throw new Error('Use 3–30 characters. Don’t use an email address or phone number.');
  }
  next.nickname = next.nickname.trim();
  savePreviewProfile(participantId, next);
  return getAccountProfile(participantId);
}

export async function getLeaderboard(): Promise<Leaderboard> {
  if (!USE_MOCK) return apiRequest('/leaderboard', 'GET', undefined, 15_000, false);
  return { entries: [
    { nickname: 'PenyuPal', points: 184, rank: 1 },
    { nickname: 'KakiPantai', points: 176, rank: 2 },
    { nickname: 'PantaiPatrol', points: 151, rank: 3 },
    { nickname: 'SabahShores', points: 139, rank: 4 },
    { nickname: 'TerengganuTides', points: 127, rank: 5 },
  ], asOf: '2026-09-27T00:00:00+08:00' };
}
