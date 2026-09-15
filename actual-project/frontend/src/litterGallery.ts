import type { LitterGalleryEntry } from './types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function litterGalleryPath(beachId: string): string {
  return `/beach/${encodeURIComponent(beachId)}/gallery`;
}

export function litterGalleryPhotoUrl(value: string): string {
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  return BASE_URL + value;
}

export async function getLitterGallery(beachId: string): Promise<LitterGalleryEntry[]> {
  // Mock mode has no public object-store equivalent. An empty gallery is the
  // honest fallback instead of inventing public media from private mock data.
  if (!BASE_URL) return [];

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      `${BASE_URL}/beaches/${encodeURIComponent(beachId)}/litter-gallery`,
      { headers: { Accept: 'application/json' }, signal: controller.signal },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || 'Could not load the litter gallery.');
    }
    if (!Array.isArray(data)) throw new Error('Could not load the litter gallery.');
    return data as LitterGalleryEntry[];
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The gallery took too long to load. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
