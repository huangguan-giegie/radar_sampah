import { useEffect, useState } from "react";
import type { CleanupEvent } from "./iteration2";

type EventSchedule = Pick<CleanupEvent, "date" | "startsAt" | "endsAt" | "status">;

/** Event dates and wall-clock times are in Malaysia, independent of the device zone. */
export function eventPhase(event: EventSchedule, now = Date.now()): "upcoming" | "ongoing" | "ended" | "unavailable" {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return "unavailable";
  const date = new Date(`${event.date}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== event.date) return "unavailable";
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(event.startsAt) || !time.test(event.endsAt)) return "unavailable";
  const start = Date.parse(`${event.date}T${event.startsAt}:00+08:00`);
  const end = Date.parse(`${event.date}T${event.endsAt}:00+08:00`);
  if (!Number.isFinite(now) || end <= start) return "unavailable";
  if (now >= end) return "ended";
  return now < start ? "upcoming" : "ongoing";
}

export function eventIsAvailable(event: EventSchedule, now = Date.now()): boolean {
  const phase = eventPhase(event, now);
  return event.status === "Open" && (phase === "upcoming" || phase === "ongoing");
}

export function eventCanCheckIn(event: EventSchedule, now = Date.now()): boolean {
  return event.status === "Open" && eventPhase(event, now) === "ongoing";
}

export function useEventClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return now;
}
