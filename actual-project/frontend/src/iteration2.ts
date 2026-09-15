import type { LitterCategory, QuantityBand, QuantityByCategory } from './types';
import {
  checkInIteration2Event,
  createIteration2Cleanup,
  createIteration2Event,
  getIteration2Event,
  getIteration2EventCleanups,
  getIteration2Events,
  createIteration2ShareLink,
  getIteration2SharedItems,
  getIteration2MyCleanups,
  getIteration2Targets,
  joinIteration2Event,
  leaveIteration2Event,
  recognizeCleanupPhoto,
  recognizeReportPhoto,
  USE_MOCK,
} from './api';

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
  remainingQuantities: QuantityByCategory;
}

export interface CleanupRow {
  category: LitterCategory;
  before?: QuantityBand | null;
  after?: QuantityBand | null;
  removedBand?: QuantityBand;
  removedUnits?: number;
  /** Deprecated legacy-count fields returned only for historical cleanup rows. */
  removed?: number;
}

export interface CleanupAction {
  id: string;
  participantId: string;
  targetReportId: string | null;
  eventId: string | null;
  beachId: string;
  beachName: string;
  createdAt: string;
  rows: CleanupRow[];
  score: number;
  remainingQuantities: QuantityByCategory | null;
  removedQuantities: QuantityByCategory | null;
  resolved: boolean;
  handling: CleanupHandling;
  note: string;
  status: 'Cleanup recorded — awaiting follow-up';
}

export interface AiSuggestion {
  modelState: 'ready' | 'unavailable' | 'empty';
  modelVersion: string;
  suggestions: QuantityByCategory;
  counts: Partial<Record<LitterCategory, number>>;
  supportedClasses: string[];
}

export function normalizeSuggestedCounts(
  counts: Partial<Record<LitterCategory, number>>,
): Partial<Record<LitterCategory, number>> {
  return Object.fromEntries(
    Object.entries(counts).filter(([, count]) => Number.isInteger(count) && Number(count) > 0),
  ) as Partial<Record<LitterCategory, number>>;
}

export function effectiveAiModelState(
  state: AiSuggestion['modelState'],
  counts: Partial<Record<LitterCategory, number>>,
): AiSuggestion['modelState'] {
  return state === 'ready' && Object.keys(normalizeSuggestedCounts(counts)).length === 0 ? 'empty' : state;
}

export const CLEANUP_BAND_UNITS: Record<QuantityBand, number> = {
  Small: 1,
  Medium: 2,
  Large: 3,
  'Very Large': 4,
};

function isQuantityBand(value: unknown): value is QuantityBand {
  return value === 'Small' || value === 'Medium' || value === 'Large' || value === 'Very Large';
}

function activeTarget(quantities: QuantityByCategory): boolean {
  return Object.values(quantities).some((band) => band !== undefined && band !== 'Small');
}

type Iteration2Store = {
  version: 4;
  events: CleanupEvent[];
  cleanups: CleanupAction[];
  targets: CleanupTarget[];
};

const STORE_KEY = 'rs_iteration2_v4';

const BEACHES = [
  { id: 'morib', name: 'Pantai Morib', area: 'Banting, Selangor' },
  { id: 'remis', name: 'Pantai Remis', area: 'Jeram, Kuala Selangor' },
  { id: 'kelanang', name: 'Pantai Kelanang', area: 'Banting, Selangor' },
  { id: 'bagan', name: 'Pantai Bagan Lalang', area: 'Sepang, Selangor' },
] as const;

const MODEL_CLASSES = ['plastic', 'metal', 'glass', 'paper_cardboard', 'styrofoam', 'fishing_gear'];
const CLEANUP_CATEGORIES: LitterCategory[] = ['Fishing gear', 'Plastic', 'Glass', 'Metal', 'Other', 'Paper'];

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
    version: 4,
    events,
    cleanups: [],
    targets: [
      {
        reportId: 'r1',
        beachId: 'morib',
        beachName: 'Pantai Morib',
        reportedAt: '2026-08-14T02:00:00Z',
        remainingQuantities: {
          Plastic: 'Very Large',
          'Fishing gear': 'Large',
          Glass: 'Medium',
          Metal: 'Medium',
          Paper: 'Medium',
          Other: 'Small',
        },
      },
      {
        reportId: 'r3',
        beachId: 'remis',
        beachName: 'Pantai Remis',
        reportedAt: '2026-07-20T02:00:00Z',
        remainingQuantities: { 'Fishing gear': 'Large', Plastic: 'Medium', Glass: 'Small' },
      },
      {
        reportId: 'r_seed_bagan',
        beachId: 'bagan',
        beachName: 'Pantai Bagan Lalang',
        reportedAt: '2026-07-24T16:00:00+08:00',
        remainingQuantities: { Plastic: 'Large', 'Fishing gear': 'Medium', Glass: 'Small', Other: 'Small' },
      },
    ],
  };
}

function readStore(): Iteration2Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as Iteration2Store | null;
    if (parsed?.version === 4 && Array.isArray(parsed.events) && Array.isArray(parsed.targets)) return parsed;
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

export async function listCleanupEvents(participantId?: string, joinedOnly = false, includeAuth = true): Promise<CleanupEvent[]> {
  const events = USE_MOCK ? readStore().events : await getIteration2Events(undefined, includeAuth);
  return events
    .filter((event) => event.status === 'Open')
    .filter((event) => !joinedOnly || Boolean(participantId && event.joinedBy.includes(participantId)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.beachName.localeCompare(b.beachName));
}

export async function getCleanupEvent(eventId: string): Promise<CleanupEvent | null> {
  if (!USE_MOCK) {
    try { return await getIteration2Event(eventId); } catch { return null; }
  }
  return readStore().events.find((event) => event.id === eventId) ?? null;
}

export async function joinCleanupEvent(eventId: string, participantId: string): Promise<CleanupEvent> {
  if (!USE_MOCK) return joinIteration2Event(eventId);
  return updateEvent(eventId, (event) => {
    if (event.joinedBy.includes(participantId)) return event;
    return { ...event, joinedBy: [...event.joinedBy, participantId], participantCount: event.participantCount + 1 };
  });
}

export async function leaveCleanupEvent(eventId: string, participantId: string): Promise<CleanupEvent> {
  if (!USE_MOCK) return leaveIteration2Event(eventId);
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

export async function recordCheckIn(
  eventId: string,
  participantId: string,
  result: CheckInState | { lat: number; lng: number },
): Promise<CleanupEvent> {
  if (!USE_MOCK) {
    if (typeof result === 'string') throw new Error('Location coordinates are required for check-in.');
    return checkInIteration2Event(eventId, result);
  }
  if (typeof result !== 'string') throw new Error('Mock check-in requires a check-in result.');
  return updateEvent(eventId, (event) => {
    if (!event.joinedBy.includes(participantId)) throw new Error('Join this activity before checking in.');
    return { ...event, checkIns: { ...event.checkIns, [participantId]: result } };
  });
}

export async function getCleanupTarget(beachId: string, reportId?: string): Promise<CleanupTarget | null> {
  return (await listCleanupTargets(beachId, reportId))[0] ?? null;
}

export async function getCleanupTargetRecord(beachId: string, reportId?: string): Promise<CleanupTarget | null> {
  return getCleanupTarget(beachId, reportId);
}

function normalizeTarget(raw: any): CleanupTarget {
  return {
    reportId: String(raw.reportId),
    beachId: String(raw.beachId),
    beachName: String(raw.beachName),
    reportedAt: String(raw.reportedAt),
    remainingQuantities: (raw.remainingQuantities ?? {}) as QuantityByCategory,
  };
}

export async function listCleanupTargets(beachId?: string, reportId?: string, includeAuth = true): Promise<CleanupTarget[]> {
  if (!USE_MOCK) {
    const targets = await getIteration2Targets(beachId, reportId, includeAuth);
    return (targets as any[]).map(normalizeTarget).filter((target) => activeTarget(target.remainingQuantities));
  }
  return readStore().targets
    .filter((target) => !beachId || target.beachId === beachId)
    .filter((target) => !reportId || target.reportId === reportId)
    .filter((target) => activeTarget(target.remainingQuantities));
}

export async function getCleanup(cleanupId: string): Promise<CleanupAction | null> {
  if (!USE_MOCK) return (await getIteration2MyCleanups()).find((action: CleanupAction) => action.id === cleanupId) ?? null;
  return readStore().cleanups.find((cleanup) => cleanup.id === cleanupId) ?? null;
}

export async function getLatestCleanupForBeach(beachId: string): Promise<CleanupAction | null> {
  const cleanups = USE_MOCK ? readStore().cleanups : await getIteration2MyCleanups();
  return cleanups.filter((cleanup: CleanupAction) => cleanup.beachId === beachId)
    .sort((a: CleanupAction, b: CleanupAction) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export async function getCleanupForTarget(targetReportId: string): Promise<CleanupAction | null> {
  const cleanups = USE_MOCK ? readStore().cleanups : await getIteration2MyCleanups();
  return cleanups.find((cleanup: CleanupAction) => cleanup.targetReportId === targetReportId) ?? null;
}

export async function completeCleanup(input: {
  participantId: string;
  beachId?: string;
  targetReportId?: string;
  eventId?: string | null;
  remainingQuantities?: QuantityByCategory;
  removedQuantities?: QuantityByCategory;
  handling: CleanupHandling;
  note?: string;
  idempotencyKey?: string;
}): Promise<CleanupAction> {
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  if (!input.targetReportId && !input.beachId) throw new Error('Choose a beach for this cleanup.');
  if (input.targetReportId && input.remainingQuantities === undefined) throw new Error('Confirm what remains after this cleanup.');
  if (!input.targetReportId && !input.removedQuantities) throw new Error('Confirm what you removed.');

  if (!USE_MOCK) {
    const payload: any = {
      beachId: input.beachId,
      targetReportId: input.targetReportId,
      eventId: input.eventId,
      remainingQuantities: input.remainingQuantities,
      removedQuantities: input.removedQuantities,
      handling: input.handling,
      note: input.note,
      idempotencyKey,
    };
    if (!payload.targetReportId) delete payload.targetReportId;
    if (!payload.beachId) delete payload.beachId;
    if (payload.remainingQuantities === undefined) delete payload.remainingQuantities;
    if (payload.removedQuantities === undefined) delete payload.removedQuantities;
    return createIteration2Cleanup(payload as any) as Promise<CleanupAction>;
  }

  const store = readStore();
  const target = input.targetReportId
    ? store.targets.find((item) => item.reportId === input.targetReportId)
    : undefined;
  if (input.targetReportId && (!target || !activeTarget(target.remainingQuantities))) {
    throw new Error('This report is not eligible for a cleanup.');
  }
  const beachId = target?.beachId ?? input.beachId!;
  const beach = BEACHES.find((item) => item.id === beachId);
  if (!beach) throw new Error('Choose a monitored beach.');

  let rows: CleanupRow[] = [];
  let score = 0;
  let remainingQuantities: QuantityByCategory | null = null;
  let removedQuantities: QuantityByCategory | null = null;
  let resolved = false;

  if (target) {
    const before = { ...target.remainingQuantities };
    const after = { ...(input.remainingQuantities ?? {}) };
    for (const [category, band] of Object.entries(after) as [LitterCategory, QuantityBand][]) {
      if (!(category in before) || !isQuantityBand(band)) throw new Error('Use only the litter categories already recorded for this target.');
      const beforeBand = before[category];
      if (!beforeBand || CLEANUP_BAND_UNITS[band] > CLEANUP_BAND_UNITS[beforeBand]) {
        throw new Error('Remaining litter cannot increase during a cleanup.');
      }
    }
    rows = (Object.entries(before) as [LitterCategory, QuantityBand][])
      .map(([category, beforeBand]): CleanupRow | null => {
        const afterBand = after[category] ?? null;
        const removedUnits = CLEANUP_BAND_UNITS[beforeBand] - (afterBand ? CLEANUP_BAND_UNITS[afterBand] : 0);
        if (removedUnits <= 0) return null;
        return { category, before: beforeBand, after: afterBand, removedUnits };
      })
      .filter((row): row is CleanupRow => row !== null);
    score = rows.reduce((sum, row) => sum + (row.removedUnits ?? 0), 0);
    if (score <= 0) throw new Error('Record at least one reduction in the cleanup result.');
    target.remainingQuantities = after;
    remainingQuantities = after;
    resolved = !activeTarget(after);
  } else {
    removedQuantities = { ...(input.removedQuantities ?? {}) };
    for (const [category, band] of Object.entries(removedQuantities) as [LitterCategory, QuantityBand][]) {
      if (!CLEANUP_CATEGORIES.includes(category) || !isQuantityBand(band)) throw new Error('Choose a supported category and quantity band.');
      rows.push({ category, removedBand: band, removedUnits: CLEANUP_BAND_UNITS[band] });
    }
    if (rows.length === 0) throw new Error('Record at least one category you removed.');
    score = rows.reduce((sum, row) => sum + (row.removedUnits ?? 0), 0);
  }

  const action: CleanupAction = {
    id: `cleanup-${Date.now()}-${crypto.randomUUID()}`,
    participantId: input.participantId,
    targetReportId: target?.reportId ?? null,
    eventId: input.eventId ?? null,
    beachId,
    beachName: beach.name,
    createdAt: new Date().toISOString(),
    rows,
    score,
    remainingQuantities,
    removedQuantities,
    resolved,
    handling: input.handling,
    note: input.note?.trim() ?? '',
    status: 'Cleanup recorded — awaiting follow-up',
  };
  store.cleanups.push(action);
  if (action.eventId) {
    store.events = store.events.map((event) => event.id === action.eventId
      ? { ...event, cleanupIds: [...event.cleanupIds, action.id] }
      : event);
  }
  writeStore(store);
  return action;
}

export async function eventCleanups(eventId: string): Promise<CleanupAction[]> {
  return USE_MOCK
    ? readStore().cleanups.filter((cleanup) => cleanup.eventId === eventId)
    : getIteration2EventCleanups(eventId);
}

export async function createSharePath(input: { eventId?: string; reportId?: string }): Promise<string> {
  if (!USE_MOCK) return (await createIteration2ShareLink(input)).path;
  if (input.eventId) return `/share/events/${encodeURIComponent(input.eventId)}`;
  return `/share/reports/${encodeURIComponent(input.reportId ?? '')}`;
}

export async function getSharedItems(token: string): Promise<{ event: CleanupEvent | null; report: any | null }> {
  if (!USE_MOCK) return getIteration2SharedItems(token);
  const store = readStore();
  const event = store.events.find((row) => row.id === token);
  if (event) return { event, report: null };
  const target = store.targets.find((row) => row.reportId === token && activeTarget(row.remainingQuantities));
  if (!target) return { event: null, report: null };
  return {
    event: null,
    report: {
      id: target.reportId,
      beachId: target.beachId,
      beachName: target.beachName,
      reportedAt: target.reportedAt,
      status: 'Counted',
      quantities: target.remainingQuantities,
      remainingQuantities: target.remainingQuantities,
      photoAvailable: false,
    },
  };
}

export async function createAdminEvent(input: { beachId: string; date: string }): Promise<CleanupEvent> {
  if (!USE_MOCK) return createIteration2Event(input);
  const store = readStore();
  const beach = BEACHES.find((item) => item.id === input.beachId);
  if (!beach) throw new Error('Choose a monitored beach.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Choose an activity date.');
  const id = `${beach.id}-${input.date}`;
  const existing = store.events.find((event) => event.id === id);
  if (existing) return existing;
  const event: CleanupEvent = {
    id, beachId: beach.id, beachName: beach.name, area: beach.area, date: input.date,
    startsAt: '09:00', endsAt: '12:00', status: 'Open', source: 'admin', participantCount: 0,
    joinedBy: [], checkIns: {}, attendanceBy: [], cleanupIds: [],
  };
  store.events.push(event);
  writeStore(store);
  return event;
}

export function monitoredBeaches() {
  return BEACHES.map((beach) => ({ ...beach }));
}

export async function analyseReportPhoto(photoKey: string, forceFailure = false): Promise<AiSuggestion> {
  if (!USE_MOCK) {
    if (forceFailure) return { modelState: 'unavailable', modelVersion: 'unavailable', suggestions: {}, counts: {}, supportedClasses: MODEL_CLASSES };
    const result = await recognizeReportPhoto(photoKey);
    const counts = normalizeSuggestedCounts(result.counts);
    return {
      modelState: effectiveAiModelState(result.modelState, counts),
      modelVersion: result.modelVersion,
      suggestions: result.suggestions,
      counts,
      supportedClasses: result.supportedClasses,
    };
  }
  await new Promise((resolve) => setTimeout(resolve, 650));
  if (forceFailure || !photoKey) {
    return { modelState: 'unavailable', modelVersion: 'sea-taco-yolo11m-best', suggestions: {}, counts: {}, supportedClasses: MODEL_CLASSES };
  }
  const number = [...photoKey].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const primary: LitterCategory = number % 3 === 0 ? 'Fishing gear' : number % 3 === 1 ? 'Plastic' : 'Glass';
  const quantity: QuantityBand = number % 2 === 0 ? 'Medium' : 'Small';
  const count = quantity === 'Medium' ? 8 : 3;
  const counts = { [primary]: count } as Partial<Record<LitterCategory, number>>;
  return {
    modelState: effectiveAiModelState('ready', counts),
    modelVersion: 'sea-taco-yolo11m-best',
    suggestions: { [primary]: quantity },
    counts,
    supportedClasses: MODEL_CLASSES,
  };
}

export async function analyseCleanupPhoto(
  photo: File,
  target?: CleanupTarget | null,
): Promise<QuantityByCategory> {
  if (!USE_MOCK) {
    const result = await recognizeCleanupPhoto(photo);
    const suggested = result.suggestions as QuantityByCategory;
    if (!target) return suggested;
    return Object.fromEntries(
      Object.entries(suggested).flatMap(([category, band]) => {
        const typedCategory = category as LitterCategory;
        const before = target.remainingQuantities[typedCategory];
        if (!before || !band || !isQuantityBand(band)) return [];
        const capped = CLEANUP_BAND_UNITS[band] <= CLEANUP_BAND_UNITS[before] ? band : before;
        return [[typedCategory, capped]];
      }),
    ) as QuantityByCategory;
  }
  await new Promise((resolve) => setTimeout(resolve, 650));
  if (!photo) throw new Error('Choose a JPG or PNG photo first.');
  if (!target) {
    const seed = [...photo.name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const category = CLEANUP_CATEGORIES[seed % CLEANUP_CATEGORIES.length];
    const bands: QuantityBand[] = ['Small', 'Medium', 'Large'];
    return { [category]: bands[seed % bands.length] };
  }
  if (target.beachId === 'morib') {
    return { Plastic: 'Medium', 'Fishing gear': 'Medium', Glass: 'Small' };
  }
  const seed = [...photo.name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const result: QuantityByCategory = {};
  (Object.keys(target.remainingQuantities) as LitterCategory[]).forEach((category, index) => {
    const before = target.remainingQuantities[category];
    if (!before || (seed + index) % 3 === 0) return;
    const beforeUnits = CLEANUP_BAND_UNITS[before];
    const suggestedUnits = Math.max(1, beforeUnits - 1);
    result[category] = (Object.entries(CLEANUP_BAND_UNITS).find(([, units]) => units === suggestedUnits)?.[0] ?? 'Small') as QuantityBand;
  });
  return result;
}

export function formatEventDate(date: string): string {
  const weekday = new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  });
  return `${date} (${weekday})`;
}

export function cleanupTotal(target: CleanupTarget): number {
  return Object.values(target.remainingQuantities).reduce(
    (sum, band) => sum + (band ? CLEANUP_BAND_UNITS[band] : 0),
    0,
  );
}
