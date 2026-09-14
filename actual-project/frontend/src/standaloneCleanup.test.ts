import { beforeEach, expect, it } from 'vitest';
import { completeCleanup } from './iteration2';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

beforeEach(() => storage.clear());

it('records a cleanup even when the beach has no eligible report target', async () => {
  const cleanup = await completeCleanup({
    participantId: '1637',
    beachId: 'kelanang',
    removed: { Plastic: 3 },
    handling: 'Collected for disposal',
  });

  expect(cleanup.beachId).toBe('kelanang');
  expect(cleanup.targetReportId).toBeNull();
  expect(cleanup.score).toBe(3);
});
