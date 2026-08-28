// ============================================================
// 所有和后端打交道的代码都在这个文件里。
//
// 现在没有真后端，所以每个函数都是这个结构：
//
//     if (USE_MOCK) {  返回假数据  }
//     else          {  fetch 真后端  }
//
// 后端做好之后，在 .env 里填上 VITE_API_BASE_URL，USE_MOCK 自动变成 false，
// 下面的 fetch 分支就会生效。页面代码一行都不用改。
//
// 接口的字段和路径写在 API.md 里。
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

// 后端地址。.env 里没填就用假数据。
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const USE_MOCK = BASE_URL === '';

// ---------- 工具 ----------

// 假装网络有延迟，这样加载状态能看出来
function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 登录后拿到的 token，存在浏览器里
function getToken() {
  return localStorage.getItem('rs_token');
}
function saveToken(token: string) {
  localStorage.setItem('rs_token', token);
}
function clearToken() {
  localStorage.removeItem('rs_token');
}

// 发一个请求。出错就抛异常，页面用 try/catch 接住。
/** 请求失败时带上状态码，调用方要靠它区分「没登录」和「连不上」 */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * 带超时的 fetch。后端接受了连接却一直不回时，
 * promise 会永远挂着，按钮就卡在「Saving…」出不来。
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

// ---------- 假数据用到的本地状态 ----------

type MockAccounts = Record<string, LitterReport[]>;

const MOCK_ACCOUNTS_KEY = 'rs_mock_accounts_v2';

// mock 账号也按参与者编号隔离，1637 是演示数据账号。
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

// 两点之间的距离（公里）
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

// 详情去掉三个字段就是列表项
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
    coverImageUrl: beach.coverImageUrl,
    scene: beach.scene,
  };
}

// ============================================================
// 1. 登录（匿名参与者编号）
// ============================================================

// 领一个新编号。就是一个 4 位数字，比如 1637。
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

// 换设备时，输入自己的编号就能继续用。
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
    // 登出失败也要把本地 token 清掉
  }
  clearToken();
}

// 打开网页时问一下「我是谁」。没登录返回 null。
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
    // 401 = 真的没登录；其他都是连不上，不能把用户当成登出
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

// ============================================================
// 2. 海滩
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
// 3. 评分规则（US4.3）
// 规则常量在 src/scoring.ts，前端自带，所以这里永远有结果。
// ============================================================

export async function getScoringMethod(): Promise<ScoringMethod> {
  if (USE_MOCK) return SCORING_METHOD;
  try {
    return await request('/scoring-method');
  } catch {
    // 后端没做这个接口也没关系，用前端自己那份
    return SCORING_METHOD;
  }
}

// ============================================================
// 4. 定位 → 海滩
// ============================================================

// 用一次性坐标找最近的海滩。超过 25 公里就当作不在任何支持的海滩上。
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
// 5. 照片上传
// ============================================================

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  if (USE_MOCK) {
    await delay(700);
    return {
      url: URL.createObjectURL(file),
      metadataStripped: true,
    };
  }

  // 传文件要用 FormData，不能用 JSON
  const form = new FormData();
  form.append('photo', file);
  // 照片可以到 10 MB，弱网上传比 JSON 请求慢得多，所以给 60 秒
  const res = await fetchWithTimeout(
    BASE_URL + '/uploads/photos',
    { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: form },
    60_000,
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || 'Photo upload failed. Please try again.');
  return data;
}

// ============================================================
// 6. 记录
// ============================================================

/**
 * 后端会做的那件事，mock 这边照做一遍：
 * category = 六列里权重最高的那个非空类别，quantity = 该列的值（API.md §2c）。
 */
function deriveCategoryQuantity(q: QuantityByCategory): { category: LitterCategory; quantity: QuantityBand } {
  const order = SCORING_METHOD.categoryWeights;
  const top = order.find((w) => q[w.category] !== undefined);
  if (!top) throw new Error('A report needs at least one category.');
  return { category: top.category, quantity: q[top.category]! };
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
      createdAt: new Date().toISOString(),
      status: 'Counted',
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

// 修正一条记录。改完后端会重新判定，Incomplete 会变回 Counted。
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

  return request('/reports/' + id, 'PATCH', changes);
}

