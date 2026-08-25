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
import type { LitterCategory, QuantityBand, UploadedPhoto, User } from './types';
import { restoreId as apiRestoreId } from './api';

// 「记录垃圾」这个流程分 3 步，中间填的东西先存在这里，提交成功后清空
export type ReportDraft = {
  photo: UploadedPhoto | null;
  beachId: string | null;
  locationSource: 'gps' | 'manual' | null;
  coords: { lat: number; lng: number } | null;
  category: LitterCategory | null;
  quantity: QuantityBand | null;
  gpsDenied: boolean; // 用户拒绝了定位，确认页要显示黄色提示
  editingReportId: string | null; // 正在修正已有记录时存它的 id
};

// 注意：这个函数故意不 export。
// 一个文件里同时导出「组件」和「普通函数」会让 Vite 的热更新出问题。
function emptyDraft(): ReportDraft {
  return {
    photo: null,
    beachId: null,
    locationSource: null,
    coords: null,
    category: null,
    quantity: null,
    gpsDenied: false,
    editingReportId: null,
  };
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

  lastSavedReportId: string | null;
  setLastSavedReportId: (id: string | null) => void;

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
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft());
  const [lastSavedReportId, setLastSavedReportId] = useState<string | null>(null);
  const [reportsVersion, setReportsVersion] = useState(0);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 打开网页时问一次「我是谁」
  useEffect(() => {
    getMe()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
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
      setDraft(emptyDraft());
    },

    draft,
    patchDraft(changes) {
      setDraft((old) => ({ ...old, ...changes }));
    },
    resetDraft() {
      setDraft(emptyDraft());
    },

    lastSavedReportId,
    setLastSavedReportId,

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
