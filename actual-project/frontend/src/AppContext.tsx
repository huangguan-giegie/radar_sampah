
//



import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createAnonymousId, getMe, logout } from './api';
import type { LitterReport, QuantityByCategory, ReportStatus, UploadedPhoto, User } from './types';
import { restoreId as apiRestoreId } from './api';
import { authFailureAction } from './authPolicy';


export type ReportDraft = {
  photo: UploadedPhoto | null;
  existingPhotoUrl: string | null;
  existingPhotoKey: string | null;
  existingPhotoUnavailable: boolean;
  beachId: string | null;

  beachName: string | null;
  locationSource: 'gps' | 'manual' | null;
  coords: { lat: number; lng: number } | null;
  quantities: QuantityByCategory;

  gpsIssue: 'denied' | 'unavailable' | 'timeout' | 'inaccurate' | 'noBeach' | 'failed' | null;
  editingReportId: string | null;
  editingStatus: ReportStatus | null;
  editingStatusNote: string | null;
};



function emptyDraft(): ReportDraft {
  return {
    photo: null,
    existingPhotoUrl: null,
    existingPhotoKey: null,
    existingPhotoUnavailable: false,
    beachId: null,
    beachName: null,
    locationSource: null,
    coords: null,
    quantities: {},
    gpsIssue: null,
    editingReportId: null,
    editingStatus: null,
    editingStatusNote: null,
  };
}


const DRAFT_KEY = 'rs_report_draft_v1';
const USER_SNAPSHOT_KEY = 'rs_user_snapshot_v1';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredDraft = { v: 1; savedAt: number; draft: ReportDraft };

function loadDraft(): ReportDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const rec = JSON.parse(raw) as StoredDraft;
    if (rec.v !== 1 || Date.now() - rec.savedAt > DRAFT_MAX_AGE_MS) return emptyDraft();

    return { ...emptyDraft(), ...rec.draft };
  } catch {
    return emptyDraft();
  }
}

function saveDraft(d: ReportDraft) {
  try {


    const lean: ReportDraft = d.photo ? { ...d, photo: { ...d.photo, previewUrl: '' } } : d;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), draft: lean }));
  } catch {

  }
}

function readUserSnapshot(): User | null {
  try {
    if (!localStorage.getItem('rs_token')) return null;
    const parsed = JSON.parse(localStorage.getItem(USER_SNAPSHOT_KEY) || 'null') as Partial<User> | null;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.participantId !== 'string') return null;
    if (parsed.role !== 'volunteer' && parsed.role !== 'moderator') return null;
    return { id: parsed.id, participantId: parsed.participantId, role: parsed.role };
  } catch {
    return null;
  }
}

function saveUserSnapshot(user: User | null) {
  try {
    if (!user) {
      localStorage.removeItem(USER_SNAPSHOT_KEY);
      return;
    }
    localStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify({ id: user.id, participantId: user.participantId, role: user.role }));
  } catch {
    // A snapshot is a convenience only; authentication still uses the token.
  }
}

type AppState = {
  user: User | null;
  authReady: boolean;
  authSyncError: string | null;
  retryAuth: () => Promise<void>;
  createId: () => Promise<string>;
  restore: (participantId: string) => Promise<void>;
  signOut: () => Promise<void>;

  draft: ReportDraft;
  patchDraft: (changes: Partial<ReportDraft>) => void;
  resetDraft: () => void;


  lastSavedReport: LitterReport | null;
  setLastSavedReport: (r: LitterReport | null) => void;

  reportsVersion: number;
  bumpReports: () => void;

  offline: boolean;
  setOffline: (value: boolean) => void;

  toast: string | null;
  showToast: (message: string) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUserSnapshot);
  const [authReady, setAuthReady] = useState(false);
  const [authSyncError, setAuthSyncError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReportDraft>(loadDraft);
  const [lastSavedReport, setLastSavedReport] = useState<LitterReport | null>(null);
  const [reportsVersion, setReportsVersion] = useState(0);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [toast, setToast] = useState<string | null>(null);


  useEffect(() => {
    const markOnline = () => setOffline(false);
    const markOffline = () => setOffline(true);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);


  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {

    }
    setDraft(emptyDraft());
  };


  const syncAuth = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      saveUserSnapshot(me);
      setAuthSyncError(null);
    } catch (error) {
      // A temporary refresh failure must not turn a still-valid anonymous session into Guest.
      if (authFailureAction(error) === 'preserve') {
        setAuthSyncError('We could not refresh your session. You are still signed in.');
      } else {
        setUser(null);
        saveUserSnapshot(null);
      }
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void syncAuth();
  }, [syncAuth]);


  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rs_token' && e.newValue === null) {
        setUser(null);
        saveUserSnapshot(null);
        setAuthSyncError(null);
        clearDraft();
        return;
      }
      if (e.key === 'rs_token' || e.key === 'rs_mock_participant') {
        void syncAuth();
      }
      if (e.key === 'rs_mock_accounts_v2') setReportsVersion((n) => n + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [syncAuth]);

  const value: AppState = {
    user,
    authReady,
    authSyncError,
    retryAuth: syncAuth,


    async createId() {
      const session = await createAnonymousId();
      setUser(session.user);
      saveUserSnapshot(session.user);
      setAuthSyncError(null);
      return session.user.participantId;
    },


    async restore(participantId) {
      const session = await apiRestoreId(participantId);
      setUser(session.user);
      saveUserSnapshot(session.user);
      setAuthSyncError(null);
    },

    async signOut() {
      await logout();
      setUser(null);
      saveUserSnapshot(null);
      setAuthSyncError(null);
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
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}
