import type { CleanupTarget } from "./iteration2";
import type { CleanupAfterBand, LitterCategory, QuantityBand } from "./types";

export type CleanupDraft = {
  category: LitterCategory | null;
  after: CleanupAfterBand | null;
  afterBands?: Partial<Record<LitterCategory, CleanupAfterBand>>;
  step: "linked" | "amount" | "ai";
  photo: File | null;
  suggestion: QuantityBand | null;
  idempotencyKey: string;
};

// Navigation only: photos and choices stay in this tab's memory, never storage.
const drafts = new Map<string, { target: string; value: CleanupDraft }>();

export function cleanupDraftScope(participantId: string, beachId: string, eventId: string | null) {
  return JSON.stringify([participantId, beachId, eventId]);
}

export function cleanupTargetVersion(target: CleanupTarget) {
  return JSON.stringify([target.reportId, Object.entries(target.remainingBands).sort()]);
}

export function readCleanupDraft(scope: string, target: CleanupTarget): CleanupDraft {
  const version = cleanupTargetVersion(target);
  const saved = drafts.get(scope);
  if (saved?.target === version) return saved.value;
  const value: CleanupDraft = {
    category: null, after: null, afterBands: {}, step: "linked", photo: null,
    suggestion: null, idempotencyKey: crypto.randomUUID(),
  };
  drafts.set(scope, { target: version, value });
  return value;
}

export function writeCleanupDraft(scope: string, target: CleanupTarget, value: CleanupDraft) {
  drafts.set(scope, { target: cleanupTargetVersion(target), value });
}

export function clearCleanupDraft(scope: string, idempotencyKey?: string) {
  if (idempotencyKey && drafts.get(scope)?.value.idempotencyKey !== idempotencyKey) return;
  drafts.delete(scope);
}
