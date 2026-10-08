import { afterEach, describe, expect, it, vi } from 'vitest';
import { canAutoShowPersonalPopup, fallbackNextAction } from './iteration3Personal';
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

  it('recommendation failures preserve usable guest and report destinations', () => {
    expect(fallbackNextAction(true).destination.path).toBe('/report/photo');
    expect(fallbackNextAction(false).destination.path).toBe('/community');
  });
});
