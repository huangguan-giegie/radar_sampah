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
  attendanceCount: number;
  joinedBy: string[];
  checkIns: Record<string, CheckInState>;
  attendanceBy: string[];
  /** Contains only the current participant id when their evidence is valid. */
  evidenceBy: string[];
  /** Report ids saved by a joined participant for this event's beach. */
  reportEvidenceBy: Record<string, string[]>;
  cleanupIds: string[];
}

export interface CleanupTarget {
  reportId: string;
  beachId: string;
  beachName: string;
  reportedAt: string;
  remainingBands: Partial<Record<LitterCategory, QuantityBand>>;
}

export interface CleanupRow {
  category: LitterCategory;
  beforeBand: QuantityBand;
  afterBand: QuantityBand;
  /** Difference between the shared band values for this one action only. */
  score: number;
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
  modelState: 'ready' | 'unavailable' | 'unreadable' | 'empty';
  modelVersion: string;
  suggestions: QuantityByCategory;
  supportedClasses: string[];
}

type Iteration2Store = {
  version: 4;
  events: CleanupEvent[];
  cleanups: CleanupAction[];
  targets: CleanupTarget[];
};

const STORE_KEY = 'rs_iteration2_v4';

export const QUANTITY_BANDS: QuantityBand[] = ['Small', 'Medium', 'Large', 'Very Large'];

const QUANTITY_BAND_VALUE: Record<QuantityBand, number> = {
  Small: 1,
  Medium: 2,
  Large: 3,
  'Very Large': 4,
};

export function quantityBandValue(band: QuantityBand): number {
  return QUANTITY_BAND_VALUE[band];
}

const BEACHES = [
  { id: 'morib', name: 'Pantai Morib', area: 'Banting, Selangor' },
  { id: 'remis', name: 'Pantai Remis', area: 'Jeram, Kuala Selangor' },
  { id: 'kelanang', name: 'Pantai Kelanang', area: 'Banting, Selangor' },
  { id: 'bagan', name: 'Pantai Bagan Lalang', area: 'Sepang, Selangor' },
] as const;

// The demo mirrors the published rule: only beaches at Moderate or above get
// automatically generated Saturday activities. Kelanang has insufficient
// evidence, so it must not acquire an event merely because it is configured.
const AUTO_EVENT_BEACH_IDS = new Set(['morib', 'remis', 'bagan']);

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
    BEACHES.filter((beach) => AUTO_EVENT_BEACH_IDS.has(beach.id)).map((beach, beachIndex): CleanupEvent => ({
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
      attendanceCount: 0,
      joinedBy: [],
      checkIns: {},
      attendanceBy: [],
      evidenceBy: [],
      reportEvidenceBy: {},
      cleanupIds: [],
    })),
  );

  return {
    version: 4,
    events,
    cleanups: [],
    targets: [
      {
        reportId: 'r1',
        beachId: 'morib',
        beachName: 'Pantai Morib',
        reportedAt: '2026-08-14T02:00:00Z',
        remainingBands: { Plastic: 'Very Large', 'Fishing gear': 'Very Large', Glass: 'Large', Metal: 'Large', Paper: 'Medium', Other: 'Medium' },
      },
      {
        reportId: 'r3',
        beachId: 'remis',
        beachName: 'Pantai Remis',
        reportedAt: '2026-07-20T02:00:00Z',
        remainingBands: { 'Fishing gear': 'Large', Plastic: 'Medium', Glass: 'Small' },
      },
      {
        reportId: 'r_seed_bagan',
        beachId: 'bagan',
        beachName: 'Pantai Bagan Lalang',
        reportedAt: '2026-07-24T16:00:00+08:00',
        remainingBands: { Plastic: 'Large', 'Fishing gear': 'Large', Glass: 'Medium', Other: 'Small' },
      },
    ],
  };
}

function readStore(): Iteration2Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as Iteration2Store | null;
    if (parsed?.version === 4 && Array.isArray(parsed.events) && Array.isArray(parsed.targets)) {
      // Keep earlier local ledgers usable after report evidence was added.
      // This is an additive field, so filling an absent value cannot change a
      // participant's prior attendance or cleanup records.
      if (parsed.events.some((event) => !event.reportEvidenceBy || !event.evidenceBy || event.attendanceCount === undefined)) {
        const normalized = {
          ...parsed,
          events: parsed.events.map((event) => ({
            ...event,
            attendanceCount: event.attendanceCount ?? event.attendanceBy.length,
            evidenceBy: event.evidenceBy ?? [],
            reportEvidenceBy: event.reportEvidenceBy ?? {},
          })),
        };
        writeStore(normalized);
        return normalized;
      }
      return parsed;
    }
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
      attendanceCount: event.attendanceBy.includes(participantId)
        ? Math.max(0, event.attendanceCount - 1)
        : event.attendanceCount,
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
  const hasLitterAboveSmall = Object.values(target.remainingBands).some(
    (band) => band && quantityBandValue(band) > quantityBandValue('Small'),
  );
  return hasLitterAboveSmall ? target : null;
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
  afterBands: Partial<Record<LitterCategory, QuantityBand>>;
  handling: CleanupHandling;
  note?: string;
}): CleanupAction {
  const store = readStore();
  const existing = store.cleanups.find((cleanup) => cleanup.targetReportId === input.targetReportId);
  if (existing) return existing;

  const target = store.targets.find((item) => item.reportId === input.targetReportId);
  if (!target) throw new Error('This report is not eligible for a cleanup.');
  if (input.eventId) {
    const event = store.events.find((item) => item.id === input.eventId);
    if (!event || !event.joinedBy.includes(input.participantId)) {
      throw new Error('Join this activity before recording a cleanup for it.');
    }
    if (event.beachId !== target.beachId) {
      throw new Error('This cleanup must use a report from the activity beach.');
    }
  }

  const rows = (Object.keys(target.remainingBands) as LitterCategory[])
    .map((category): CleanupRow | null => {
      const beforeBand = target.remainingBands[category];
      const afterBand = input.afterBands[category];
      if (!beforeBand || !afterBand) return null;
      if (!QUANTITY_BANDS.includes(afterBand)) throw new Error(`Choose a valid band for ${category}.`);
      const score = quantityBandValue(beforeBand) - quantityBandValue(afterBand);
      if (score < 0) throw new Error(`${category} cannot increase after a cleanup.`);
      if (score === 0) return null;
      target.remainingBands[category] = afterBand;
      return { category, beforeBand, afterBand, score };
    })
    .filter((row): row is CleanupRow => row !== null);

  if (rows.length === 0) throw new Error('Choose at least one lower band before confirming.');

  const action: CleanupAction = {
    id: `cleanup-${Date.now()}`,
    participantId: input.participantId,
    targetReportId: input.targetReportId,
    eventId: input.eventId ?? null,
    beachId: target.beachId,
    beachName: target.beachName,
    createdAt: new Date().toISOString(),
    rows,
    score: rows.reduce((sum, row) => sum + row.score, 0),
    handling: input.handling,
    note: input.note?.trim() ?? '',
    status: 'Cleanup recorded — awaiting follow-up',
  };

  store.cleanups.push(action);
  // A Small band in every category is the agreed "cleared" outcome. The
  // original target is removed instead of retaining a misleading zero row.
  const cleared = Object.values(target.remainingBands).every(
    (band) => band === 'Small',
  );
  if (cleared) {
    store.targets = store.targets.filter((item) => item.reportId !== target.reportId);
  }
  if (action.eventId) {
    store.events = store.events.map((event) => {
      if (event.id !== action.eventId) return event;
      return {
        ...event,
        cleanupIds: [...event.cleanupIds, action.id],
        evidenceBy: event.evidenceBy.includes(input.participantId)
          ? event.evidenceBy
          : [...event.evidenceBy, input.participantId],
      };
    });
  }
  writeStore(store);
  return action;
}

export function eventCleanups(eventId: string): CleanupAction[] {
  return readStore().cleanups.filter((cleanup) => cleanup.eventId === eventId);
}

/** A cleanup supplies the same-event evidence; attendance remains a separate
 * explicit participant action after the broad-area check. */
export function hasEventEvidence(eventId: string, participantId: string): boolean {
  const event = getCleanupEvent(eventId);
  const hasEvidence = Boolean(
    event?.reportEvidenceBy[participantId]?.length
    || eventCleanups(eventId).some((cleanup) => cleanup.participantId === participantId),
  );
  if (hasEvidence && event && !event.evidenceBy.includes(participantId)) {
    updateEvent(eventId, (current) => ({ ...current, evidenceBy: [...current.evidenceBy, participantId] }));
  }
  return hasEvidence;
}

export function eventHasEvidence(event: CleanupEvent, participantId: string): boolean {
  return event.evidenceBy.includes(participantId) || Boolean(event.reportEvidenceBy[participantId]?.length);
}

export function eventCanRecordAttendance(event: CleanupEvent, participantId: string): boolean {
  return event.joinedBy.includes(participantId)
    && event.checkIns[participantId] === 'within_area'
    && eventHasEvidence(event, participantId)
    && !event.attendanceBy.includes(participantId);
}

/** Save the fact that a participant filed a report for this specific event
 * beach. It deliberately does not record attendance: that remains the
 * participant's separate, explicit action. */
export function recordEventReportEvidence(eventId: string, participantId: string, reportId: string, beachId: string): CleanupEvent {
  return updateEvent(eventId, (event) => {
    if (!event.joinedBy.includes(participantId)) throw new Error('Join this activity before linking a report to it.');
    if (event.beachId !== beachId) throw new Error('This report belongs to a different beach.');
    const current = event.reportEvidenceBy[participantId] ?? [];
    if (current.includes(reportId)) return event;
    return {
      ...event,
      evidenceBy: event.evidenceBy.includes(participantId) ? event.evidenceBy : [...event.evidenceBy, participantId],
      reportEvidenceBy: { ...event.reportEvidenceBy, [participantId]: [...current, reportId] },
    };
  });
}

export function canRecordAttendance(eventId: string, participantId: string): boolean {
  const event = getCleanupEvent(eventId);
  return Boolean(
    event
      && event.joinedBy.includes(participantId)
      && event.checkIns[participantId] === 'within_area'
      && hasEventEvidence(eventId, participantId)
      && !event.attendanceBy.includes(participantId),
  );
}

export function recordAttendance(eventId: string, participantId: string): CleanupEvent {
  return updateEvent(eventId, (event) => {
    if (!event.joinedBy.includes(participantId)) throw new Error('Join this activity before confirming attendance.');
    if (event.checkIns[participantId] !== 'within_area') throw new Error('Check in near the beach before confirming attendance.');
    if (!hasEventEvidence(eventId, participantId)) throw new Error('Add a linked report or cleanup before confirming attendance.');
    if (event.attendanceBy.includes(participantId)) return event;
    return {
      ...event,
      attendanceBy: [...event.attendanceBy, participantId],
      attendanceCount: event.attendanceCount + 1,
    };
  });
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
    attendanceCount: 0,
    joinedBy: [],
    checkIns: {},
    attendanceBy: [],
    evidenceBy: [],
    reportEvidenceBy: {},
    cleanupIds: [],
  };
  store.events.push(event);
  writeStore(store);
  return event;
}

export function monitoredBeaches() {
  return BEACHES.map((beach) => ({ ...beach }));
}

export async function analyseReportPhoto(
  photoKey: string,
  forcedState: 'unavailable' | 'unreadable' | null = null,
): Promise<AiSuggestion> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  if (forcedState === 'unreadable' || photoKey.toLowerCase().includes('unreadable')) {
    return { modelState: 'unreadable', modelVersion: 'sea-taco-yolo11m-best', suggestions: {}, supportedClasses: MODEL_CLASSES };
  }
  if (forcedState === 'unavailable' || !photoKey) {
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
): Promise<Partial<Record<LitterCategory, QuantityBand>>> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  if (!photoName) throw new Error('Choose a JPG or PNG photo first.');
  if (target.beachId === 'morib') {
    return {
      Plastic: 'Large',
      'Fishing gear': 'Large',
    };
  }
  const seed = [...photoName].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const result: Partial<Record<LitterCategory, QuantityBand>> = {};
  (Object.keys(target.remainingBands) as LitterCategory[]).forEach((category, index) => {
    const current = target.remainingBands[category];
    if (!current || current === 'Small') return;
    const nextIndex = Math.max(0, QUANTITY_BANDS.indexOf(current) - 1 - ((seed + index) % 2));
    if ((seed + index) % 3 !== 0) result[category] = QUANTITY_BANDS[nextIndex];
  });
  return Object.keys(result).length > 0 ? result : { Plastic: 'Small' };
}

export function formatEventDate(date: string): string {
  const weekday = new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  });
  return `${date} (${weekday})`;
}
