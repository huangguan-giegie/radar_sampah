// ============================================================

//

//


//


//

// ============================================================

import { BEACHES, MOCK_USER, SEED_REPORTS } from './mockData';
import { SCORING_METHOD } from './scoring';
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


const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const USE_MOCK = BASE_URL === '';




function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function getToken() {
  return localStorage.getItem('rs_token');
}
function saveToken(token: string) {
  localStorage.setItem('rs_token', token);
}
function clearToken() {
  localStorage.removeItem('rs_token');
}



export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}


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

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
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

function replaceCurrentMockReports(reports: LitterReport[]) {
  mockAccounts = { ...mockAccounts, [currentMockParticipantId()]: reports };
  saveMockAccounts();
}


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
    lastReportedAt: beach.lastReportedAt,
    freshnessKind: beach.freshnessKind,
    habitat: beach.habitat,
    habitatTag: beach.habitatTag,
    sensitivity: beach.sensitivity,
    primarySpeciesGlyph: beach.primarySpeciesGlyph,

    speciesNames: beach.species.map((sp) => sp.name),
    coverImageUrl: beach.coverImageUrl,
    scene: beach.scene,
  };
}

// ============================================================

// ============================================================


export async function createAnonymousId(): Promise<AuthSession> {
  if (USE_MOCK) {
    await delay();
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
  return BEACHES.map(toSummary);
}

export async function getBeach(id: string): Promise<BeachDetail> {
  if (USE_MOCK) {
    await delay();
    const beach = BEACHES.find((b) => b.id === id);
    if (!beach) throw new Error('That beach could not be found.');
    return beach;
  }
  const beach = BEACHES.find((item) => item.id === id);
  if (!beach) throw new Error('That beach could not be found.');
  return beach;
}

// ============================================================


// ============================================================

export async function getScoringMethod(): Promise<ScoringMethod> {
  if (USE_MOCK) return SCORING_METHOD;
  try {
    return await request('/scoring-method');
  } catch {

    return SCORING_METHOD;
  }
}

// ============================================================

// ============================================================


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

  let nearest = BEACHES[0];
  let nearestDistance = distanceKm(lat, lng, nearest.lat, nearest.lng);
  for (const beach of BEACHES) {
    const distance = distanceKm(lat, lng, beach.lat, beach.lng);
    if (distance < nearestDistance) {
      nearest = beach;
      nearestDistance = distance;
    }
  }
  return nearestDistance > 25 ? null : toSummary(nearest);
}

// ============================================================

// ============================================================


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


export function photoPreviewUrl(photoKey: string | null | undefined): string | null {
  if (!photoKey) return null;
  return mockPhotoStore.get(photoKey) ?? null;
}

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
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


  // Raw images are intentionally not stored by the demo API. Retain a local
  // preview for review and submit the report without an image reference.
  const previewUrl = URL.createObjectURL(file);
  const photoKey = 'local/' + Date.now() + '.jpg';
  mockPhotoStore.set(photoKey, previewUrl);
  return { photoKey, previewUrl, metadataStripped: true };
}

// ============================================================

// ============================================================


function deriveCategoryQuantity(q: QuantityByCategory): { category: LitterCategory; quantity: QuantityBand } {
  const order = SCORING_METHOD.categoryWeights;
  const top = order.find((w) => q[w.category] !== undefined);
  if (!top) throw new Error('A report needs at least one category.');
  return { category: top.category, quantity: q[top.category]! };
}

// The public API stores broad coastal areas, not exact beach or GPS locations.
const BACKEND_AREA_BY_BEACH: Record<string, string> = {
  morib: 'kuala-selangor-coast', remis: 'kuala-selangor-coast', kelanang: 'kuala-selangor-coast',
  bagan: 'kuala-selangor-coast', telukbatik: 'kuala-selangor-coast', telukcempedak: 'terengganu-coast',
  tioman: 'tioman-coast',
};
const BACKEND_CATEGORY: Record<LitterCategory, string> = {
  Plastic: 'plastic packaging', 'Fishing gear': 'fishing gear', Glass: 'glass', Metal: 'metal', Paper: 'other', Other: 'other',
};
const BACKEND_QUANTITY: Record<QuantityBand, number> = { Small: 1, Medium: 5, Large: 20, 'Very Large': 50 };

function backendReportToUi(report: { id: number; area_id: string; category: string; quantity: number; created_at: string; image_url?: string | null }): LitterReport {
  const beach = BEACHES.find((item) => BACKEND_AREA_BY_BEACH[item.id] === report.area_id) || BEACHES[0];
  const category = report.category === 'Plastic packaging' ? 'Plastic' : report.category as LitterCategory;
  const quantity: QuantityBand = report.quantity >= 50 ? 'Very Large' : report.quantity >= 20 ? 'Large' : report.quantity >= 5 ? 'Medium' : 'Small';
  return { id: String(report.id), beachId: beach.id, beachName: beach.name, quantities: { [category]: quantity }, category, quantity, createdAt: report.created_at, status: 'Counted', photoUrl: report.image_url || null };
}

export async function createReport(input: CreateReportInput): Promise<LitterReport> {
  if (USE_MOCK) {
    await delay(500);
    const beach = BEACHES.find((b) => b.id === input.beachId) || BEACHES[0];
    const report: LitterReport = {
      id: 'r_' + Date.now(),
      beachId: beach.id,
      beachName: beach.name,
      quantities: input.quantities,
      ...deriveCategoryQuantity(input.quantities),
      photoUrl: mockPhotoStore.get(input.photoKey) ?? null,
      createdAt: new Date().toISOString(),
      status: 'Counted',
    };
    replaceCurrentMockReports([report, ...currentMockReports()]);
    return report;
  }

  const selected = deriveCategoryQuantity(input.quantities);
  const data = await request('/api/litter-reports', 'POST', {
    area_id: BACKEND_AREA_BY_BEACH[input.beachId] || 'kuala-selangor-coast',
    category: BACKEND_CATEGORY[selected.category],
    quantity: BACKEND_QUANTITY[selected.quantity],
    observed_at: new Date().toISOString(),
  });
  return backendReportToUi(data.report);
}

export async function getMyReports(status?: ReportStatus): Promise<LitterReport[]> {
  if (USE_MOCK) {
    await delay(180);
    const reports = currentMockReports();
    if (!status) return reports;
    return reports.filter((r) => r.status === status);
  }

  const data = await request('/api/litter-reports');
  const reports = data.reports.map(backendReportToUi);
  return status ? reports.filter((report: LitterReport) => report.status === status) : reports;
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

  const reports = await getMyReports();
  return { counted: reports.length, duplicate: 0, incomplete: 0 };
}


export async function updateReport(
  id: string,
  changes: Partial<CreateReportInput>,
): Promise<LitterReport> {
  if (USE_MOCK) {
    await delay(300);
    const reports = currentMockReports();
    const index = reports.findIndex((r) => r.id === id);
    if (index < 0) throw new Error('That record could not be found.');

    const old = reports[index];
    const beach = changes.beachId ? BEACHES.find((b) => b.id === changes.beachId) : undefined;
    const updated: LitterReport = {
      ...old,
      ...(changes.quantities
        ? { quantities: changes.quantities, ...deriveCategoryQuantity(changes.quantities) }
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
    return updated;
  }

  throw new Error('Editing submitted reports is not available in this demo. Please create a corrected report.');
}
