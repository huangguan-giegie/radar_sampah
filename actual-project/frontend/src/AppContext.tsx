
//



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


export type ReportDraft = {
  photo: UploadedPhoto | null;
  existingPhotoUrl: string | null;
  beachId: string | null;

  beachName: string | null;
  locationSource: 'gps' | 'manual' | null;
  coords: { lat: number; lng: number } | null;
  quantities: QuantityByCategory;
  gpsDenied: boolean;
  editingReportId: string | null;
};



function emptyDraft(): ReportDraft {
  return {
    photo: null,
    existingPhotoUrl: null,
    beachId: null,
    beachName: null,
    locationSource: null,
    coords: null,
    quantities: {},
    gpsDenied: false,
    editingReportId: null,
  };
}

type AppState = {
  user: User | null;
  authReady: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft());
  const [lastSavedReport, setLastSavedReport] = useState<LitterReport | null>(null);
  const [reportsVersion, setReportsVersion] = useState(0);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState<string | null>(null);


  useEffect(() => {
    getMe()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  const value: AppState = {
    user,
    authReady,


    async createId() {
      const session = await createAnonymousId();
      setUser(session.user);
      return session.user.participantId;
    },


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
