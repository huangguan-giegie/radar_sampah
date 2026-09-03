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



// Mock accounts are kept apart by participant number, just as real ones would
// be. 1637 is the seeded demo account. Pool them and a demo proves nothing
// about who can see whose reports.
type MockAccounts = Record<string, LitterReport[]>;

const MOCK_ACCOUNTS_KEY = 'rs_mock_accounts_v2';


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

// Which calendar day a timestamp falls on, in Malaysia.
//
// The duplicate rule below allows one report per day, and "the day" has to be
// the day the volunteer stood on the beach. The phone's own zone gets it wrong
// for anyone travelling, and UTC is 8 hours behind here, so an evening report
// would be filed under the day before.
//
// 'en-CA' is picked only because it formats as 2026-09-02, which lets two days
// be compared as plain strings.
export function localDayInKualaLumpur(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

// Shown to the volunteer on a duplicate. It says the report was kept, because
// "Duplicate" on its own reads like the work was thrown away.
const MOCK_DUPLICATE_STATUS_NOTE =
  'Same participant, beach and local day as an existing counted report. Saved here but excluded from the beach score.';

// One counted report per participant, per beach, per local day.
//
// Beach scores are an average over reports. Without this rule one keen person
// could file ten reports in an afternoon and move a beach's score alone, and
// the map would say more about who is enthusiastic than about where the litter
// is. The extra reports are still saved and still shown to their author.
//
// excludeReportId is passed when a report is being edited, so a report is never
// marked a duplicate of its own earlier version.
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
// only way back into an account, which is why the welcome screen is so blunt
// about writing it down.
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
    const beach = BEACHES.find((b) => b.id === input.beachId) || BEACHES[0];
    // Read the time once and reuse it. If the duplicate check and the saved
    // report each called new Date(), a report made at midnight could be checked
    // against one day and stored under the next.
    const createdAt = new Date().toISOString();
    const status = mockDuplicateStatus(beach.id, createdAt);
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
      status,
      // The note goes only on a duplicate. A counted report has nothing to
      // explain, and an empty grey box would just worry people.
      statusNote: status === 'Duplicate' ? MOCK_DUPLICATE_STATUS_NOTE : undefined,
    };
    replaceCurrentMockReports([report, ...currentMockReports()]);
    return report;
  }

  return request('/reports', 'POST', input);
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
// Editing does not get round the one-a-day rule: the duplicate check runs again
// and can come back Duplicate, for example when the beach is changed to one the
// volunteer already reported today. The report's own id is excluded so it is
// never a duplicate of itself.
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

