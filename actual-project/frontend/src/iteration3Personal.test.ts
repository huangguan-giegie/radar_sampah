import { afterEach, describe, expect, it, vi } from 'vitest';
import { canAutoShowPersonalPopup, dismissNextAction, dismissedNextActions, fallbackNextAction, nextActionDismissalKey, personalPopupKey } from './iteration3Personal';
afterEach(() => vi.unstubAllGlobals());

describe('private personal insight sessions', () => {
  it('shows the automatic popup only on the first map entry from Home', () => {
    expect(canAutoShowPersonalPopup(true, false)).toBe(true);
    expect(canAutoShowPersonalPopup(true, true)).toBe(false);
    expect(canAutoShowPersonalPopup(false, false)).toBe(false);
  });

  it('keeps an explicitly requested beach list visible on the first entry from Home', () => {
    expect(canAutoShowPersonalPopup(true, false, true)).toBe(false);
    expect(canAutoShowPersonalPopup(true, false, false)).toBe(true);
  });

  it('keeps Home dismissal separate from the map popup and separate for each participant', () => {
    expect(nextActionDismissalKey('1001')).not.toBe(personalPopupKey('1001'));
    expect(nextActionDismissalKey('1001')).not.toBe(nextActionDismissalKey('1002'));
    expect(personalPopupKey('1001')).not.toBe(personalPopupKey('1002'));
    expect(nextActionDismissalKey()).not.toBe(nextActionDismissalKey('1001'));
  });

  it('remembers every dismissed action for the same participant session', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    dismissNextAction('first', '1001');
    dismissNextAction('second', '1001');
    expect(dismissedNextActions('1001')).toEqual(['first', 'second']);
    expect(dismissedNextActions('1002')).toEqual([]);
  });

  it('storage and recommendation failures preserve usable guest and report destinations', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(dismissNextAction('one', '1001')).toEqual(['one']);
    expect(fallbackNextAction(true).destination.path).toBe('/report/photo');
    expect(fallbackNextAction(false).destination.path).toBe('/community');
  });
});
