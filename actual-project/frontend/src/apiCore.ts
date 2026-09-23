// ============================================================

//

//


//


//

// ============================================================

// ============================================================
// Every backend call lives here. No screen calls fetch() itself, so auth,
// timeouts and error handling are written once instead of on twenty screens.
//
// Most functions also carry a mock branch: the frontend was built before the
// backend existed, so with VITE_API_BASE_URL unset the app runs on fake data
// and no screen code changes when the real API arrives. Paths and field names
// are agreed in API.md.
// ============================================================

import { BEACHES, MOCK_USER, SEED_REPORTS } from './mockData';
import { categoryScoresFor, reportScoreFor, SCORING_METHOD } from './scoring';
import type {
  AuthSession,
  BeachDetail,
  BeachSummary,
  CreateReportInput,
  LitterCategory,
  LitterReport,
  QuantityBand,
  QuantityByCategory,
  ReportCounts,
  ReportStatus,
  ScoringMethod,
  SpeciesDistributionResult,
  UploadedPhoto,
  User,
} from './types';


// Where the backend lives. Empty in .env means "run on the mock data".
// The trailing slash is stripped so BASE_URL + '/beaches' cannot become a
// double slash, which some servers route differently.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const USE_MOCK = BASE_URL === '';

// Beach summaries are shared by the map and report screens. Keep the value
// synchronous for instant rendering, while getBeaches deduplicates concurrent
// refreshes so a route transition cannot create duplicate requests.
let beachesCache: BeachSummary[] | null = null;
let beachesCacheTimestamp: number | null = null;
let beachesInFlight: Promise<BeachSummary[]> | null = null;
let beachesGeneration = 0;

export function getCachedBeaches(): BeachSummary[] | null {
  return beachesCache;
}

export function getBeachesCacheTimestamp(): number | null {
  return beachesCacheTimestamp;
}

export function invalidateBeaches(): void {
  beachesGeneration += 1;
  beachesCache = null;
  beachesCacheTimestamp = null;
  beachesInFlight = null;
}




// Pretend the network is slow. Without it the mock answers instantly, every
// spinner and skeleton flashes past unseen, and we would ship loading states
// nobody has ever looked at.
function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// The token handed out when a user claims a participant number.
//
// localStorage, not sessionStorage: staying signed in across tabs and after
// closing the browser is what people expect of an account. The report draft is
// the opposite case - see the note in AppContext.tsx.
function getToken() {
  return localStorage.getItem('rs_token');
}
function saveToken(token: string) {
  localStorage.setItem('rs_token', token);
}
function clearToken() {
  localStorage.removeItem('rs_token');
}

// The recovery token handed out when a number is claimed.
//
// The server keeps only a digest of it, so this browser copy is the only way
// the Account screen can hand the same details over a second time. Cleared on
// sign out for the same reason the session token is, and read on screen only.
const RECOVERY_TOKEN_KEY = 'rs_recovery_token';

/** The stored recovery token, or null when this device never claimed a number. */
export function storedRecoveryToken() {
  try {
    return localStorage.getItem(RECOVERY_TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveRecoveryToken(token: string) {
  if (!token) return;
  try {
    localStorage.setItem(RECOVERY_TOKEN_KEY, token);
  } catch {
    // A full or blocked store only costs the re-download, never the sign in.
  }
}

function clearRecoveryToken() {
  try {
    localStorage.removeItem(RECOVERY_TOKEN_KEY);
  } catch {

  }
}



/**
 * An error that still knows its HTTP status.
 *
 * A plain Error flattens every failure into one message, and the caller cannot
 * tell "you are not signed in" (401) from "the server is down" (500). Those
 * need very different things said to the user, so the status has to survive
 * the throw.
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}


/**
 * fetch() with a time limit.
 *
 * fetch has no timeout of its own. If the server accepts the connection and
 * then never answers, the promise never settles - the button sits on
 * "Saving..." for ever and the only way out is a refresh, which loses the
 * user's work. AbortController gives us a way to give up.
 *
 * Both messages are for a volunteer on a phone at a beach: they say what to
 * try, and never mention status codes.
 */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('The server did not respond. Check your connection and try again.');
    }
    throw new Error('Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE_READ_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1_000, 2_000];

function isRetryableRead(method: string) {
  return method === 'GET' || method === 'HEAD';
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get('Retry-After'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1_000, 4_000);
  }
  return RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
}

/**
 * One JSON request. Every real-backend call goes through here: it attaches the
 * token, parses the body, and turns any non-2xx answer into an ApiError.
 */
async function request(path: string, method = 'GET', body?: unknown, timeoutMs = 15_000, includeAuth = true) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = includeAuth ? getToken() : null;
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';

  const init = { method, headers, body: body ? JSON.stringify(body) : undefined };
  const maxAttempts = isRetryableRead(method) ? RETRY_DELAYS_MS.length + 1 : 1;
  let res: Response | null = null;
  let lastNetworkError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      res = await fetchWithTimeout(BASE_URL + path, init, timeoutMs);
      if (!isRetryableRead(method) || !RETRYABLE_READ_STATUSES.has(res.status) || attempt === maxAttempts - 1) {
        break;
      }
      await delay(retryDelayMs(res, attempt));
    } catch (error) {
      lastNetworkError = error instanceof Error
        ? error
        : new Error('Could not reach the server. Check your connection and try again.');
      // A timeout needs the full cold-start window; retry only fast network/CORS failures.
      if (!isRetryableRead(method) || lastNetworkError.message.includes('server did not respond') || attempt === maxAttempts - 1) {
        throw lastNetworkError;
      }
      await delay(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
    }
  }

  if (!res) throw lastNetworkError ?? new Error('Could not reach the server. Check your connection and try again.');

  // 204 means "done, nothing to send back" - logout, for example. Calling
  // res.json() on an empty body throws, so return before we try.
  if (res.status === 204) return null;

  // A crashed server can answer with an HTML error page. Swallowing the parse
  // failure keeps the status visible instead of hiding it behind a JSON error.
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Prefer the server's own message; it knows why it said no. The fallback
    // only covers a body with nothing readable in it.
    throw new ApiError(
      data?.message || `Something went wrong (${res.status}). Please try again.`,
      res.status,
      data?.code,
    );
  }
  return data;
}

// New Iteration 2 screens use the same request pipeline as the established
// API. Keep one exported name at this boundary so auth, timeout and errors do
// not get reimplemented in the feature adapter.
export async function apiRequest<T = any>(
  path: string,
  method = 'GET',
  body?: unknown,
  timeoutMs = 15_000,
  includeAuth = true,
): Promise<T> {
  return request(path, method, body, timeoutMs, includeAuth) as Promise<T>;
}

// Iteration 2 endpoints live here alongside the original API so they share
// bearer-token handling, timeouts and server error messages with every screen.
export function getIteration2Events(beachId?: string, includeAuth = true): Promise<any[]> {
  const query = beachId ? `?beachId=${encodeURIComponent(beachId)}` : '';
  return request(`/events${query}`, 'GET', undefined, 15_000, includeAuth);
}

export function getIteration2Event(eventId: string): Promise<any> {
  return request(`/events/${encodeURIComponent(eventId)}`);
}

export function joinIteration2Event(eventId: string): Promise<any> {
  return request(`/events/${encodeURIComponent(eventId)}/join`, 'POST', {});
}

export function leaveIteration2Event(eventId: string): Promise<any> {
  return request(`/events/${encodeURIComponent(eventId)}/join`, 'DELETE');
}

export function checkInIteration2Event(eventId: string, coords: { lat: number; lng: number }): Promise<any> {
  return request(`/events/${encodeURIComponent(eventId)}/check-in`, 'POST', coords);
}

export function getIteration2Targets(beachId?: string, reportId?: string, includeAuth = true): Promise<any[]> {
  const params = new URLSearchParams();
  if (beachId) params.set('beachId', beachId);
  if (reportId) params.set('reportId', reportId);
  const query = params.size ? `?${params.toString()}` : '';
  return request(`/cleanup-targets${query}`, 'GET', undefined, 15_000, includeAuth);
}

export function createIteration2Cleanup(input: {
  targetReportId: string;
  eventId?: string | null;
  removed: Record<string, number>;
  handling: string;
  note?: string;
  idempotencyKey: string;
}): Promise<any> {
  return request('/cleanup-actions', 'POST', input);
}

export function getIteration2MyCleanups(): Promise<any[]> {
  return request('/cleanups/mine');
}

export function getIteration2EventCleanups(eventId: string): Promise<any[]> {
  return request(`/events/${encodeURIComponent(eventId)}/cleanups`);
}

export function createIteration2ShareLink(input: { eventId?: string; reportId?: string }): Promise<{ token: string; path: string }> {
  const query = new URLSearchParams();
  if (input.eventId) query.set('eventId', input.eventId);
  if (input.reportId) query.set('reportId', input.reportId);
  return request(`/share-links?${query.toString()}`);
}

export function getIteration2SharedItems(token: string): Promise<{ event: any | null; report: any | null }> {
  return request(`/share-links/${encodeURIComponent(token)}`);
}

export function iteration2SharedPhotoUrl(token: string): string {
  return BASE_URL + `/share-links/${encodeURIComponent(token)}/photo`;
}

export function createIteration2Event(input: { beachId: string; date: string }): Promise<any> {
  return request('/events', 'POST', input);
}

export function recognizeReportPhoto(photoKey: string): Promise<any> {
  return request('/recognitions', 'POST', { photoKey });
}

export async function recognizeCleanupPhoto(photo: File): Promise<any> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  const form = new FormData();
  form.append('photo', photo);
  const res = await fetchWithTimeout(
    BASE_URL + '/recognitions/cleanup-photo',
    { method: 'POST', headers, body: form },
    30_000,
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || `Something went wrong (${res.status}). Please try again.`, res.status, data?.code);
  return data;
}



// Mock accounts are kept apart by participant number, just as real ones would
// be. 1637 is the seeded demo account. Pool them and a demo proves nothing
// about who can see whose reports.
type MockAccounts = Record<string, LitterReport[]>;
type MockRecoveryTokens = Record<string, string>;

const MOCK_ACCOUNTS_KEY = 'rs_mock_accounts_v2';
const MOCK_RECOVERY_TOKENS_KEY = 'rs_mock_recovery_tokens_v1';


// Falls back to the seed rather than throwing.
//
// This runs at module scope, so a throw here happens BEFORE React mounts and
// nothing can catch it: the whole app went white, no text, no error, no way
// back except clearing site data - which there is no screen left to say. Any
// junk in this one key did it. A string, an array, a truncated write from a
// tab that was closed mid-save.
//
// Bad stored data is not worth an app for. We start over from the seed, and
// drop the unusable value so the next write is clean.
function loadMockAccounts(): MockAccounts {
  const seed = (): MockAccounts => ({ [MOCK_USER.participantId]: SEED_REPORTS.map((report) => ({ ...report })) });
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(MOCK_ACCOUNTS_KEY);
  } catch {
    return seed();
  }
  if (!saved) return seed();

  try {
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    // Every value has to be an array of reports, or the screens that map over
    // one will throw later instead - further from the cause and harder to read.
    for (const reports of Object.values(parsed as Record<string, unknown>)) {
      if (!Array.isArray(reports)) throw new Error('not a report list');
    }
    return parsed as MockAccounts;
  } catch {
    try {
      localStorage.removeItem(MOCK_ACCOUNTS_KEY);
    } catch {
      // Storage is unwritable too. The seed still works for this session.
    }
    return seed();
  }
}

let mockAccounts = loadMockAccounts();

function loadMockRecoveryTokens(): MockRecoveryTokens {
  const seeded = { [MOCK_USER.participantId]: 'RS-DEMO-1637-RADAR' };
  try {
    const saved = localStorage.getItem(MOCK_RECOVERY_TOKENS_KEY);
    if (!saved) return seeded;
    const parsed: unknown = JSON.parse(saved);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...seeded, ...(parsed as MockRecoveryTokens) }
      : seeded;
  } catch {
    return seeded;
  }
}

let mockRecoveryTokens = loadMockRecoveryTokens();

function saveMockRecoveryTokens() {
  try {
    localStorage.setItem(MOCK_RECOVERY_TOKENS_KEY, JSON.stringify(mockRecoveryTokens));
  } catch {
    // Mock authentication still works for this tab when storage is unavailable.
  }
}

function makeMockRecoveryToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `RS-${raw.match(/.{1,4}/g)?.join('-') ?? raw}`;
}

// Never let storage take down a submit.
//
// This was the throw the user actually saw: a large photo filled the quota, and
// the next write - this one, during submit - failed with the browser's own
// message, so "Submit Report" answered with
// "Failed to execute 'setItem' on 'Storage': Setting the value of
// 'rs_mock_accounts_v2'..." in the error box.
//
// The report is already in mockAccounts in memory by this point, so the
// submission itself has succeeded; only its persistence across a reload is at
// risk. Dropping the photo previews frees the space they were taking, and if
// even that is not enough we carry on rather than failing the submit.
function saveMockAccounts() {
  try {
    localStorage.setItem(MOCK_ACCOUNTS_KEY, JSON.stringify(mockAccounts));
  } catch {
    mockPhotoStore.clear();
    try {
      localStorage.removeItem(MOCK_PHOTOS_KEY);
      localStorage.setItem(MOCK_ACCOUNTS_KEY, JSON.stringify(mockAccounts));
    } catch {
      // Out of room for good. The reports live in memory for this session.
    }
  }
}

function currentMockParticipantId(): string {
  const participantId = localStorage.getItem('rs_mock_participant');
  if (!participantId || !mockAccounts[participantId]) {
    throw new Error('No active mock participant.');
  }
  return participantId;
}

function currentMockReports(): LitterReport[] {
  return mockAccounts[currentMockParticipantId()];
}

function replaceCurrentMockReports(reports: LitterReport[]) {
  mockAccounts = { ...mockAccounts, [currentMockParticipantId()]: reports };
  saveMockAccounts();
}


// Kilometres between two points, by the haversine formula, which allows for the
// curve of the Earth. The mock needs it to answer "which beach am I on"; the
// real backend does this in the database.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}


// A list item is the full beach with the heavy fields dropped. Deriving it,
// rather than hand-writing a second copy in mockData.ts, means the list and the
// detail page can never disagree about a beach.
function toSummary(beach: BeachDetail): BeachSummary {
  return {
    id: beach.id,
    name: beach.name,
    area: beach.area,
    lat: beach.lat,
    lng: beach.lng,
    severity: beach.severity,
    band: beach.band,
    insufficientData: beach.insufficientData,
    validReports: beach.validReports,
    attentionScore: beach.attentionScore,
    eligibleReportCount: beach.eligibleReportCount,
    lastReportedAt: beach.lastReportedAt,
    newestCountedReportAt: beach.newestCountedReportAt,
    latestContributingReportAt: beach.latestContributingReportAt,
    freshnessKind: beach.freshnessKind,
    habitat: beach.habitat,
    habitatTag: beach.habitatTag,
    sensitivity: beach.sensitivity,
    primarySpeciesGlyph: beach.primarySpeciesGlyph,

    // Names are read out of the full cards, so the seed holds the species list
    // exactly once.
    speciesNames: beach.species.map((sp) => sp.name),
    coverImageUrl: beach.coverImageUrl,
    scene: beach.scene,
  };
}

// ============================================================

// ============================================================


// ============================================================
// Identity (an anonymous participant number)
// ============================================================
//
// No email and no password anywhere in this app. A volunteer gets a four digit
// number and that is the whole account: less to type on a beach, and almost no
// personal data for us to lose.

// Claim a new number, for example 1637.
export async function createAnonymousId(): Promise<AuthSession> {
  if (USE_MOCK) {
    await delay();
    // Pick from the numbers still free rather than picking at random and
    // hoping. A collision would quietly hand the new user someone else's
    // reports.
    const availableIds = Array.from({ length: 9000 }, (_, index) => String(1000 + index)).filter(
      (id) => !mockAccounts[id],
    );
    if (availableIds.length === 0) throw new Error('No participant IDs are available.');
    const participantId = availableIds[Math.floor(Math.random() * availableIds.length)];
    mockAccounts = { ...mockAccounts, [participantId]: [] };
    const recoveryToken = makeMockRecoveryToken();
    mockRecoveryTokens = { ...mockRecoveryTokens, [participantId]: recoveryToken };
    saveMockAccounts();
    saveMockRecoveryTokens();
    localStorage.setItem('rs_mock_participant', participantId);
    const sessionToken = `mock-session-${participantId}-${Date.now()}`;
    saveToken(sessionToken);
    saveRecoveryToken(recoveryToken);
    return {
      token: sessionToken,
      recoveryToken,
      user: { id: 'u_anon_' + participantId, participantId, role: 'volunteer' },
    };
  }

  const data = await request('/auth/anonymous', 'POST');
  saveToken(data.token);
  saveRecoveryToken(data.recoveryToken);
  return data;
}


// Continue on another device by typing the number you were given. This is the
// only way back into an account, which is why the welcome screen is so blunt
// about writing it down.
export async function restoreId(participantId: string, token = ''): Promise<AuthSession> {
  if (USE_MOCK) {
    await delay();
    const id = participantId.trim();
    if (!/^\d{4}$/.test(id) || !mockAccounts[id]) {
      throw new Error('Participant ID not found.');
    }
    const suppliedToken = token.trim().toUpperCase();
    if (suppliedToken && mockRecoveryTokens[id]?.toUpperCase() !== suppliedToken) {
      throw new Error('That participant ID and recovery token do not match.');
    }
    localStorage.setItem('rs_mock_participant', id);
    const sessionToken = `mock-session-${id}-${Date.now()}`;
    saveToken(sessionToken);
    saveRecoveryToken(suppliedToken);
    return {
      token: sessionToken,
      user: { id: 'u_anon_' + id, participantId: id, role: 'volunteer' },
    };
  }

  const data = await request('/auth/restore', 'POST', { participantId, ...(token.trim() ? { token: token.trim() } : {}) });
  saveToken(data.token);
  saveRecoveryToken(token.trim());
  return data;
}

export async function logout(): Promise<void> {
  if (USE_MOCK) {
    await delay(100);
    clearToken();
    clearRecoveryToken();
    localStorage.removeItem('rs_mock_participant');
    return;
  }
  try {
    await request('/auth/logout', 'POST');
  } catch {

  }
  clearToken();
  clearRecoveryToken();
}


// Ask the server who this token belongs to when the app opens. null when
// nobody is signed in.
export async function getMe(): Promise<User | null> {
  if (USE_MOCK) {
    await delay(80);
    if (!getToken()) return null;
    const participantId = localStorage.getItem('rs_mock_participant');
    if (!participantId || !mockAccounts[participantId]) {
      clearToken();
      return null;
    }
    return { id: 'u_anon_' + participantId, participantId, role: 'volunteer' };
  }

  if (!getToken()) return null;
  try {
    return await request('/auth/me');
  } catch (err) {

    // 401 is the only answer that means "this token is dead", so only then do
    // we drop it and report nobody signed in. A 500 or a lost connection tells
    // us nothing; signing the user out on that would throw away their draft
    // over a moment of bad signal.
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      return null;
    }
    throw err;
  }
}

export async function getSpeciesDistribution(latitude: number, longitude: number): Promise<SpeciesDistributionResult> {
  if (USE_MOCK) {
    throw new Error('Species distribution model is not enabled in mock mode.');
  }
  // The model receives a beach's broad-area coordinate and returns context, not a litter score.
  return request('/api/species-distribution/predict', 'POST', { latitude, longitude });
}

// ============================================================

// ============================================================

export async function getBeaches(): Promise<BeachSummary[]> {
  if (beachesInFlight) return beachesInFlight;
  const generation = beachesGeneration;
  const flight = (async () => {
    const list = USE_MOCK
      ? (await delay(), BEACHES.map(toSummary))
      // Render's free instance can take longer than the normal JSON timeout to
      // wake up. Keep the public map request alive so a cold start does not look
      // like an empty beach list.
      : await request('/beaches', 'GET', undefined, 60_000, false);
    if (generation === beachesGeneration) {
      beachesCache = list;
      beachesCacheTimestamp = Date.now();
    }
    return list;
  })();
  beachesInFlight = flight;
  try {
    return await flight;
  } finally {
    if (beachesInFlight === flight) beachesInFlight = null;
  }
}

export async function getBeach(id: string): Promise<BeachDetail> {
  if (USE_MOCK) {
    await delay();
    const beach = BEACHES.find((b) => b.id === id);
    if (!beach) throw new Error('That beach could not be found.');
    return beach;
  }
  return request('/beaches/' + id, 'GET', undefined, 60_000, false);
}

// ============================================================


// ============================================================

// The published scoring rules (US4.3). The numbers ship inside the frontend, so
// this can always answer, even with no backend and no connection.
export async function getScoringMethod(): Promise<ScoringMethod> {
  if (USE_MOCK) return SCORING_METHOD;
  try {
    return await request('/scoring-method');
  } catch {

    // The backend may not have built this endpoint yet. Falling back to our own
    // copy keeps the US4.3 promise that anyone can read how the score is worked
    // out; an error screen would break it.
    return SCORING_METHOD;
  }
}

// ============================================================

// ============================================================


// Find the nearest beach to one set of coordinates.
//
// Past 25 km we answer null instead of the nearest beach. Otherwise someone
// reporting from the city gets quietly filed against a beach an hour away, and
// that wrong report counts towards its score. "We do not cover where you are"
// is the honest answer, and the UI then offers a manual pick.
export async function resolveBeach(lat: number, lng: number): Promise<BeachSummary | null> {
  if (USE_MOCK) {
    await delay(600);
    let nearest = BEACHES[0];
    let nearestDistance = distanceKm(lat, lng, nearest.lat, nearest.lng);
    for (const beach of BEACHES) {
      const d = distanceKm(lat, lng, beach.lat, beach.lng);
      if (d < nearestDistance) {
        nearest = beach;
        nearestDistance = d;
      }
    }
    if (nearestDistance > 25) return null;
    return toSummary(nearest);
  }

  return request('/geo/resolve-beach', 'POST', { lat, lng });
}

// ============================================================

// ============================================================


/**
 * The mock "object store": key -> data URL.
 *
 * The real backend maps photo_key to a short-lived signed URL. Same shape,
 * without the signing, so the screens cannot tell the difference.
 *
 * It is written to localStorage for the same reason the mock ledger is. This
 * once lived in memory only, so a refresh emptied the bucket and the photoKey in
 * the saved draft pointed at nothing - a permanently broken thumbnail.
 */
const MOCK_PHOTOS_KEY = 'rs_mock_photos_v1';

function loadMockPhotos(): Map<string, string> {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(MOCK_PHOTOS_KEY) || '{}')));
  } catch {
    return new Map();
  }
}

const mockPhotoStore = loadMockPhotos();

// Returns whether the store actually persisted.
//
// It used to swallow the failure and carry on, which is how a photo could be
// "saved", survive to the review screen, and then be a broken image after a
// reload. On a quota error we drop the oldest previews and retry - this is a
// stand-in for object storage, so the older ones are the expendable ones.
function saveMockPhotos(): boolean {
  const write = () => localStorage.setItem(MOCK_PHOTOS_KEY, JSON.stringify(Object.fromEntries(mockPhotoStore)));
  try {
    write();
    return true;
  } catch {
    const keys = [...mockPhotoStore.keys()];
    for (const key of keys.slice(0, Math.max(0, keys.length - 1))) {
      mockPhotoStore.delete(key);
      try {
        write();
        return true;
      } catch {
        // Still over. Keep evicting.
      }
    }
    return false;
  }
}


/**
 * Turn a storage key back into something showable, without waiting.
 *
 * After a refresh the draft's previewUrl is gone - it is megabytes of base64 and
 * we deliberately never write it to disk - so screens use this to get the
 * preview back.
 *
 * Against a real backend it returns null, because there a preview URL has to be
 * asked for and signed. Use refreshPhotoPreview() for that; this one stays
 * synchronous so a screen can render straight away.
 */
export function photoPreviewUrl(photoKey: string | null | undefined): string | null {
  if (!photoKey || !USE_MOCK) return null;
  return mockPhotoStore.get(photoKey) ?? null;
}

/**
 * Ask the backend for a fresh link to a photo we already uploaded.
 *
 * Real photo links are signed and expire, so a thumbnail that worked ten minutes
 * ago can stop loading. Screens call this instead of showing a broken image.
 *
 * The key is escaped because it contains slashes, which would otherwise read as
 * extra path segments. The reply is checked for a real string, so a malformed
 * answer gives a placeholder rather than an image address with `undefined` in
 * it.
 */
export async function refreshPhotoPreview(photoKey: string | null | undefined): Promise<string | null> {
  if (!photoKey) return null;
  if (USE_MOCK) return photoPreviewUrl(photoKey);
  const data = await request(`/uploads/photos/${encodeURIComponent(photoKey)}/preview-url`);
  return typeof data?.previewUrl === 'string' ? data.previewUrl : null;
}

/**
 * Strip the location out of a photo before it ever leaves the device.
 *
 * The photo is drawn onto a <canvas> and read back as a fresh JPEG. A canvas
 * holds only pixels, so the EXIF block - where the phone writes exact GPS
 * coordinates, the time and the device model - does not survive the trip. There
 * is no "delete the metadata" step that could be missed; the new file never had
 * any.
 *
 * This is the strongest form of the promise made on the location screen. The
 * backend strips EXIF too, but by then the coordinates have already crossed the
 * network. Doing it here means they never leave the phone.
 *
 * Quality 0.92 keeps the result clearly readable. The object URL is revoked in
 * `finally` because it pins the whole image in memory until released, and a
 * volunteer may submit many photos without ever reloading the page.
 */
// maxEdge: 2048 is what the backend wants. The mock passes something smaller,
// because there the photo is not going to object storage - it goes into
// localStorage as base64, where a 2048px frame costs about 1.3 MB per report
// and the whole quota is around 5 MB. Four reports and the demo stops
// persisting. The preview is never displayed wider than about 350 CSS px.
async function metadataFreePhoto(file: File, maxEdge = 2048): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not read that photo. Please try another one.'));
      image.src = sourceUrl;
    });
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process that photo. Please try another one.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not process that photo. Please try another one.')), 'image/jpeg', 0.92);
    });
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  // A zero byte file is a real case on phones: a picture that lives in the cloud
  // and has not been downloaded yet arrives empty. Caught here, the volunteer is
  // told to pick another. Left alone it fails much later, in the canvas or the
  // upload, with a message that does not say what to do.
  if (file.size === 0) throw new Error('That photo is empty. Please choose another photo.');
  if (USE_MOCK) {
    await delay(700);

    // Through the same canvas re-encode the real path uses, for two reasons.
    //
    // It makes the promise true. This branch used to read the ORIGINAL file
    // and return metadataStripped: true, so the screen said "LOCATION METADATA
    // REMOVED" over a photo that still carried its GPS EXIF. Re-encoding
    // through a canvas is what actually drops it.
    //
    // And it makes the photo fit. An ordinary 1.9 MB phone photo becomes about
    // 2.6 MB as a base64 data URL, which alone overflows the ~5 MB localStorage
    // quota. The write failed silently here, and the NEXT write - the accounts
    // blob, on submit - threw, so submitting a normal photo died with a raw
    // "Failed to execute 'setItem' on 'Storage'" in the error box.
    const stripped = await metadataFreePhoto(file, 1280);
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read that photo. Please try another one.'));
      reader.readAsDataURL(stripped);
    });
    const photoKey = 'mock/' + Date.now() + '.jpg';
    mockPhotoStore.set(photoKey, url);
    if (!saveMockPhotos()) {
      // Still too big even after the re-encode. Keep the preview for this
      // session but do not pretend it survived - photoPreviewUrl reads the
      // same map, so leaving a key we could not persist is what produced a
      // grey box with broken-image alt text after a reload.
      mockPhotoStore.delete(photoKey);
      return { photoKey, previewUrl: url, metadataStripped: true };
    }
    return { photoKey, previewUrl: url, metadataStripped: true };
  }


  // Files go as FormData, not JSON. JSON carries only text, so a photo would
  // have to be base64 - about a third bigger, and slower on a phone.
  const form = new FormData();
  form.append('photo', await metadataFreePhoto(file));

  // 60 seconds here against 15 for JSON. A photo can be several megabytes, sent
  // from a phone on beach mobile data. The shorter limit would cancel uploads
  // that were about to succeed.
  const res = await fetchWithTimeout(
    BASE_URL + '/uploads/photos',
    { method: 'POST', headers: { Accept: 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) }, body: form },
    60_000,
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || 'Photo upload failed. Please try again.', res.status, data?.code);
  return data;
}

// ============================================================

// ============================================================


/**
 * Which single category stands for this report.
 *
 * It is the category with the highest score - weight x amount - not simply the
 * heaviest category present. A small piece of fishing gear (1.0 x 1 = 1.0)
 * should not outrank a very large amount of plastic (0.85 x 4 = 3.4).
 *
 * The loop walks SCORING_METHOD.categoryWeights, which is ordered heaviest
 * first, and only replaces the winner on a strictly greater score. So ties go to
 * the heavier category, and the answer never depends on the order the user
 * happened to tap things.
 *
 * The backend does exactly this. The mock repeats it so a demo and the real
 * thing cannot disagree (API.md section 2c).
 */
function deriveCategoryQuantity(q: QuantityByCategory): { category: LitterCategory; quantity: QuantityBand } {
  let selected: { category: LitterCategory; quantity: QuantityBand; score: number } | undefined;
  const scores = categoryScoresFor(q);
  for (const { category } of SCORING_METHOD.categoryWeights) {
    const quantity = q[category];
    if (!quantity) continue;
    const score = scores[category] ?? 0;
    if (!selected || score > selected.score) selected = { category, quantity, score };
  }
  if (!selected) throw new Error('A report needs at least one category.');
  return { category: selected.category, quantity: selected.quantity };
}

export async function createReport(input: CreateReportInput): Promise<LitterReport> {
  if (USE_MOCK) {
    await delay(500);
    // Same status and code as the backend's 422, so the review screen can tell
    // this rule apart from a real failure in the demo as well.
    if (Object.values(input.quantities).every((band) => band === 'Small')) {
      throw new ApiError(
        'This report is below the active litter threshold because every confirmed category is Small.',
        422,
        'SMALL_ONLY_REPORT',
      );
    }
    const beach = BEACHES.find((b) => b.id === input.beachId) || BEACHES[0];
    const createdAt = new Date().toISOString();
    const report: LitterReport = {
      id: 'r_' + Date.now(),
      beachId: beach.id,
      beachName: beach.name,
      quantities: input.quantities,
      ...deriveCategoryQuantity(input.quantities),
      // Keep the per-category working next to the total. A stored score can
      // then be explained from the report itself, without recomputing it from
      // the quantities and hoping the rules have not moved.
      categoryScores: categoryScoresFor(input.quantities),
      reportScore: reportScoreFor(input.quantities),
      photoUrl: mockPhotoStore.get(input.photoKey) ?? null,
      createdAt,
      status: 'Counted',
    };
    replaceCurrentMockReports([report, ...currentMockReports()]);
    invalidateBeaches();
    return report;
  }

  const report = await request('/reports', 'POST', input);
  invalidateBeaches();
  return report;
}

// A volunteer's own reports, optionally narrowed to one status - which is what
// the three tiles on the home page link into.
export async function getMyReports(status?: ReportStatus): Promise<LitterReport[]> {
  if (USE_MOCK) {
    await delay(180);
    const reports = currentMockReports();
    if (!status) return reports;
    return reports.filter((r) => r.status === status);
  }

  return request('/reports/mine' + (status ? '?status=' + status : ''));
}

export async function getMyReportCounts(): Promise<ReportCounts> {
  if (USE_MOCK) {
    await delay(80);
    const reports = currentMockReports();
    return {
      counted: reports.filter((r) => r.status === 'Counted').length,
      duplicate: reports.filter((r) => r.status === 'Duplicate').length,
      incomplete: reports.filter((r) => r.status === 'Incomplete').length,
    };
  }

  return request('/reports/mine/counts');
}


// Correct a report. It is judged again afterwards, so an Incomplete report
// becomes Counted once the missing part is supplied. Without this, a volunteer
// whose report was rejected could never rescue their work.
//
// The original createdAt is reused, not refreshed. Editing must not move a
// report into today, or a stale one could be dragged back into a fresh day.
//
// Scores are recomputed from the new quantities; leaving the old ones would show
// a corrected report still carrying its original score.
export async function updateReport(
  id: string,
  changes: Partial<CreateReportInput>,
): Promise<LitterReport> {
  if (USE_MOCK) {
    await delay(300);
    const reports = currentMockReports();
    const index = reports.findIndex((r) => r.id === id);
    if (index < 0) throw new Error('That report could not be found.');

    const old = reports[index];
    const beach = changes.beachId ? BEACHES.find((b) => b.id === changes.beachId) : undefined;
    const updated: LitterReport = {
      ...old,
      ...(changes.quantities
        ? {
            quantities: changes.quantities,
            ...deriveCategoryQuantity(changes.quantities),
            categoryScores: categoryScoresFor(changes.quantities),
            reportScore: reportScoreFor(changes.quantities),
          }
        : { quantities: old.quantities, category: old.category, quantity: old.quantity }),
      photoUrl: changes.photoKey ? mockPhotoStore.get(changes.photoKey) ?? null : old.photoUrl,
      beachId: beach ? beach.id : old.beachId,
      beachName: beach ? beach.name : old.beachName,
      status: 'Counted',
      statusNote: undefined,
    };

    const nextReports = reports.slice();
    nextReports[index] = updated;
    replaceCurrentMockReports(nextReports);
    invalidateBeaches();
    return updated;
  }

  const report = await request('/reports/' + id, 'PATCH', changes);
  invalidateBeaches();
  return report;
}
