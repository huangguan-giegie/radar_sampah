import { apiRequest, ApiError, USE_MOCK } from './api';
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
import type { LitterCategory, QuantityBand } from './types';

export async function fetchCleanupEvents(participantId?: string, joinedOnly = false): Promise<CleanupEvent[]> {
  if (USE_MOCK) return listCleanupEvents(participantId, joinedOnly);
  return apiRequest<CleanupEvent[]>(`/cleanup-events${joinedOnly ? '?joined=true' : ''}`);
}

export async function fetchCleanupEvent(eventId: string): Promise<CleanupEvent | null> {
  if (USE_MOCK) return getCleanupEvent(eventId);
  try {
    return await apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function joinCleanupEventData(eventId: string, participantId: string): Promise<CleanupEvent> {
  if (USE_MOCK) return joinCleanupEvent(eventId, participantId);
  return apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}/join`, 'POST');
}

export async function leaveCleanupEventData(eventId: string, participantId: string): Promise<CleanupEvent> {
  if (USE_MOCK) return leaveCleanupEvent(eventId, participantId);
  return apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}/join`, 'DELETE');
}

export type CheckInCoordinates = { lat: number; lng: number };

export async function recordCheckInData(
  eventId: string,
  participantId: string,
  state: CheckInState | CheckInCoordinates,
): Promise<CleanupEvent> {
  if (USE_MOCK) {
    if (typeof state === 'string') return recordCheckIn(eventId, participantId, state);
    return recordCheckIn(eventId, participantId, 'within_area');
  }
  if (typeof state === 'string') throw new Error('Location coordinates are required for check-in.');
  return apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}/check-in`, 'POST', state);
}

export async function confirmAttendanceData(eventId: string, participantId: string): Promise<CleanupEvent> {
  if (USE_MOCK) return recordAttendance(eventId, participantId);
  return apiRequest<CleanupEvent>(`/cleanup-events/${encodeURIComponent(eventId)}/attendance`, 'POST');
}

export async function linkEventReportData(
  eventId: string,
  participantId: string,
  reportId: string,
  beachId: string,
): Promise<CleanupEvent> {
  if (USE_MOCK) return recordEventReportEvidence(eventId, participantId, reportId, beachId);
  return apiRequest<CleanupEvent>(
    `/cleanup-events/${encodeURIComponent(eventId)}/reports/${encodeURIComponent(reportId)}`,
    'POST',
  );
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

export async function fetchEventCleanups(eventId: string): Promise<CleanupAction[]> {
  if (USE_MOCK) return eventCleanups(eventId);
  return apiRequest<CleanupAction[]>(`/cleanup-events/${encodeURIComponent(eventId)}/cleanups`);
}

export async function submitCleanup(input: {
  participantId: string;
  targetReportId: string;
  eventId?: string | null;
  afterBands: Partial<Record<LitterCategory, QuantityBand>>;
  handling: CleanupHandling;
  note?: string;
  idempotencyKey?: string;
}): Promise<CleanupAction> {
  if (USE_MOCK) return completeCleanup(input);
  return apiRequest<CleanupAction>('/cleanups', 'POST', {
    targetReportId: input.targetReportId,
    eventId: input.eventId ?? null,
    afterBands: input.afterBands,
    handling: input.handling,
    note: input.note ?? '',
    idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
  });
}

export async function createAdminEventData(input: { beachId: string; date: string }): Promise<CleanupEvent> {
  if (USE_MOCK) return createAdminEvent(input);
  return apiRequest<CleanupEvent>('/cleanup-events', 'POST', input);
}
