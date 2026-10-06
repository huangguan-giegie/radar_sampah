import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAsyncData } from './useAsyncData';

vi.mock('./api', () => ({ USE_MOCK: false }));

function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let current: ReturnType<typeof useAsyncData<string | null>>;
let view: ReactTestRenderer | undefined;
function Probe({ beach, load }: { beach: string; load: () => Promise<string> }) {
  current = useAsyncData<string | null>(load, [beach], null);
  return <span>{current.data}</span>;
}

afterEach(() => { act(() => view?.unmount()); view = undefined; });

describe('asynchronous beach data', () => {
  it.each(['success', 'failure'] as const)('ignores a stale retry %s after navigating to another beach', async outcome => {
    const retry = deferred();
    const next = deferred();
    const load = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockReturnValueOnce(retry.promise);
    await act(async () => { view = create(<Probe beach="morib" load={load} />); });
    expect(current.error).toBe('Offline');
    act(() => { void current.refresh(); });
    await act(async () => { view!.update(<Probe beach="remis" load={() => next.promise} />); });
    expect(current.data).toBeNull();
    expect(current.loading).toBe(true);
    await act(async () => {
      if (outcome === 'success') retry.resolve('old Morib data');
      else retry.reject(new Error('old Morib failure'));
    });
    expect(current.loading).toBe(true);
    expect(current.error).toBeNull();
    expect(current.data).toBeNull();
    await act(async () => { next.resolve('new Remis data'); });
    expect(current.data).toBe('new Remis data');
    expect(current.loading).toBe(false);
  });

  it('keeps the latest refresh when requests complete out of order', async () => {
    const old = deferred();
    const latest = deferred();
    const load = vi.fn().mockResolvedValueOnce('initial').mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    await act(async () => { view = create(<Probe beach="morib" load={load} />); });
    act(() => { void current.refresh(); void current.refresh(); });
    await act(async () => { latest.resolve('latest data'); });
    await act(async () => { old.resolve('outdated data'); });
    expect(current.data).toBe('latest data');
    expect(current.error).toBeNull();
    expect(current.loading).toBe(false);
  });
});
