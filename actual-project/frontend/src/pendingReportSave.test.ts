import { describe, expect, it, vi } from "vitest";
import { pendingReportSave } from "./pendingReportSave";
import type { LitterReport } from "./types";

describe("pending report saves", () => {
  it("reuses a pending save after leaving and reentering review", async () => {
    let resolve!: (value: LitterReport) => void;
    const request = new Promise<LitterReport>(done => { resolve = done; });
    const save = vi.fn(() => request);
    const first = pendingReportSave("same-draft", save);
    const remounted = pendingReportSave("same-draft", save);
    expect(remounted).toBe(first);
    expect(save).toHaveBeenCalledTimes(1);
    resolve({ id: "saved-report" } as LitterReport);
    expect(await remounted).toMatchObject({ id: "saved-report" });
    await pendingReportSave("same-draft", save);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("allows retry after failure and does not conflate different drafts", async () => {
    const fail = vi.fn(() => Promise.reject(new Error("offline")));
    await expect(pendingReportSave("failed-draft", fail)).rejects.toThrow("offline");
    await expect(pendingReportSave("failed-draft", fail)).rejects.toThrow("offline");
    expect(fail).toHaveBeenCalledTimes(2);
    const save = vi.fn(async () => ({ id: "saved" } as LitterReport));
    await Promise.all([pendingReportSave("draft-a", save), pendingReportSave("draft-b", save)]);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
