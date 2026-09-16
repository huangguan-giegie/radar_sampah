import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
  storage.clear();
  storage.set('rs_token', 'session-token');
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('v3 real API integration', () => {
  it('sends measured coordinates for server-validated check-in', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const { recordCheckInData } = await import('./iteration2Api');
    await recordCheckInData('event/1', '1637', { lat: 2.746, lng: 101.443 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/cleanup-events/event%2F1/check-in');
    expect(JSON.parse(init.body)).toEqual({ lat: 2.746, lng: 101.443 });
    expect(init.headers.Authorization).toBe('Bearer session-token');
  });

  it('rejects client-only success states without making a real request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { recordCheckInData } = await import('./iteration2Api');
    await expect(recordCheckInData('event-1', '1637', 'within_area')).rejects.toThrow('coordinates');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves the same cleanup idempotency key after a lost response', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network disconnected'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cleanup-1' })));
    vi.stubGlobal('fetch', fetchMock);
    const { submitCleanup } = await import('./iteration2Api');
    const input = {
      participantId: '1637', targetReportId: 'report-1', eventId: null,
      afterBands: { Plastic: 'Medium' as const },
      handling: 'Collected for disposal' as const, idempotencyKey: 'cleanup-retry-1',
    };
    await expect(submitCleanup(input)).rejects.toThrow();
    await expect(submitCleanup(input)).resolves.toMatchObject({ id: 'cleanup-1' });
    expect(fetchMock.mock.calls).toHaveLength(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe('https://api.example.test/cleanups');
      expect(JSON.parse(init.body)).toEqual({
        targetReportId: 'report-1', eventId: null, afterBands: { Plastic: 'Medium' },
        handling: 'Collected for disposal', note: '', idempotencyKey: 'cleanup-retry-1',
      });
    }
  });

  it('uploads the actual cleanup image and keeps unrecognized target bands unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      modelState: 'ready', suggestions: { Plastic: 'Medium' }, counts: { Plastic: 8 },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { analyseCleanupPhoto } = await import('./iteration2');
    const file = new File(['image-content'], 'cleanup.png', { type: 'image/png' });
    const bands = await analyseCleanupPhoto(file, {
      reportId: 'r1', beachId: 'morib', beachName: 'Pantai Morib', reportedAt: '2026-09-16',
      remainingBands: { Plastic: 'Large', Glass: 'Medium' },
    });
    expect(bands).toEqual({ Plastic: 'Medium', Glass: 'Medium' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/recognitions/cleanup-photo');
    expect(init.body.get('photo')).toBe(file);
    expect(init.headers.Authorization).toBe('Bearer session-token');
    expect(storage.has('rs_iteration2_v4')).toBe(false);
  });

  it('reports unavailable cleanup recognition instead of accepting synthetic suggestions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      modelState: 'unavailable', suggestions: {}, counts: {},
    }))));
    const { analyseCleanupPhoto } = await import('./iteration2');
    await expect(analyseCleanupPhoto(new File(['photo'], 'morib.jpg'))).rejects.toThrow('unavailable');
  });
});
