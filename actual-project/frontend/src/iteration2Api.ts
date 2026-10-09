import { apiRequest, ApiError, getMe, invalidateBeaches, USE_MOCK } from './api';
import {
  completeCleanup,
  createAdminEvent,
  eventCleanups,
  getCleanup,
  getCleanupEvent,
  getCleanupForTarget,
  getCleanupTarget,
  getLatestCleanupForBeach,
  joinCleanupEvent,
  leaveCleanupEvent,
  listCleanupEvents,
  recordAttendance,
  recordCheckIn,
  recordEventReportEvidence,
  type CheckInState,
  type CleanupAction,
  type CleanupEvent,
  type CleanupHandling,
  type CleanupTarget,
} from './iteration2';
import type { CleanupAfterBand, LitterCategory } from './types';

/** Keep the public event object viewer-scoped even if an older server responds
 * with participant identifier collections. Mock ledgers retain those fields
 * internally, while UI consumers use only the three self booleans. */
function publicEvent(value: CleanupEvent): CleanupEvent {
  const { joinedBy: _joinedBy, checkIns: _checkIns, attendanceBy: _attendanceBy, evidenceBy: _evidenceBy, reportEvidenceBy: _reportEvidenceBy, cleanupIds: _cleanupIds, ...safe } = value as CleanupEvent;
  return safe as CleanupEvent;
}

function publicEvents(values: CleanupEvent[]): CleanupEvent[] {
  return values.map(publicEvent);
}

const EVENTS_CACHE_TTL_MS = 60_000;
const eventsCache = new Map<string, { value: CleanupEvent[]; expiresAt: number }>();
const eventsInFlight = new Map<string, Promise<CleanupEvent[]>>();

export function invalidateCleanupEventsCache(): void {
  eventsCache.clear();
  eventsInFlight.clear();
}

/** Local ledgers contain multiple volunteers; derive the same viewer-scoped
 * booleans as the server instead of reusing another volunteer's last action. */
function mockEventFor(value: CleanupEvent, participantId?: string): CleanupEvent {
  return { ...value,
    joined: Boolean(participantId && value.joinedBy?.includes(participantId)),
    checkedIn: Boolean(participantId && value.checkIns?.[participantId] === 'within_area'),
    attendanceConfirmed: Boolean(participantId && value.attendanceBy?.includes(participantId)),
  };
}

export async function fetchCleanupEvents(participantId?: string, joinedOnly = false): Promise<CleanupEvent[]> {
  if (USE_MOCK) {
    const viewer = participantId ?? (await getMe())?.participantId;
    return listCleanupEvents().map(event => mockEventFor(event, viewer)).filter(event => !joinedOnly || event.joined);
  }
  const key = `${participantId ?? ''}:${joinedOnly ? 'joined' : 'all'}`;
  const cached = eventsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const inFlight = eventsInFlight.get(key);
  if (inFlight) return inFlight;
  const request = apiRequest<CleanupEvent[]>(`/cleanup-events${joinedOnly ? '?joined=true' : ''}`)
    .then(publicEvents)
    .then((value) => {
      eventsCache.set(key, { value, expiresAt: Date.now() + EVENTS_CACHE_TTL_MS });
      return value;
    })
    .finally(() => {
      if (eventsInFlight.get(key) === request) eventsInFlight.delete(key);
    });
  eventsInFlight.set(key, request);
  return request;
}

export async function fetchCleanupEvent(eventId: string): Promise<CleanupEvent | null> {
  if (USE_MOCK) {
    const event = getCleanupEvent(eventId);
    return event ? mockEventFor(event, (await getMe())?.participantId) : null;
  }
  try {
    return publicEvent(await apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function joinCleanupEventData(eventId: string, participantId: string): Promise<CleanupEvent> {
  if (USE_MOCK) return mockEventFor(joinCleanupEvent(eventId, participantId), participantId);
  const result = publicEvent(await apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}/join`, 'POST'));
  invalidateCleanupEventsCache();
  return result;
}

export async function leaveCleanupEventData(eventId: string, participantId: string): Promise<CleanupEvent> {
  if (USE_MOCK) return mockEventFor(leaveCleanupEvent(eventId, participantId), participantId);
  const result = publicEvent(await apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}/join`, 'DELETE'));
  invalidateCleanupEventsCache();
  return result;
}

export type CheckInCoordinates = { lat: number; lng: number };

export async function recordCheckInData(
  eventId: string,
  participantId: string,
  state: CheckInState | CheckInCoordinates,
): Promise<CleanupEvent> {
  if (USE_MOCK) {
    if (typeof state === 'string') return mockEventFor(recordCheckIn(eventId, participantId, state), participantId);
    return mockEventFor(recordCheckIn(eventId, participantId, 'within_area'), participantId);
  }
  if (typeof state === 'string') throw new Error('Location coordinates are required for check-in.');
  const result = publicEvent(await apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}/check-in`, 'POST', state));
  invalidateCleanupEventsCache();
  return result;
}

export async function confirmAttendanceData(eventId: string, participantId: string): Promise<CleanupEvent> {
  if (USE_MOCK) return mockEventFor(recordAttendance(eventId, participantId), participantId);
  const result = publicEvent(await apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}/attendance`, 'POST'));
  invalidateCleanupEventsCache();
  return result;
}

export async function linkEventReportData(
  eventId: string,
  participantId: string,
  reportId: string,
  beachId: string,
): Promise<CleanupEvent> {
  if (USE_MOCK) return recordEventReportEvidence(eventId, participantId, reportId, beachId);
  const result = publicEvent(await apiRequest<CleanupEvent>(
    `/cleanup-events/${encodeURIComponent(eventId)}/reports/${encodeURIComponent(reportId)}`,
    'POST',
  ));
  invalidateCleanupEventsCache();
  return result;
}

export async function fetchCleanupTarget(beachId: string): Promise<CleanupTarget | null> {
  if (USE_MOCK) return getCleanupTarget(beachId);
  const target = await apiRequest<any>(`/cleanup-targets/${encodeURIComponent(beachId)}`);
  if (!target) return null;
  return { ...target, remainingBands: target.remainingBands ?? target.remainingQuantities ?? {} } as CleanupTarget;
}

export async function fetchCleanup(cleanupId: string): Promise<CleanupAction | null> {
  if (USE_MOCK) return getCleanup(cleanupId);
  try {
    return await apiRequest<CleanupAction>(`/cleanups/${encodeURIComponent(cleanupId)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function fetchCleanupForTarget(reportId: string): Promise<CleanupAction | null> {
  if (USE_MOCK) return getCleanupForTarget(reportId);
  return apiRequest<CleanupAction | null>(`/cleanups/by-target/${encodeURIComponent(reportId)}`);
}

export async function fetchLatestCleanupForBeach(beachId: string): Promise<CleanupAction | null> {
  if (USE_MOCK) return getLatestCleanupForBeach(beachId);
  return apiRequest<CleanupAction | null>(`/beaches/${encodeURIComponent(beachId)}/cleanups/latest`);
}

export async function fetchLatestCleanupDates(beachIds: string[]): Promise<Record<string, string | null>> {
  if (!USE_MOCK) return apiRequest<Record<string, string | null>>('/beaches/cleanup-history', 'GET', undefined, 15_000, false);
  return Object.fromEntries(beachIds.map(id => [id, getLatestCleanupForBeach(id)?.createdAt ?? null]));
}

export async function fetchEventCleanups(eventId: string): Promise<CleanupAction[]> {
  if (USE_MOCK) return eventCleanups(eventId);
  return apiRequest<CleanupAction[]>(`/cleanup-events/${encodeURIComponent(eventId)}/cleanups`);
}

export async function submitCleanup(input: {
  participantId: string;
  targetReportId: string;
  eventId?: string | null;
  afterBands: Partial<Record<LitterCategory, CleanupAfterBand>>;
  handling: CleanupHandling;
  note?: string;
  idempotencyKey?: string;
}): Promise<CleanupAction> {
  const cleanup = USE_MOCK ? completeCleanup(input) : await apiRequest<CleanupAction>('/cleanups', 'POST', {
    targetReportId: input.targetReportId,
    eventId: input.eventId ?? null,
    afterBands: input.afterBands,
    handling: input.handling,
    note: input.note ?? '',
    idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
  });
  invalidateBeaches();
  invalidateCleanupEventsCache();
  return cleanup;
}

export async function createAdminEventData(input: { beachId: string; date: string; meetingPoint?: string }): Promise<CleanupEvent> {
  if (USE_MOCK) return createAdminEvent(input);
  const result = publicEvent(await apiRequest<CleanupEvent>('/cleanup-events', 'POST', input));
  invalidateCleanupEventsCache();
  return result;
}
