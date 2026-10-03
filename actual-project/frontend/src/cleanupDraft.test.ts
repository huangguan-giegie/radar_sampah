import { describe, expect, it, vi } from "vitest";
import { cleanupDraftScope, clearCleanupDraft, readCleanupDraft, writeCleanupDraft } from "./cleanupDraft";
import type { CleanupTarget } from "./iteration2";

const target: CleanupTarget = {
  reportId: "report-1", beachId: "morib", beachName: "Pantai Morib",
  reportedAt: "2026-10-03", remainingBands: { Plastic: "Large", Metal: "Medium" },
};

describe("cleanup navigation drafts", () => {
  it("restores choices and the retry key after leaving, without browser storage", () => {
    const storage = { setItem: vi.fn(() => { throw new Error("Photos must not be persisted"); }) };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    try {
      const scope = cleanupDraftScope("participant-restore", "morib", null);
      const first = readCleanupDraft(scope, target);
      const photo = { name: "cleanup.jpg" } as File;
      writeCleanupDraft(scope, target, {
        ...first, category: "Plastic", after: "Small", step: "ai", photo, suggestion: "Small",
      });
      const restored = readCleanupDraft(scope, { ...target });
      expect(restored).toMatchObject({ category: "Plastic", after: "Small", step: "ai", suggestion: "Small" });
      expect(restored.photo).toBe(photo);
      expect(restored.idempotencyKey).toBe(first.idempotencyKey);
      expect(storage.setItem).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not restore another participant, beach, or event's draft", () => {
    const scope = cleanupDraftScope("participant-a", "morib", "event-1");
    const value = readCleanupDraft(scope, target);
    writeCleanupDraft(scope, target, { ...value, category: "Plastic", after: "Small" });
    for (const otherScope of [
      cleanupDraftScope("participant-b", "morib", "event-1"),
      cleanupDraftScope("participant-a", "bagan", "event-1"),
      cleanupDraftScope("participant-a", "morib", "event-2"),
      cleanupDraftScope("participant-a", "morib", null),
    ]) expect(readCleanupDraft(otherScope, target).after).toBeNull();
  });

  it("starts fresh when the linked report or its remaining amount changes", () => {
    for (const changed of [
      { ...target, reportId: "report-2" },
      { ...target, remainingBands: { Plastic: "Medium" as const } },
    ]) {
      const scope = crypto.randomUUID();
      const initial = readCleanupDraft(scope, target);
      writeCleanupDraft(scope, target, { ...initial, category: "Plastic", after: "Small" });
      const reset = readCleanupDraft(scope, changed);
      expect(reset.after).toBeNull();
      expect(reset.photo).toBeNull();
      expect(reset.idempotencyKey).not.toBe(initial.idempotencyKey);
    }
  });

  it("clears a saved draft but an older completion cannot erase a newer target", () => {
    const scope = cleanupDraftScope("participant-clear", "morib", null);
    const first = readCleanupDraft(scope, target);
    clearCleanupDraft(scope, first.idempotencyKey);
    const next = readCleanupDraft(scope, target);
    expect(next.idempotencyKey).not.toBe(first.idempotencyKey);
    writeCleanupDraft(scope, target, { ...next, category: "Plastic", after: "Small" });
    clearCleanupDraft(scope, first.idempotencyKey);
    expect(readCleanupDraft(scope, target).after).toBe("Small");
  });
});
