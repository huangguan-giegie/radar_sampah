import { describe, expect, it } from 'vitest';
import { getPreferredBeachId, hasChosenLocation, rememberLocationChoice } from './locationPreference';

function store(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

describe('optional first-visit location', () => {
  it('remembers skipping without storing coordinates or selecting a beach', () => {
    const storage = store();
    expect(hasChosenLocation(storage)).toBe(false);
    rememberLocationChoice(null, storage);
    expect(hasChosenLocation(storage)).toBe(true);
    expect(getPreferredBeachId(storage)).toBeNull();
    expect(storage.length).toBe(1);
  });
  it('keeps only the matched beach identifier and replaces a previous choice', () => {
    const storage = store();
    rememberLocationChoice('morib', storage);
    expect(getPreferredBeachId(storage)).toBe('morib');
    expect(storage.length).toBe(2);
    rememberLocationChoice(null, storage);
    expect(getPreferredBeachId(storage)).toBeNull();
  });
  it('keeps browsing available when storage is unavailable', () => {
    expect(() => rememberLocationChoice(null, null)).not.toThrow();
    expect(getPreferredBeachId(null)).toBeNull();
  });
});
