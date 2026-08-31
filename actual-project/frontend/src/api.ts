// ============================================================

//

//


//


//

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
    this.name = 'ApiError';
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

function mockDuplicateStatus(beachId: string, createdAt: string, excludeReportId?: string): LitterReport['status'] {
  const day = new Date(createdAt).toISOString().slice(0, 10);
  const duplicate = currentMockReports().some((report) =>
    report.id !== excludeReportId &&
    report.status === 'Counted' &&
    report.beachId === beachId &&
    new Date(report.createdAt).toISOString().slice(0, 10) === day,
  );
  return duplicate ? 'Duplicate' : 'Counted';
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
    attentionScore: beach.attentionScore,
    eligibleReportCount: beach.eligibleReportCount,
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

  return request('/geo/resolve-beach', 'POST', { lat, lng });
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
  if (!photoKey || !USE_MOCK) return null;
  return mockPhotoStore.get(photoKey) ?? null;
}

export async function refreshPhotoPreview(photoKey: string | null | undefined): Promise<string | null> {
  if (!photoKey) return null;
  if (USE_MOCK) return photoPreviewUrl(photoKey);
  const data = await request(`/uploads/photos/${encodeURIComponent(photoKey)}/preview-url`);
  return typeof data?.previewUrl === 'string' ? data.previewUrl : null;
}

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


  const form = new FormData();
  form.append('photo', await metadataFreePhoto(file));

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
    const report: LitterReport = {
      id: 'r_' + Date.now(),
      beachId: beach.id,
      beachName: beach.name,
      quantities: input.quantities,
      ...deriveCategoryQuantity(input.quantities),
      categoryScores: categoryScoresFor(input.quantities),
      reportScore: reportScoreFor(input.quantities),
      photoUrl: mockPhotoStore.get(input.photoKey) ?? null,
      createdAt: new Date().toISOString(),
      status: mockDuplicateStatus(beach.id, new Date().toISOString()),
    };
    replaceCurrentMockReports([report, ...currentMockReports()]);
    return report;
  }

  return request('/reports', 'POST', input);
}

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
      status: mockDuplicateStatus(beach ? beach.id : old.beachId, old.createdAt, old.id),
      statusNote: undefined,
    };

    const nextReports = reports.slice();
    nextReports[index] = updated;
    replaceCurrentMockReports(nextReports);
    return updated;
  }

  return request('/reports/' + id, 'PATCH', changes);
}

