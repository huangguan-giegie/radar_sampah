
// The shared state of the whole app: who is signed in, the report being filled
// in, and the little message bar at the bottom.
//
// WHY CONTEXT AND NOT REDUX - there is only a handful of shared values here and
// they change rarely. React's own Context does that in one small file, with no
// extra library to install, learn, or defend. Redux would be more code and more
// concepts for no gain at this size. If dozens of values started changing every
// second, that trade would flip.
//
// Any component can read it with:  const { user } = useApp();



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


// The report the user is currently filling in.
//
// Filing a report takes several screens (photo -> location -> confirm the
// beach -> what and how much -> check and submit). None of those screens owns
// the answer on its own, so the half-finished report lives here and is cleared
// once it has been submitted.
export type ReportDraft = {
  photo: UploadedPhoto | null;
  existingPhotoUrl: string | null;
  /** The server's key for a photo that is already stored. A preview URL goes
   *  stale, so after a refresh the photo step asks for a fresh one using this
   *  key instead of losing the picture the user already took. */
  existingPhotoKey: string | null;
  /** True when that refetch came back empty - the old photo is gone for good.
   *  We say so on the photo and review screens rather than showing a silent
   *  gap, so the user knows to take a new picture. */
  existingPhotoUnavailable: boolean;
  beachId: string | null;

  /** Written at the same time as beachId. Keeping the name here means the
   *  review page can print "Pantai Morib" straight away, instead of showing a
   *  blank while it waits for /beaches to come back over the network. */
  beachName: string | null;
  locationSource: 'gps' | 'manual' | null;
  coords: { lat: number; lng: number } | null;
  quantities: QuantityByCategory;

  /**
   * Why finding the location failed, so the confirm screen can say something
   * useful instead of one vague sentence.
   *
   * A single true/false would not be enough. "You said no to the permission",
   * "your device cannot get a fix", "it took too long" and "the fix is too
   * rough to trust" are four different problems with four different fixes.
   * Calling all of them "permission denied" sends the user off to change a
   * setting they never touched.
   */
  gpsIssue: 'denied' | 'unavailable' | 'timeout' | 'inaccurate' | 'noBeach' | 'failed' | null;
  // Set only while correcting a report that already exists; it holds that
  // report's id. null means this is a brand new report. Several rules below
  // branch on it, because an edit is allowed to keep the original photo.
  editingReportId: string | null;
  // The status that report already had, and the reviewer's note about it.
  // Both are copied in when the correction starts, so the edit screen can tell
  // the user what was wrong without asking the server a second time.
  editingStatus: ReportStatus | null;
  editingStatusNote: string | null;
};



// Deliberately NOT exported. When one file exports both a component and a
// plain function, Vite's fast refresh cannot tell what changed and reloads the
// whole page, losing the state you were trying to look at.
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


/*
 * The draft must survive a page refresh.
 *
 * THIS IS THE BIG DIFFERENCE BETWEEN A WEB APP AND A PHONE APP. Filing a
 * report takes several steps. In a browser the page can be thrown away in the
 * middle: the user presses F5, pulls down to refresh on a phone, or the camera
 * permission prompt pushes the page out of memory. Without this, the photo,
 * the beach and the categories are all gone and they start again from step 1.
 * A phone app comes back from the background with its state intact; a web page
 * does not, so we have to write it down.
 *
 * WHY sessionStorage AND NOT localStorage - all three cases above happen
 * inside ONE tab, and sessionStorage survives all three. It is also per tab,
 * which stops a second tab halfway through a different report from
 * overwriting this one. api.ts uses localStorage for the token and the mock
 * ledger, because those SHOULD be shared between tabs. A half-typed form
 * should not be.
 */
const DRAFT_KEY = 'rs_report_draft_v1';
// The signed-in user, cached in localStorage so the first paint after a
// refresh already knows who they are. Shared between tabs on purpose, unlike
// the draft above.
const USER_SNAPSHOT_KEY = 'rs_user_snapshot_v1';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredDraft = { v: 1; savedAt: number; draft: ReportDraft };

function loadDraft(): ReportDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const rec = JSON.parse(raw) as StoredDraft;
    // Two ways to reject a stored draft. The version number protects us from
    // a draft saved by an older build with a different shape. The age limit
    // stops a week-old half-report reappearing as a surprise - by then the
    // user has forgotten it, and the beach may have been cleaned.
    if (rec.v !== 1 || Date.now() - rec.savedAt > DRAFT_MAX_AGE_MS) return emptyDraft();

    // Spread over emptyDraft, not returned directly: a draft saved before we
    // added a field would leave that field undefined and crash a screen.
    return { ...emptyDraft(), ...rec.draft };
  } catch {
    // Private browsing, storage switched off, or corrupted JSON. All of them
    // just mean "there is no draft" - never a crash on the very first render.
    return emptyDraft();
  }
}

function saveDraft(d: ReportDraft) {
  try {


    // previewUrl holds the whole photo as base64 - several megabytes. We strip
    // it before writing, for two reasons. Practical: it would blow the storage
    // quota and the save would fail. Privacy: leaving a full photo behind on a
    // shared or library computer contradicts what we promise users about
    // photos. After a refresh the preview is fetched again from the photoKey
    // by photoPreviewUrl() in api.ts.
    const lean: ReportDraft = d.photo ? { ...d, photo: { ...d.photo, previewUrl: '' } } : d;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), draft: lean }));
  } catch {

    // Quota full, or storage switched off. Saving is a nice-to-have: if it
    // fails the user simply loses the draft on refresh. It must never stop
    // them from finishing the report they are filling in right now.
  }
}

/**
 * The last known user, read straight out of storage for the very first render.
 *
 * Without it the app starts as nobody, then flips to the real user a moment
 * later when getMe() answers - a visible flicker on every load. The token is
 * checked first, because a snapshot left over after a sign-out must not put
 * the old user back on screen.
 */
function readUserSnapshot(): User | null {
  try {
    if (!localStorage.getItem('rs_token')) return null;
    const parsed = JSON.parse(localStorage.getItem(USER_SNAPSHOT_KEY) || 'null') as Partial<User> | null;
    // Anything a person can edit by hand gets checked field by field. A
    // half-written or tampered snapshot must read as "no user", not as a
    // half-built User that crashes a screen or hands out a moderator view.
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.participantId !== 'string') return null;
    if (parsed.role !== 'volunteer' && parsed.role !== 'moderator') return null;
    return { id: parsed.id, participantId: parsed.participantId, role: parsed.role };
  } catch {
    return null;
  }
}

// Keep the cached user in step with the real one. Called on every path that
// changes who is signed in, including sign-out, where passing null clears it.
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
  // False until the "who am I" request has finished. Screens must wait for
  // this before redirecting, otherwise a user with a stale token is briefly
  // shown a page they are about to be bounced off.
  authReady: boolean;
  // Set when we could not reach the server to refresh the session, but the
  // session still looks good. App.tsx turns it into a banner with a Retry
  // button; null means there is nothing to tell the user.
  authSyncError: string | null;
  retryAuth: () => Promise<void>;
  createId: () => Promise<string>;
  restore: (participantId: string) => Promise<void>;
  signOut: () => Promise<void>;

  draft: ReportDraft;
  patchDraft: (changes: Partial<ReportDraft>) => void;
  resetDraft: () => void;


  /** The report that POST or PATCH just returned. The result screen shows
   *  this one directly instead of asking the server for the list again -
   *  fewer requests, and no chance of showing a stale copy. */
  lastSavedReport: LitterReport | null;
  setLastSavedReport: (r: LitterReport | null) => void;

  // A simple counter. Add 1 and every screen that lists reports or counts
  // them refetches. It is in the dependency array of their effects, so one
  // number replaces a lot of manual "tell that screen to reload" plumbing.
  reportsVersion: number;
  bumpReports: () => void;

  offline: boolean;
  setOffline: (value: boolean) => void;

  toast: string | null;
  showToast: (message: string) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Start from the cached user so the first paint is already correct, then let
  // syncAuth below confirm or replace it. Passing the function itself, not a
  // call, keeps the storage read to the first render only.
  const [user, setUser] = useState<User | null>(readUserSnapshot);
  const [authReady, setAuthReady] = useState(false);
  const [authSyncError, setAuthSyncError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReportDraft>(loadDraft);
  const [lastSavedReport, setLastSavedReport] = useState<LitterReport | null>(null);
  const [reportsVersion, setReportsVersion] = useState(0);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [toast, setToast] = useState<string | null>(null);


  // Keep the offline flag in step with the browser. The starting value above
  // reads navigator.onLine, guarded because the tests run with no browser at
  // all. Knowing we are offline lets a screen say so plainly, instead of
  // letting a submit fail with an error the user cannot act on.
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


  // Write the draft to this tab's storage on every change. It is one small
  // JSON write per keystroke-sized change, which is cheap, and it means we can
  // never forget to save at the one point where it mattered.
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {

      // Storage is switched off, so there was nothing written to remove.
    }
    setDraft(emptyDraft());
  };


  /*
   * Ask the server "who am I", and keep the cached copy in step with it.
   *
   * The token lives in storage, so after a refresh we look signed in - but
   * only the server can say whether that token is still good, so we ask.
   * It is a useCallback because the effects below list it as a dependency and
   * it is handed out as retryAuth, so a new one each render would loop.
   */
  const syncAuth = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      saveUserSnapshot(me);
      setAuthSyncError(null);
    } catch (error) {
      // A temporary refresh failure must not turn a still-valid anonymous
      // session into Guest. Only a 401 is proof the token is dead; a dropped
      // connection is not, and signing the user out would cost them a
      // participant number they may have nowhere else. See authPolicy.ts.
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

  // Run it once when the app opens.
  useEffect(() => {
    void syncAuth();
  }, [syncAuth]);

  /*
   * Follow the sign-in state when ANOTHER tab changes it.
   *
   * Another web-only problem: people open several tabs. If they sign out in
   * tab B, tab A still has the old user sitting in React state, RequireAuth
   * happily lets them carry on, and they only find out at the moment they
   * press submit - as an internal error. Claiming a new participant number is
   * just as bad: tab A keeps showing the old number while writing into the new
   * number's records.
   *
   * The browser only fires "storage" in the OTHER tabs, never in the tab that
   * made the change, so this cannot loop back on itself.
   */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // The token is gone, which means a sign-out. Nothing to ask the server
      // about, and the draft goes too so the next person on this machine does
      // not inherit a half-written report.

      if (e.key === 'rs_token' && e.newValue === null) {
        setUser(null);
        saveUserSnapshot(null);
        setAuthSyncError(null);
        clearDraft();
        return;
      }
      // The token changed rather than vanished, so somebody signed in or
      // claimed a new number over there. Ask the server rather than guessing.
      if (e.key === 'rs_token' || e.key === 'rs_mock_participant') {
        void syncAuth();
      }
      // The mock backend's data changed in another tab; refresh the lists.
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


    // Claim a new anonymous participant number. It is returned as well as
    // stored, because the welcome screen has to show it to the user - it is
    // the only thing they can use to get back into their reports later.
    async createId() {
      const session = await createAnonymousId();
      setUser(session.user);
      saveUserSnapshot(session.user);
      setAuthSyncError(null);
      return session.user.participantId;
    },


    // Continue with a number the user already has.
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

/**
 * The one way to read the shared state.
 *
 * It throws a clear message when a component is used outside AppProvider.
 * Without that check the component would get null and fail later with
 * "cannot read property of null", pointing at the wrong file.
 */
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}
