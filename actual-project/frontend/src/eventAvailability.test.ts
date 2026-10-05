import { describe, expect, it } from "vitest";
import { eventCanCheckIn, eventIsAvailable, eventPhase } from "./eventAvailability";

const event = { date: "2026-10-03", startsAt: "09:00", endsAt: "12:00", status: "Open" as const };

describe("Malaysia cleanup event availability", () => {
  it("only enables check-in during the open event, not while joining is available in advance", () => {
    const start = Date.parse("2026-10-03T01:00:00Z");
    const end = Date.parse("2026-10-03T04:00:00Z");
    expect(eventIsAvailable(event, start - 1)).toBe(true);
    expect(eventCanCheckIn(event, start - 1)).toBe(false);
    expect(eventCanCheckIn(event, start)).toBe(true);
    expect(eventCanCheckIn(event, end - 1)).toBe(true);
    expect(eventCanCheckIn(event, end)).toBe(false);
    expect(eventCanCheckIn({ ...event, status: "Closed" }, start)).toBe(false);
  });
  it("uses Malaysia time even when the browser clock is expressed in another zone", () => {
    expect(eventPhase(event, Date.parse("2026-10-02T17:30:00-07:00"))).toBe("upcoming");
    expect(eventPhase(event, Date.parse("2026-10-03T01:00:00Z"))).toBe("ongoing");
    expect(eventIsAvailable(event, Date.parse("2026-10-03T03:59:59Z"))).toBe(true);
  });

  it("stops recommending and joining an Open event exactly when it ends", () => {
    const end = Date.parse("2026-10-03T04:00:00Z");
    expect(eventPhase(event, end)).toBe("ended");
    expect(eventIsAvailable(event, end)).toBe(false);
    expect(eventIsAvailable(event, Date.parse("2026-10-03T20:00:00+08:00"))).toBe(false);
  });

  it("does not offer a closed event even before its start", () => {
    expect(eventIsAvailable({ ...event, status: "Closed" }, Date.parse("2026-10-02T00:00:00Z"))).toBe(false);
  });

  it.each([
    { date: "2026-02-31" },
    { date: "not-a-date" },
    { startsAt: "24:00" },
    { endsAt: "12:70" },
    { endsAt: "09:00" },
    { endsAt: "08:00" },
  ])("does not offer invalid schedules: %j", (invalid) => {
    expect(eventPhase({ ...event, ...invalid })).toBe("unavailable");
    expect(eventIsAvailable({ ...event, ...invalid })).toBe(false);
  });
});
