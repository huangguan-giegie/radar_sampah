// Tests for src/api.ts.
//
// api.ts has two branches. One talks to a live API, the other serves mock data
// for demos. Both are covered here. The live branch is checked by faking fetch
// and inspecting exactly what we would have sent - that is the only way to catch
// a broken contract before the backend does. The mock branch is checked for the
// rules a person cannot see by clicking around: the score, the local day, and
// the duplicate rule.
//
// The most important test here is the first one: it proves a photo is stripped
// of its location BEFORE it is uploaded. That is a privacy promise the UI makes
// in writing, so it needs a test and not just a careful reading of the code.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for localStorage. Tests run in Node, which has no browser storage,
// and a Map behaves the same for the three methods api.ts uses.
const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});
// Setting this makes USE_MOCK false, so the code under test takes the real
// fetch path. Tests that need the mock branch set it back to '' themselves.
vi.stubEnv('VITE_API_BASE_URL', 'https://radar-sampah-api.onrender.com');

// Fake just enough of the browser for metadataFreePhoto() to run: an Image
// that reports itself loaded, and a canvas that hands back a blob.
//
// The fake image is 3000 x 1500 on purpose - larger than the 2048px cap - so
// the resize path is the one being exercised, not skipped.
function mockImageCanvas() {
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage: vi.fn() })), toBlob: vi.fn() };
  class TestImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 3000;
    height = 1500;
    // Setting .src fires onload on the next microtask. A real browser loads
    // asynchronously, and firing straight away would let the test pass even if
    // the production code forgot to wait.
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', TestImage);
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
  const NativeURL = globalThis.URL;
  vi.stubGlobal('URL', Object.assign(NativeURL, { createObjectURL: vi.fn(() => 'blob:source'), revokeObjectURL: vi.fn() }));
  canvas.toBlob.mockImplementation((done: (blob: Blob) => void) => {
    done(new Blob(['stripped'], { type: 'image/jpeg' }));
  });
  return canvas;
}

describe('真实 API contract', () => {
  // resetModules matters: api.ts reads VITE_API_BASE_URL and loads the stored
  // mock data once, at import time. Without this the second test would reuse
  // the first test's module state and its leftover data.
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    storage.clear();
    storage.set('rs_token', 'token-123');
  });

  // The privacy test. It checks we upload the canvas-produced JPEG and not the
  // user's original file - the original still carries the GPS coordinates from
  // their camera.
  it('uses a canvas-generated metadata-free JPEG for photo upload', async () => {
    const canvas = mockImageCanvas();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ photoKey: 'photos/1.jpg', previewUrl: 'https://cdn/1.jpg', metadataStripped: true }), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { uploadPhoto } = await import('./api');

    const source = new File(['original'], 'source.jpg', { type: 'image/jpeg' });
    const result = await uploadPhoto(source);

    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', expect.any(Number));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('photo')).not.toBe(source);
    expect(result).toEqual({ photoKey: 'photos/1.jpg', previewUrl: 'https://cdn/1.jpg', metadataStripped: true });
  });

  // Upload failures must arrive as an ApiError carrying the status. Photo
  // upload does not go through request(), so it is the one path where that
  // could quietly be lost and every failure would look the same to the user.
  it('preserves backend upload error status and code', async () => {
    mockImageCanvas();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unsupported photo', code: 'PHOTO_INVALID' }), { status: 422 }),
    ));
    const { ApiError, uploadPhoto } = await import('./api');

    await expect(uploadPhoto(new File(['x'], 'bad.gif', { type: 'image/gif' }))).rejects.toMatchObject({
      name: 'ApiError', status: 422, code: 'PHOTO_INVALID', message: 'Unsupported photo',
    } satisfies Partial<InstanceType<typeof ApiError>>);
  });

  // The exact JSON we POST. If a field is renamed or dropped, this fails here
  // rather than during a demo against the live API.
  it('submits the report body in the backend contract shape', async () => {
    const report = { id: 'r1', beachId: 'morib', quantities: { Plastic: 'Large' }, category: 'Plastic', quantity: 'Large', beachName: 'Morib', createdAt: '2026-08-31T00:00:00Z', status: 'Counted' };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(report), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { createReport } = await import('./api');
    const input = { beachId: 'morib', quantities: { Plastic: 'Large' as const, Glass: 'Small' as const }, photoKey: 'photos/1.jpg', locationSource: 'gps' as const, coords: { lat: 2.746, lng: 101.44 } };

    await createReport(input);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
  });

  // The derived category must be the highest weight x amount, not simply the
  // heaviest category present - so a small piece of fishing gear does not
  // outrank a very large amount of plastic.
  it('uses the highest category-by-quantity score in mock mode', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    storage.set('rs_mock_participant', '1637');
    const { createReport } = await import('./api');

    const report = await createReport({
      beachId: 'morib',
      quantities: { Plastic: 'Large', 'Fishing gear': 'Medium' },
      photoKey: 'mock/photo.jpg',
      locationSource: 'manual',
    });

    expect(report.category).toBe('Plastic');
    expect(report.quantity).toBe('Large');
    expect(report.reportScore).toBe(2.55);
    expect(report.categoryScores).toEqual({ Plastic: 2.55, 'Fishing gear': 2 });
  });

  // The duplicate rule counts one report per beach per local day, and the users
  // are in Malaysia (UTC+8, no daylight saving). So the day must roll over at
  // 16:00 UTC, not at midnight UTC. These two times sit either side of that.
  it('uses the Kuala Lumpur calendar day for mock duplicate checks', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { localDayInKualaLumpur } = await import('./api');

    expect(localDayInKualaLumpur('2026-09-01T15:59:59.000Z')).toBe('2026-09-01');
    expect(localDayInKualaLumpur('2026-09-01T16:00:00.000Z')).toBe('2026-09-02');
  });

  // Same participant, same beach, same day: the second report is still saved,
  // but marked Duplicate so it cannot inflate the beach score. The note is
  // compared word for word because the user reads it on screen.
  it('marks a second same-day mock report as duplicate', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    storage.set('rs_mock_participant', '1637');
    const { createReport } = await import('./api');
    const input = {
      beachId: 'morib',
      quantities: { Plastic: 'Small' as const },
      photoKey: 'mock/photo.jpg',
      locationSource: 'manual' as const,
    };

    const first = await createReport(input);
    const second = await createReport(input);

    expect(first.status).toBe('Counted');
    expect(second.status).toBe('Duplicate');
    expect(second.statusNote).toBe(
      'Same participant, beach and local day as an existing counted report. Saved here but excluded from the beach score.',
    );
  });

  // Editing a report runs the duplicate check again. The second report is on a
  // different beach, so it counts at first; moving it to the first beach must
  // make it a duplicate and give the same explanation as a fresh duplicate.
  it('keeps the duplicate explanation after a mock correction', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    storage.set('rs_mock_participant', '1637');
    const { createReport, updateReport } = await import('./api');
    const first = await createReport({
      beachId: 'morib',
      quantities: { Plastic: 'Small' },
      photoKey: 'mock/first.jpg',
      locationSource: 'manual',
    });
    const second = await createReport({
      beachId: 'remis',
      quantities: { Plastic: 'Small' },
      photoKey: 'mock/second.jpg',
      locationSource: 'manual',
    });

    expect(first.status).toBe('Counted');
    const corrected = await updateReport(second.id, { beachId: 'morib' });

    expect(corrected.status).toBe('Duplicate');
    expect(corrected.statusNote).toBe(
      'Same participant, beach and local day as an existing counted report. Saved here but excluded from the beach score.',
    );
  });

  // An empty file cannot be decoded into an image. The guard runs before the
  // preview is built, so the user gets a message they can act on instead of a
  // failure from deep inside the reader.
  it('rejects an empty mock photo before creating a preview', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    storage.set('rs_mock_participant', '1637');
    const { uploadPhoto } = await import('./api');

    await expect(uploadPhoto(new File([], 'empty.jpg', { type: 'image/jpeg' }))).rejects.toThrow(
      'That photo is empty. Please choose another photo.',
    );
  });
});
