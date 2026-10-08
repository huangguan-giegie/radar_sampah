import { apiRequest } from './api';

export function iteration3Request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  return apiRequest<T>(path, method, body, path.startsWith('/insights/') ? 60_000 : 15_000);
}
