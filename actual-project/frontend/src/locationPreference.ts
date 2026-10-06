const LOCATION_CHOICE_KEY = 'radar-sampah:location-choice';
const PREFERRED_BEACH_KEY = 'radar-sampah:preferred-beach';

function preferenceStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function hasChosenLocation(store = preferenceStore()): boolean {
  try { return store?.getItem(LOCATION_CHOICE_KEY) === '1'; } catch { return false; }
}

export function getPreferredBeachId(store = preferenceStore()): string | null {
  try { return store?.getItem(PREFERRED_BEACH_KEY) || null; } catch { return null; }
}

export function rememberLocationChoice(beachId: string | null, store = preferenceStore()): void {
  try {
    if (beachId) store?.setItem(PREFERRED_BEACH_KEY, beachId);
    else store?.removeItem(PREFERRED_BEACH_KEY);
    store?.setItem(LOCATION_CHOICE_KEY, '1');
  } catch { /* Browsing remains available when storage is blocked. */ }
}
