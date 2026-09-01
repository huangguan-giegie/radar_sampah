// ============================================================

//

//


//


//

// ============================================================

// ============================================================
// EVERY call to the backend lives in this file. No screen calls fetch().
//
// WHY ONE FILE - the screens then depend on function names, not on URLs and
// JSON. When the backend changes a path or a field, only this file changes.
// It is also the only place where authentication, timeouts and error handling
// have to be written, so they cannot be forgotten on one screen out of twenty.
//
// THE MOCK SWITCH - the backend was not ready while the frontend was built,
// so every function has the same shape:
//
//     if (USE_MOCK) {  return believable fake data  }
//     else          {  fetch the real backend       }
//
// With VITE_API_BASE_URL set in .env, USE_MOCK turns itself off, the fetch
// branch takes over, and NOT ONE LINE of screen code changes. That is why the
// frontend could be finished, demoed and usability-tested before the API
// existed.
//
// The paths and field names are agreed in API.md.
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
  UploadedPhoto,
  User,
} from './types';


// The backend address. Empty in .env means "use the mock data".
// The trailing slash is stripped so BASE_URL + '/beaches' can never become a
// double slash, which some servers treat as a different route.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const USE_MOCK = BASE_URL === '';




// Pretend the network is slow. Not padding: without it the mock is instant,
// every spinner and skeleton flashes past unseen, and we would ship loading
// states nobody has ever actually looked at.
function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// The token we get when the user claims a participant number.
//
// localStorage, not sessionStorage: staying signed in across tabs and after
// closing the browser is what people expect from an account. (The report draft
// is the opposite case - see the note in AppContext.tsx.)
function getToken() {
  return localStorage.getItem('rs_token');
}
function saveToken(token: string) {
  localStorage.setItem('rs_token', token);
}
function clearToken() {
  localStorage.removeItem('rs_token');
}



/**
 * An error that still knows the HTTP status.
 *
 * A plain Error flattens every failure into one message, and the caller cannot
 * tell "you are not signed in" (401 - send them to sign in) from "the server is
 * down" (500 - ask them to try again). Two very different things to say to a
 * user, so the status has to survive the throw.
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
 * fetch has NO timeout of its own. If the server accepts the connection and
 * then never answers, the promise simply never settles - so the button stays
 * stuck on "Saving..." for ever and the user's only way out is a refresh,
 * which loses their work. AbortController gives us a way to give up.
 *
 * Both messages are written for a volunteer on a phone at a beach, not for a
 * developer: they say what to try, and never mention status codes.
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

/**
 * One JSON request. Every real-backend call goes through here: it attaches the
 * token, parses the body, and turns any non-2xx answer into an ApiError.
 */
async function request(path: string, method = 'GET', body?: unknown) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetchWithTimeout(
    BASE_URL + path,
    { method, headers, body: body ? JSON.stringify(body) : undefined },
    15_000,
  );

  // 204 means "done, nothing to send back" (logout, for example). Calling
  // res.json() on an empty body throws, so return before we try.
  if (res.status === 204) return null;

  // .catch(() => null) because a crashed server can answer with an HTML error
  // page. We still want to report the status, not a JSON parse error hiding it.
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Prefer the server's own message: it knows why it said no. The fallback is
    // only for when there is nothing readable in the body.
    throw new ApiError(
      data?.message || `Something went wrong (${res.status}). Please try again.`,
      res.status,
      data?.code,
    );
  }
  return data;
}



type MockAccounts = Record<string, LitterReport[]>;

const MOCK_ACCOUNTS_KEY = 'rs_mock_accounts_v2';


// Mock accounts are kept apart by participant number, exactly as real accounts
// would be. 1637 is the seeded demo account. Without this separation a demo
// would show one shared pile of reports and prove nothing about privacy.
function loadMockAccounts(): MockAccounts {
  const saved = localStorage.getItem(MOCK_ACCOUNTS_KEY);
  if (!saved) return { [MOCK_USER.participantId]: SEED_REPORTS.map((report) => ({ ...report })) };

  const parsed: unknown = JSON.parse(saved);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Mock account data is invalid.');
  }
  return parsed as MockAccounts;
}

let mockAccounts = loadMockAccounts();

function saveMockAccounts() {
  localStorage.setItem(MOCK_ACCOUNTS_KEY, JSON.stringify(mockAccounts));
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

// Which calendar day a timestamp falls on, in Malaysia.
//
// The duplicate rule below counts one report per day, and "the day" has to mean
// the day the volunteer was standing on the beach. The phone's own time zone
// would give the wrong day for anyone travelling, and UTC is 8 hours behind
// here - an evening report would be filed as the day before.
//
// 'en-CA' is used only because it formats as 2026-09-02, so two days can be
// compared as plain strings.
export function localDayInKualaLumpur(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

// Shown to the volunteer on a duplicate report. It says the report was kept,
// because "Duplicate" on its own reads like the work was thrown away.
const MOCK_DUPLICATE_STATUS_NOTE =
  'Same participant, beach and local day as an existing counted report. Saved here but excluded from the beach score.';

// One counted report per participant, per beach, per local day.
//
// Beach scores are an average over reports. Without this rule one person at one
// beach could file ten reports in an afternoon and move that beach's score on
// their own, which would make the map say more about who is keen than about
// where the litter is. The extra reports are still saved and still visible to
// their author - only excluded from the score.
//
// excludeReportId is passed when a report is being edited, so a report is never
// compared against itself and marked a duplicate of its own earlier version.
//
// The real backend decides this. The mock copies the rule so a demo behaves the
// same way (API.md).
function mockDuplicateStatus(beachId: string, createdAt: string, excludeReportId?: string): LitterReport['status'] {
  const day = localDayInKualaLumpur(createdAt);
  const duplicate = currentMockReports().some((report) =>
    report.id !== excludeReportId &&
    report.status === 'Counted' &&
    report.beachId === beachId &&
    localDayInKualaLumpur(report.createdAt) === day,
  );
  return duplicate ? 'Duplicate' : 'Counted';
}

function replaceCurrentMockReports(reports: LitterReport[]) {
  mockAccounts = { ...mockAccounts, [currentMockParticipantId()]: reports };
  saveMockAccounts();
}


// Distance between two points in kilometres (the haversine formula, which
// allows for the curve of the Earth). The mock needs it to answer "which beach
// am I standing on"; the real backend does this in the database.
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


// A list item is the full beach with the heavy fields removed. Deriving it,
// instead of keeping a second hand-written copy in mockData.ts, means the list
// and the detail page can never disagree about a beach.
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
    freshnessKind: beach.freshnessKind,
    habitat: beach.habitat,
    habitatTag: beach.habitatTag,
    sensitivity: beach.sensitivity,
    primarySpeciesGlyph: beach.primarySpeciesGlyph,

    // Names are read out of the full cards, so the seed data holds the species
    // list exactly once.
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
// There is no email and no password anywhere in this app. A volunteer gets a
// four digit number and that is their whole account. Less to type on a beach,
// and almost no personal data for us to lose.

// Claim a new number, for example 1637.
export async function createAnonymousId(): Promise<AuthSession> {
  if (USE_MOCK) {
    await delay();
    // Pick from the numbers that are still free, rather than picking at random
    // and hoping. At random, a collision would silently hand the new user
    // somebody else's reports.
    const availableIds = Array.from({ length: 9000 }, (_, index) => String(1000 + index)).filter(
      (id) => !mockAccounts[id],
    );
    if (availableIds.length === 0) throw new Error('No participant IDs are available.');
    const participantId = availableIds[Math.floor(Math.random() * availableIds.length)];
    mockAccounts = { ...mockAccounts, [participantId]: [] };
    saveMockAccounts();
    localStorage.setItem('rs_mock_participant', participantId);
    saveToken('mock-token');
    return {
      token: 'mock-token',
      user: { id: 'u_anon_' + participantId, participantId, role: 'volunteer' },
    };
  }

  const data = await request('/auth/anonymous', 'POST');
  saveToken(data.token);
  return data;
}


// Continue on another device by typing the number you were given. This is the
// only way back into an account, which is why the welcome screen tells the user
// so plainly to write it down.
export async function restoreId(participantId: string): Promise<AuthSession> {
  if (USE_MOCK) {
    await delay();
    const id = participantId.trim();
    if (!/^\d{4}$/.test(id) || !mockAccounts[id]) {
      throw new Error('Participant ID not found.');
    }
    localStorage.setItem('rs_mock_participant', id);
    saveToken('mock-token');
    return {
      token: 'mock-token',
      user: { id: 'u_anon_' + id, participantId: id, role: 'volunteer' },
    };
  }

  const data = await request('/auth/restore', 'POST', { participantId });
  saveToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  if (USE_MOCK) {
    await delay(100);
    clearToken();
    localStorage.removeItem('rs_mock_participant');
    return;
  }
  try {
    await request('/auth/logout', 'POST');
  } catch {

  }
  clearToken();
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

    // 401 is the only answer meaning "this token is no good", so only then do
    // we treat the user as signed out. A 500 or a dropped connection means we
    // do not know; signing them out on that would throw away their draft over
    // a moment of bad signal.
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

// ============================================================

// ============================================================

export async function getBeaches(): Promise<BeachSummary[]> {
  if (USE_MOCK) {
    await delay();
    return BEACHES.map(toSummary);
  }
  return request('/beaches');
}

export async function getBeach(id: string): Promise<BeachDetail> {
  if (USE_MOCK) {
    await delay();
    const beach = BEACHES.find((b) => b.id === id);
    if (!beach) throw new Error('That beach could not be found.');
    return beach;
  }
  return request('/beaches/' + id);
}

// ============================================================


// ============================================================

// The published scoring rules (US4.3). The numbers ship inside the frontend,
// so this can always answer - even with no backend and no connection.
export async function getScoringMethod(): Promise<ScoringMethod> {
  if (USE_MOCK) return SCORING_METHOD;
  try {
    return await request('/scoring-method');
  } catch {

    // If the backend has not built this endpoint yet, fall back to our own copy
    // rather than showing an error. US4.3 promises the public can always read
    // how the score is worked out; a spinner would break that promise.
    return SCORING_METHOD;
  }
}

// ============================================================

// ============================================================


// Find the nearest beach to one set of coordinates.
//
// Past 25 km we return null instead of the nearest beach. Otherwise somebody
// reporting from the city would be quietly filed against a beach an hour away,
// and that wrong report would then count towards its score. "We do not cover
// where you are" is the honest answer, and the UI then offers a manual pick.
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
 * The real backend maps photo_key -> a short-lived signed URL. Same shape, just
 * without the signing, so the screens cannot tell the difference.
 *
 * Written to localStorage for the same reason the mock ledger is. This used to
 * live in memory only, so one refresh emptied the bucket and the photoKey in
 * the saved draft pointed at nothing - the submitted report then had a
 * permanently broken thumbnail.
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

function saveMockPhotos() {
  try {
    localStorage.setItem(MOCK_PHOTOS_KEY, JSON.stringify(Object.fromEntries(mockPhotoStore)));
  } catch {

  }
}


/**
 * Turn a storage key back into something we can show, without waiting.
 *
 * After a refresh the draft's previewUrl is empty - it is megabytes of base64
 * and we deliberately do not write it to disk - so the screens use this to get
 * the preview back.
 *
 * With a real backend it returns null, because there the preview URL has to be
 * asked for and signed. Use refreshPhotoPreview() for that; this one stays
 * synchronous so a screen can render immediately.
 */
export function photoPreviewUrl(photoKey: string | null | undefined): string | null {
  if (!photoKey || !USE_MOCK) return null;
  return mockPhotoStore.get(photoKey) ?? null;
}

/**
 * Ask the backend for a fresh link to a photo we already uploaded.
 *
 * Real photo links are signed and expire after a short time, so a thumbnail
 * that worked ten minutes ago can stop loading. Screens call this to get a new
 * one instead of showing a broken image.
 *
 * The key is escaped because it contains slashes, which would otherwise be read
 * as extra parts of the path. The answer is checked for a real string, so a
 * malformed reply gives a placeholder rather than an image with `undefined` in
 * its address.
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
 * HOW IT WORKS, and why it works: the photo is drawn onto a <canvas> and read
 * back out as a fresh JPEG. A canvas only ever holds pixels, so the EXIF block
 * - which is where the phone writes the exact GPS coordinates, the time and the
 * device model - simply does not survive the trip. There is no "delete the
 * metadata" step that could be missed; the new file never had any.
 *
 * This is the strongest version of the promise the app makes on the location
 * screen. The backend strips EXIF too, but by then the coordinates have already
 * crossed the network. Doing it here means they never leave the phone at all.
 *
 * The 2048px cap is a second benefit: a modern phone photo is 4000px wide and
 * several megabytes, which is slow to upload on beach mobile data and far more
 * detail than a litter report needs. Quality 0.92 keeps it clearly readable.
 *
 * The object URL is revoked in `finally`, because it pins the whole image in
 * memory until it is released - and a volunteer may submit many photos in a
 * session without ever reloading the page.
 */
async function metadataFreePhoto(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not read that photo. Please try another one.'));
      image.src = sourceUrl;
    });
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
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
  // A zero byte file is a real case on phones - a picture that lives in the
  // cloud and has not been downloaded yet can be handed to us empty. Caught
  // here, the volunteer is told to pick another photo. Left alone it would fail
  // much later, in the canvas or the upload, with a message that does not say
  // what to do.
  if (file.size === 0) throw new Error('That photo is empty. Please choose another photo.');
  if (USE_MOCK) {
    await delay(700);


    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read that photo. Please try another one.'));
      reader.readAsDataURL(file);
    });
    const photoKey = 'mock/' + Date.now() + '.jpg';
    mockPhotoStore.set(photoKey, url);
    saveMockPhotos();
    return { photoKey, previewUrl: url, metadataStripped: true };
  }


  // Files go as FormData, not JSON. JSON only carries text, so a photo would
  // have to be base64 - about a third bigger, and slower on a phone.
  const form = new FormData();
  form.append('photo', await metadataFreePhoto(file));

  // 60 seconds here, against 15 for JSON. A photo can be several megabytes and
  // this is an upload from a phone on beach mobile data. Using the same 15
  // seconds would cancel uploads that were going to succeed.
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
 * Which single category represents this report.
 *
 * It is the category with the highest SCORE - weight x amount - not simply the
 * heaviest category present. That difference matters: a small piece of fishing
 * gear (1.0 x 1 = 1.0) should not outrank a very large amount of plastic
 * (0.85 x 4 = 3.4) just because fishing gear is the heavier category.
 *
 * The loop walks SCORING_METHOD.categoryWeights, which is ordered heaviest
 * first, and only replaces the winner on a strictly greater score. So on a tie
 * the heavier category wins, and the answer is always the same for the same
 * report - never dependent on the order the user happened to tap things.
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
    const beach = BEACHES.find((b) => b.id === input.beachId) || BEACHES[0];
    // The time is read once and then reused. If the duplicate check and the
    // saved report each called new Date(), a report made at midnight could be
    // checked against one day and stored under the next.
    const createdAt = new Date().toISOString();
    const status = mockDuplicateStatus(beach.id, createdAt);
    const report: LitterReport = {
      id: 'r_' + Date.now(),
      beachId: beach.id,
      beachName: beach.name,
      quantities: input.quantities,
      ...deriveCategoryQuantity(input.quantities),
      // The full working AND the final number are both stored on the report,
      // so the beach page can show how a score was reached rather than asking
      // the user to take it on trust.
      categoryScores: categoryScoresFor(input.quantities),
      reportScore: reportScoreFor(input.quantities),
      photoUrl: mockPhotoStore.get(input.photoKey) ?? null,
      createdAt,
      status,
      // The note is only attached to a duplicate. On a counted report there is
      // nothing to explain, and an empty grey box would just worry people.
      statusNote: status === 'Duplicate' ? MOCK_DUPLICATE_STATUS_NOTE : undefined,
    };
    replaceCurrentMockReports([report, ...currentMockReports()]);
    return report;
  }

  return request('/reports', 'POST', input);
}

// A volunteer's own reports. Optionally filtered to one status, which is what
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


// Correct a report. It is judged again afterwards, so a report that was
// Incomplete becomes Counted once the missing part is supplied. Without this, a
// volunteer whose report was rejected could never rescue their work.
//
// Editing does NOT get around the one-a-day rule: the duplicate check runs
// again on the edited report, and it can come back Duplicate - for example when
// the beach is changed to one the volunteer already reported today. The
// report's own id is excluded so it is never a duplicate of itself.
//
// The original createdAt is reused, not refreshed. Editing must not move a
// report to today, or a stale report could be dragged back into a fresh day.
//
// Note the scores are recomputed from the new quantities. Leaving the old ones
// would show a corrected report still carrying its original score.
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
    const status = mockDuplicateStatus(beach ? beach.id : old.beachId, old.createdAt, old.id);
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
      status,
      statusNote: status === 'Duplicate' ? MOCK_DUPLICATE_STATUS_NOTE : undefined,
    };

    const nextReports = reports.slice();
    nextReports[index] = updated;
    replaceCurrentMockReports(nextReports);
    return updated;
  }

  return request('/reports/' + id, 'PATCH', changes);
}

