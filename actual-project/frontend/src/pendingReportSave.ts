import type { LitterReport } from "./types";

// A browser Back/remount must reuse the same request while it is still pending.
// Settled entries are removed so a later intentional observation can be saved.
const pending = new Map<string, Promise<LitterReport>>();

export function pendingReportSave(key: string, save: () => Promise<LitterReport>) {
  const existing = pending.get(key);
  if (existing) return existing;
  const request = save();
  pending.set(key, request);
  const clear = () => { if (pending.get(key) === request) pending.delete(key); };
  void request.then(clear, clear);
  return request;
}
