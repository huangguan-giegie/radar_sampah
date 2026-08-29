// 全局状态：当前用户、记录草稿、提示条。
//
// 用 React 自带的 Context，不装第三方状态库。
// 任何组件里写 const { user } = useApp() 就能拿到。

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createAnonymousId, getMe, logout } from './api';
import type { LitterReport, QuantityByCategory, UploadedPhoto, User } from './types';
import { restoreId as apiRestoreId } from './api';

// 「记录垃圾」这个流程分 3 步，中间填的东西先存在这里，提交成功后清空
export type ReportDraft = {
  photo: UploadedPhoto | null;
  existingPhotoUrl: string | null;
  beachId: string | null;
  /** 和 beachId 一起写。Review 页不用等 /beaches 回来才能显示名字 */
  beachName: string | null;
  locationSource: 'gps' | 'manual' | null;
  coords: { lat: number; lng: number } | null;
  quantities: QuantityByCategory;
  /**
   * 定位为什么没成 —— 确认页要按原因说不同的话。
   * 一个布尔位说不清：「拒绝了」和「设备定不到」「超时了」「定得太糙」
   * 是四件事，都说成「权限被拒绝」等于告诉用户去改一个他没改过的设置。
   */
  gpsIssue: 'denied' | 'unavailable' | 'timeout' | 'inaccurate' | 'noBeach' | 'failed' | null;
  editingReportId: string | null; // 正在修正已有记录时存它的 id
};

// 注意：这个函数故意不 export。
// 一个文件里同时导出「组件」和「普通函数」会让 Vite 的热更新出问题。
function emptyDraft(): ReportDraft {
  return {
    photo: null,
    existingPhotoUrl: null,
    beachId: null,
    beachName: null,
    locationSource: null,
    coords: null,
    quantities: {},
    gpsIssue: null,
    editingReportId: null,
  };
}

/*
 * 草稿要活过一次刷新。
 *
 * 这是网页和手机 app 的区别：上报要走 6 步，中途按 F5、下拉刷新、或者相机
 * 权限弹窗把页面顶掉，草稿就没了 —— 照片、海滩、类别全清空，从头再来。
 * 手机 app 切后台回来状态还在，网页不会。
 *
 * 用 sessionStorage 不用 localStorage：上面三种情况都发生在同一个标签页里，
 * sessionStorage 全都能撑过去，同时天然避开「两个标签页各走到不同步骤、
 * 互相覆盖同一份草稿」。api.ts 里用 localStorage 存的是 token 和账本，
 * 那些本来就该跨标签页共享；一份没填完的表单不是。
 */
const DRAFT_KEY = 'rs_report_draft_v1';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredDraft = { v: 1; savedAt: number; draft: ReportDraft };

function loadDraft(): ReportDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const rec = JSON.parse(raw) as StoredDraft;
    if (rec.v !== 1 || Date.now() - rec.savedAt > DRAFT_MAX_AGE_MS) return emptyDraft();
    // 铺在 emptyDraft 上面：以前存的草稿少几个字段也不会变成 undefined
    return { ...emptyDraft(), ...rec.draft };
  } catch {
    return emptyDraft(); // 无痕模式、存储被禁、JSON 坏了 —— 都当作没有草稿
  }
}

function saveDraft(d: ReportDraft) {
  try {
    // previewUrl 是整张照片的 base64，几 MB。不往磁盘上写：
    // 配额撑不住，而且在公用电脑上留下一张原图和这个 app 的隐私说法冲突。
    // 刷新后由 api.ts 的 photoPreviewUrl(photoKey) 重新取。
    const lean: ReportDraft = d.photo ? { ...d, photo: { ...d.photo, previewUrl: '' } } : d;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), draft: lean }));
  } catch {
    // 配额满或存储被禁 —— 存不下就算了，流程本身不能因此走不通
  }
}

type AppState = {
  user: User | null;
  authReady: boolean; // 还没问完「我是谁」之前不要急着跳转
  createId: () => Promise<string>;
  restore: (participantId: string) => Promise<void>;
  signOut: () => Promise<void>;

  draft: ReportDraft;
  patchDraft: (changes: Partial<ReportDraft>) => void;
  resetDraft: () => void;

  /** POST/PATCH 直接返回的那条记录。确认页不该再去列表里捞一遍 */
  lastSavedReport: LitterReport | null;
  setLastSavedReport: (r: LitterReport | null) => void;

  reportsVersion: number; // 加 1 就能让列表和计数重新去拿数据
  bumpReports: () => void;

  offline: boolean;
  setOffline: (value: boolean) => void;

  toast: string | null;
  showToast: (message: string) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>(loadDraft);
  const [lastSavedReport, setLastSavedReport] = useState<LitterReport | null>(null);
  const [reportsVersion, setReportsVersion] = useState(0);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 草稿每变一次就写回本标签页的存储
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // 存储被禁，本来也没写进去
    }
    setDraft(emptyDraft());
  };

  // 打开网页时问一次「我是谁」
  useEffect(() => {
    getMe()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  /*
   * 别的标签页改了登录状态，这一页要跟上。
   *
   * 同样是网页才有的事：用户可以同时开好几个标签页。在标签页 B 退出登录后，
   * 标签页 A 的 user 还在 state 里，RequireAuth 照样放行，一直到提交那一刻
   * 才炸出一句内部错误。领了新编号也一样 —— A 显示的还是旧编号，写进去的
   * 却是新编号的账本。
   *
   * storage 事件只在「别的」标签页触发，不会自己叫自己。
   */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rs_token' && e.newValue === null) {
        setUser(null);
        clearDraft();
        return;
      }
      if (e.key === 'rs_token' || e.key === 'rs_mock_participant') {
        getMe()
          .then(setUser)
          .catch(() => setUser(null));
      }
      if (e.key === 'rs_mock_accounts_v2') setReportsVersion((n) => n + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value: AppState = {
    user,
    authReady,

    // 领一个新编号，返回编号本身给页面显示
    async createId() {
      const session = await createAnonymousId();
      setUser(session.user);
      return session.user.participantId;
    },

    // 用已有编号继续
    async restore(participantId) {
      const session = await apiRestoreId(participantId);
      setUser(session.user);
    },

    async signOut() {
      await logout();
      setUser(null);
      clearDraft();
    },

    draft,
    patchDraft(changes) {
      setDraft((old) => ({ ...old, ...changes }));
    },
    resetDraft() {
      clearDraft();
    },

    lastSavedReport,
    setLastSavedReport,

    reportsVersion,
    bumpReports() {
      setReportsVersion((n) => n + 1);
    },

    offline,
    setOffline,

    toast,
    showToast(message) {
      setToast(message);
      setTimeout(() => setToast(null), 2400);
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp 必须写在 <AppProvider> 里面');
  return value;
}
