
// The shared state of the whole app: who is logged in, the report being
// filled in, and the little message bar at the bottom.
//
// WHY CONTEXT AND NOT REDUX - we have exactly three pieces of shared state and
// they change rarely. React's own Context does that in 200 lines with no extra
// library to install, learn, or defend. Redux would be more code and more
// concepts for no gain at this size. If the app grew to dozens of shared
// values that change every second, that trade would flip.
//
// Any component can read it with:  const { user } = useApp();



import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createAnonymousId, getMe, logout } from './api';
import type { LitterReport, QuantityByCategory, ReportStatus, UploadedPhoto, User } from './types';
import { restoreId as apiRestoreId } from './api';


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

type AppState = {
  user: User | null;
  // False until the "who am I" request has finished. Screens must wait for
  // this before redirecting, otherwise a logged-in user is bounced to the
  // welcome page for a moment on every single page load.
  authReady: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
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


  // Ask "who am I" once when the app opens. The token lives in storage, so
  // after a refresh we are still logged in - but only the server can tell us
  // whether that token is still valid, so we ask instead of assuming.
  useEffect(() => {
    getMe()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, []);


  /*
   * Follow the login state when ANOTHER tab changes it.
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


    // Claim a new anonymous participant number. It is returned as well as
    // stored, because the welcome screen has to show it to the user - it is
    // the only thing they can use to get back into their reports later.
    async createId() {
      const session = await createAnonymousId();
      setUser(session.user);
      return session.user.participantId;
    },


    // Continue with a number the user already has.
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
