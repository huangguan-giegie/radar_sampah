import { describe, expect, it } from "vitest";
import { beachNeedsVolunteers } from "./volunteerNeeds";
const now = Date.parse("2026-10-03T12:00:00Z");
const daysAgo = (days: number) => new Date(now - days * 86400000).toISOString();
describe("H15 volunteer priority rule", () => {
  it("includes Moderate beaches with low participation and keeps the threshold at three", () => {
    expect(beachNeedsVolunteers({ severity: "Moderate" }, daysAgo(2), 2, now)).toBe(true);
    expect(beachNeedsVolunteers({ severity: "High" }, daysAgo(2), 3, now)).toBe(false);
  });
  it("also includes beaches with no recent cleanup even without an upcoming event", () => {
    expect(beachNeedsVolunteers({ severity: "High" }, daysAgo(30), 12, now)).toBe(true);
    expect(beachNeedsVolunteers({ severity: "High" }, daysAgo(29), 12, now)).toBe(false);
    expect(beachNeedsVolunteers({ severity: "High" }, null, undefined, now)).toBe(true);
  });
  it("does not turn unknown data, low bands or insufficient evidence into priorities", () => {
    expect(beachNeedsVolunteers({ severity: "Low" }, null, 0, now)).toBe(false);
    expect(beachNeedsVolunteers({ severity: "High", insufficientData: true }, null, 0, now)).toBe(false);
    expect(beachNeedsVolunteers({ severity: null }, null, 0, now)).toBe(false);
    expect(beachNeedsVolunteers({ severity: "High" }, undefined, undefined, now)).toBe(false);
    expect(beachNeedsVolunteers({ severity: "High" }, "invalid", 5, now)).toBe(false);
  });
});
