const WELCOME_SESSION_KEY = "radar-sampah:welcome-seen";

type SessionStore = Pick<Storage, "getItem" | "setItem">;

function browserSessionStore(): SessionStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function hasSeenWelcome(store: SessionStore | null = browserSessionStore()): boolean {
  if (!store) return false;
  try {
    return store.getItem(WELCOME_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeen(store: SessionStore | null = browserSessionStore()): void {
  if (!store) return;
  try {
    store.setItem(WELCOME_SESSION_KEY, "1");
  } catch {
    // Storage can be blocked in private/restricted browser contexts. The
    // navigation must still work; the welcome gate simply becomes best effort.
  }
}

export function shouldShowWelcomeBeforeHome(
  initialEntryPath: string,
  store: SessionStore | null = browserSessionStore(),
): boolean {
  return initialEntryPath === "/home" && !hasSeenWelcome(store);
}
