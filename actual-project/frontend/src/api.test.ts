import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});
vi.stubEnv('VITE_API_BASE_URL', 'https://radar-sampah-api.onrender.com');

function mockImageCanvas() {
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage: vi.fn() })), toBlob: vi.fn() };
  class TestImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 3000;
    height = 1500;
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
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    storage.clear();
    storage.set('rs_token', 'token-123');
  });

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

  it('submits the report body in the backend contract shape', async () => {
    const report = { id: 'r1', beachId: 'morib', quantities: { Plastic: 'Large' }, category: 'Plastic', quantity: 'Large', beachName: 'Morib', createdAt: '2026-08-31T00:00:00Z', status: 'Counted' };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(report), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { createReport } = await import('./api');
    const input = { beachId: 'morib', quantities: { Plastic: 'Large' as const, Glass: 'Small' as const }, photoKey: 'photos/1.jpg', locationSource: 'gps' as const, coords: { lat: 2.746, lng: 101.44 } };

    await createReport(input);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
  });
});
