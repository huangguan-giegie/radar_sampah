import type { LitterCategory, QuantityBand, QuantityByCategory } from './types';

export type EventStatus = 'Open' | 'Closed';
export type CleanupHandling = 'Collected for disposal' | 'Recycled / handled' | 'Not recorded';
export type CheckInState = 'idle' | 'checking' | 'within_area' | 'denied' | 'outside_area';

export interface CleanupEvent {
  id: string;
  beachId: string;
  beachName: string;
  area: string;
  date: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  source: 'weekly' | 'admin';
  participantCount: number;
  joinedBy: string[];
  checkIns: Record<string, CheckInState>;
  attendanceBy: string[];
  cleanupIds: string[];
}

export interface CleanupTarget {
  reportId: string;
  beachId: string;
  beachName: string;
  reportedAt: string;
  remaining: Partial<Record<LitterCategory, number>>;
}

export interface CleanupRow {
  category: LitterCategory;
  removed: number;
  before: number;
  after: number;
}

export interface CleanupAction {
  id: string;
  participantId: string;
  targetReportId: string;
  eventId: string | null;
  beachId: string;
  beachName: string;
  createdAt: string;
  rows: CleanupRow[];
  score: number;
  handling: CleanupHandling;
  note: string;
  status: 'Cleanup recorded — awaiting follow-up';
}

export interface AiSuggestion {
  modelState: 'ready' | 'unavailable' | 'empty';
  modelVersion: string;
  suggestions: QuantityByCategory;
  supportedClasses: string[];
}

type Iteration2Store = {
  version: 3;
  events: CleanupEvent[];
  cleanups: CleanupAction[];
  targets: CleanupTarget[];
};

const STORE_KEY = 'rs_iteration2_v3';

const BEACHES = [
  { id: 'morib', name: 'Pantai Morib', area: 'Banting, Selangor' },
  { id: 'remis', name: 'Pantai Remis', area: 'Jeram, Kuala Selangor' },
  { id: 'kelanang', name: 'Pantai Kelanang', area: 'Banting, Selangor' },
  { id: 'bagan', name: 'Pantai Bagan Lalang', area: 'Sepang, Selangor' },
] as const;

const MODEL_CLASSES = ['plastic', 'metal', 'glass', 'paper_cardboard', 'styrofoam', 'fishing_gear'];

function malaysiaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function nextSaturdays(count: number): string[] {
  const now = new Date();
  const local = new Date(`${malaysiaDate(now)}T12:00:00+08:00`);
  const delta = (6 - local.getDay() + 7) % 7;
  local.setDate(local.getDate() + delta);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(local);
    date.setDate(local.getDate() + index * 7);
    return malaysiaDate(date);
  });
}

function seedStore(): Iteration2Store {
  const saturdays = nextSaturdays(4);
  const events = saturdays.flatMap((date, week) =>
    BEACHES.map((beach, beachIndex): CleanupEvent => ({
      id: `${beach.id}-${date}`,
      beachId: beach.id,
      beachName: beach.name,
      area: beach.area,
      date,
      startsAt: '09:00',
      endsAt: '12:00',
      status: 'Open',
      source: 'weekly',
      participantCount: 6 + week * 2 + beachIndex * 3,
      joinedBy: [],
      checkIns: {},
      attendanceBy: [],
      cleanupIds: [],
    })),
  );

  return {
    version: 3,
    events,
    cleanups: [],
    targets: [
      {
        reportId: 'r1',
        beachId: 'morib',
        beachName: 'Pantai Morib',
        reportedAt: '2026-08-14T02:00:00Z',
        remaining: { Plastic: 62, 'Fishing gear': 24, Glass: 15, Metal: 11, Paper: 7, Other: 5 },
      },
      {
        reportId: 'r3',
        beachId: 'remis',
        beachName: 'Pantai Remis',
        reportedAt: '2026-07-20T02:00:00Z',
        remaining: { 'Fishing gear': 10, Plastic: 8, Glass: 2 },
      },
      {
        reportId: 'r_seed_bagan',
        beachId: 'bagan',
        beachName: 'Pantai Bagan Lalang',
        reportedAt: '2026-07-24T16:00:00+08:00',
        remaining: { Plastic: 12, 'Fishing gear': 9, Glass: 3, Other: 2 },
      },
    ],
  };
}

function readStore(): Iteration2Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as Iteration2Store | null;
    if (parsed?.version === 3 && Array.isArray(parsed.events) && Array.isArray(parsed.targets)) return parsed;
  } catch {
    // Corrupt or unavailable storage simply starts a fresh local demo ledger.
  }
  const seeded = seedStore();
  writeStore(seeded);
  return seeded;
}

function writeStore(store: Iteration2Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // The flow remains usable in memory-constrained/private browsing sessions.
  }
}

function updateEvent(eventId: string, change: (event: CleanupEvent) => CleanupEvent): CleanupEvent {
  const store = readStore();
  let updated: CleanupEvent | null = null;
  store.events = store.events.map((event) => {
    if (event.id !== eventId) return event;
    updated = change(event);
    return updated;
  });
  if (!updated) throw new Error('This cleanup activity is no longer available.');
  writeStore(store);
  return updated;
}

export function listCleanupEvents(participantId?: string, joinedOnly = false): CleanupEvent[] {
  const events = readStore().events
    .filter((event) => event.status === 'Open')
    .filter((event) => !joinedOnly || Boolean(participantId && event.joinedBy.includes(participantId)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.beachName.localeCompare(b.beachName));
  return events;
}

export function getCleanupEvent(eventId: string): CleanupEvent | null {
  return readStore().events.find((event) => event.id === eventId) ?? null;
}

export function joinCleanupEvent(eventId: string, participantId: string): CleanupEvent {
  return updateEvent(eventId, (event) => {
    if (event.joinedBy.includes(participantId)) return event;
    return {
      ...event,
      joinedBy: [...event.joinedBy, participantId],
      participantCount: event.participantCount + 1,
    };
  });
}

export function leaveCleanupEvent(eventId: string, participantId: string): CleanupEvent {
  return updateEvent(eventId, (event) => {
    if (!event.joinedBy.includes(participantId)) return event;
    const checkIns = { ...event.checkIns };
    delete checkIns[participantId];
    return {
      ...event,
      joinedBy: event.joinedBy.filter((id) => id !== participantId),
      attendanceBy: event.attendanceBy.filter((id) => id !== participantId),
      checkIns,
      participantCount: Math.max(0, event.participantCount - 1),
    };
  });
}

export function recordCheckIn(eventId: string, participantId: string, state: CheckInState): CleanupEvent {
  return updateEvent(eventId, (event) => {
    if (!event.joinedBy.includes(participantId)) throw new Error('Join this activity before checking in.');
    return { ...event, checkIns: { ...event.checkIns, [participantId]: state } };
  });
}

export function getCleanupTarget(beachId: string): CleanupTarget | null {
  const target = getCleanupTargetRecord(beachId);
  if (!target) return null;
  const total = Object.values(target.remaining).reduce((sum, value) => sum + (value ?? 0), 0);
  return total > 0 ? target : null;
}

export function getCleanupTargetRecord(beachId: string): CleanupTarget | null {
  return readStore().targets.find((item) => item.beachId === beachId) ?? null;
}

export function getCleanup(cleanupId: string): CleanupAction | null {
  return readStore().cleanups.find((cleanup) => cleanup.id === cleanupId) ?? null;
}

export function getLatestCleanupForBeach(beachId: string): CleanupAction | null {
  return readStore().cleanups
    .filter((cleanup) => cleanup.beachId === beachId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function getCleanupForTarget(targetReportId: string): CleanupAction | null {
  return readStore().cleanups.find((cleanup) => cleanup.targetReportId === targetReportId) ?? null;
}

export function completeCleanup(input: {
  participantId: string;
  targetReportId: string;
  eventId?: string | null;
  removed: Partial<Record<LitterCategory, number>>;
  handling: CleanupHandling;
  note?: string;
}): CleanupAction {
  const store = readStore();
  const existing = store.cleanups.find((cleanup) => cleanup.targetReportId === input.targetReportId);
  if (existing) return existing;

  const target = store.targets.find((item) => item.reportId === input.targetReportId);
  if (!target) throw new Error('This report is not eligible for a cleanup.');

  const rows = (Object.keys(target.remaining) as LitterCategory[])
    .map((category): CleanupRow | null => {
      const before = target.remaining[category] ?? 0;
      const requested = input.removed[category] ?? 0;
      if (!Number.isInteger(requested) || requested < 0) throw new Error('Removed quantities must be whole numbers.');
      const removed = Math.min(before, requested);
      if (removed === 0) return null;
      const after = Math.max(0, before - removed);
      target.remaining[category] = after;
      return { category, before, removed, after };
    })
    .filter((row): row is CleanupRow => row !== null);

  if (rows.length === 0) throw new Error('Enter at least one item you removed.');

  const action: CleanupAction = {
    id: `cleanup-${Date.now()}`,
    participantId: input.participantId,
    targetReportId: input.targetReportId,
    eventId: input.eventId ?? null,
    beachId: target.beachId,
    beachName: target.beachName,
    createdAt: new Date().toISOString(),
    rows,
    score: rows.reduce((sum, row) => sum + row.removed, 0),
    handling: input.handling,
    note: input.note?.trim() ?? '',
    status: 'Cleanup recorded — awaiting follow-up',
  };

  store.cleanups.push(action);
  if (action.eventId) {
    store.events = store.events.map((event) => {
      if (event.id !== action.eventId) return event;
      const attendanceBy =
        event.checkIns[input.participantId] === 'within_area' && !event.attendanceBy.includes(input.participantId)
          ? [...event.attendanceBy, input.participantId]
          : event.attendanceBy;
      return { ...event, cleanupIds: [...event.cleanupIds, action.id], attendanceBy };
    });
  }
  writeStore(store);
  return action;
}

export function eventCleanups(eventId: string): CleanupAction[] {
  return readStore().cleanups.filter((cleanup) => cleanup.eventId === eventId);
}

export function createAdminEvent(input: { beachId: string; date: string }): CleanupEvent {
  const store = readStore();
  const beach = BEACHES.find((item) => item.id === input.beachId);
  if (!beach) throw new Error('Choose a monitored beach.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Choose an activity date.');
  const id = `${beach.id}-${input.date}`;
  const existing = store.events.find((event) => event.id === id);
  if (existing) return existing;
  const event: CleanupEvent = {
    id,
    beachId: beach.id,
    beachName: beach.name,
    area: beach.area,
    date: input.date,
    startsAt: '09:00',
    endsAt: '12:00',
    status: 'Open',
    source: 'admin',
    participantCount: 0,
    joinedBy: [],
    checkIns: {},
    attendanceBy: [],
    cleanupIds: [],
  };
  store.events.push(event);
  writeStore(store);
  return event;
}

export function monitoredBeaches() {
  return BEACHES.map((beach) => ({ ...beach }));
}

export async function analyseReportPhoto(photoKey: string, forceFailure = false): Promise<AiSuggestion> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  if (forceFailure || !photoKey) {
    return { modelState: 'unavailable', modelVersion: 'sea-taco-yolo11m-best', suggestions: {}, supportedClasses: MODEL_CLASSES };
  }
  const number = [...photoKey].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const primary: LitterCategory = number % 3 === 0 ? 'Fishing gear' : number % 3 === 1 ? 'Plastic' : 'Glass';
  const quantity: QuantityBand = number % 2 === 0 ? 'Medium' : 'Small';
  return {
    modelState: 'ready',
    modelVersion: 'sea-taco-yolo11m-best',
    suggestions: { [primary]: quantity },
    supportedClasses: MODEL_CLASSES,
  };
}

export async function analyseCleanupPhoto(
  photoName: string,
  target: CleanupTarget,
): Promise<Partial<Record<LitterCategory, number>>> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  if (!photoName) throw new Error('Choose a JPG or PNG photo first.');
  if (target.beachId === 'morib') {
    return {
      Plastic: Math.min(26, target.remaining.Plastic ?? 0),
      'Fishing gear': Math.min(9, target.remaining['Fishing gear'] ?? 0),
    };
  }
  const seed = [...photoName].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const result: Partial<Record<LitterCategory, number>> = {};
  (Object.keys(target.remaining) as LitterCategory[]).forEach((category, index) => {
    const available = target.remaining[category] ?? 0;
    if (available === 0) return;
    const suggestion = Math.min(available, 1 + ((seed + index * 3) % Math.min(available, 6)));
    if ((seed + index) % 3 !== 0) result[category] = suggestion;
  });
  return Object.keys(result).length > 0 ? result : { Plastic: Math.min(1, target.remaining.Plastic ?? 0) };
}

export function formatEventDate(date: string): string {
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function cleanupTotal(target: CleanupTarget): number {
  return Object.values(target.remaining).reduce((sum, value) => sum + (value ?? 0), 0);
}
