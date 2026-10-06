import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight } from "../components/Icon";
import { SeverityBadge } from "../components/ds";
import {
  CoastalPage,
  DataUnavailable,
  LinkRow,
  Sheet,
  SummaryCard,
  WhiteCard,
} from "../components/CoastalUI";
import { GhostButton, Skeleton } from "../components/ui";
import { useApp } from "../AppContext";
import { getBeaches, USE_MOCK } from "../api";
import { formatEventDate, formatEventTimeRange, relativeEventWeek } from "../iteration2";
import { fetchCleanupEvents, fetchLatestCleanupForBeach } from "../iteration2Api";
import { useAsyncData } from "../useAsyncData";
import { C } from "../theme";
import { eventIsAvailable, eventPhase, useEventClock } from "../eventAvailability";
import content from "../content/coastalContent.json";
import { beachNeedsVolunteers } from "../volunteerNeeds";
import { hasMapCoordinates } from "../mapGeometry";
import "../styles/community-alignment.css";

type Filter = "All" | "Near Me" | "Joined";
// Keep the last result only in this tab's memory so a detail-page return does not ask again.
let lastPosition: { lat: number; lng: number } | null = null;

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const p =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
}
export default function CommunityScreen() {
  const nav = useNavigate();
  const location = useLocation();
  const needs = location.pathname.endsWith("/needs-volunteers");
  const { user, reportsVersion } = useApp();
  const [search, setSearch] = useSearchParams();
  const selectedBeach = content.beaches.find(b => b.id === search.get("beach"));
  const clearBeach = () => setSearch(previous => {
    const next = new URLSearchParams(previous); next.delete("beach"); return next;
  }, { replace: true });
  const filter: Filter = search.get("filter") === "nearby" ? "Near Me" : search.get("filter") === "joined" ? "Joined" : "All";
  const now = useEventClock();
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    lastPosition,
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationAttempt, setLocationAttempt] = useState(0);
  const locationRequest = useRef(0);
  const [why, setWhy] = useState(false);
  const {
    data: events,
    loading,
    error,
    refresh,
  } = useAsyncData(
    () => fetchCleanupEvents(user?.participantId, !needs && filter === "Joined"),
    [user?.participantId, filter, needs, reportsVersion],
    [],
  );
  const { data: beaches, loading: beachesLoading, error: beachesError, refresh: refreshBeaches } = useAsyncData(getBeaches, [reportsVersion], []);
  const { data: recentCleanups, loading: historyLoading, error: historyError, refresh: refreshHistory } = useAsyncData(
    async () => needs ? Object.fromEntries(await Promise.all(beaches.map(async b => [b.id, (await fetchLatestCleanupForBeach(b.id))?.createdAt ?? null]))) as Record<string, string | null> : {},
    [needs, beaches, reportsVersion], {} as Record<string, string | null>,
  );
  const nextEvents = [...events].filter(e => eventIsAvailable(e, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const needsHelp = (b: typeof beaches[number]) => beachNeedsVolunteers(b, recentCleanups?.[b.id], nextEvents.find(e => e.beachId === b.id)?.participantCount, now);
  const withoutEvent = needs && filter !== "Joined" ? beaches.filter(b =>
    (!selectedBeach || b.id === selectedBeach.id) && needsHelp(b) && !nextEvents.some(e => e.beachId === b.id) &&
    (filter !== "Near Me" || !!position && hasMapCoordinates(b) && distanceKm(position, b) <= 60)) : [];
  const needsBeachData = needs || filter === "Near Me";
  function chooseFilter(value: Filter) {
    const next = new URLSearchParams(search);
    if (value === "All") next.delete("filter");
    else next.set("filter", value === "Near Me" ? "nearby" : "joined");
    setSearch(next, { replace: true });
  }
  useEffect(() => {
    const request = ++locationRequest.current;
    if (filter !== "Near Me" || position) return;
    setLocationError("");
    setLocating(true);
    if (!navigator.geolocation) {
      setLocationError(
        "Location is unavailable. You can still browse all activities.",
      );
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (request !== locationRequest.current) return;
        lastPosition = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPosition(lastPosition);
        setLocating(false);
      },
      () => {
        if (request !== locationRequest.current) return;
        setLocationError(
          "Location wasn’t shared. Browse all activities, or allow location in your browser and try again.",
        );
        setLocating(false);
      },
      { timeout: 12000, maximumAge: 60000 },
    );
    return () => { locationRequest.current += 1; };
  }, [filter, position, locationAttempt]);
  const filtered = events
    .filter(e => !selectedBeach || e.beachId === selectedBeach.id)
    .filter((e) => filter !== "Joined" || (!!user && e.joined))
    .filter((e) => filter === "Joined" && !needs || eventIsAvailable(e, now))
    .filter((e) => {
      const b = beaches.find((b) => b.id === e.beachId);
      if (
        needs &&
        (!b || !needsHelp(b))
      )
        return false;
      if (filter === "Near Me")
        return !!position && hasMapCoordinates(b) && distanceKm(position, b) <= 60;
      return true;
    });
  const grouped = [...filtered].sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt)).reduce<Record<string, typeof events>>((all, e) => {
    (all[e.date] ??= []).push(e);
    return all;
  }, {});
  return (
    <CoastalPage
      title={needs ? "Beaches Needing Help" : "Community Cleanups"}
      eyebrow="Community"
      className="community-alignment"
      back={needs || filter !== "All" ? "/community" : undefined}
      backMode={!needs && filter !== "All" ? "destination" : "history"}
      subtitle={
        needs
          ? "Moderate or above · a little help goes a long way"
          : filter === "Near Me" ? "Cleanups within 60 km of your approximate location."
          : filter === "Joined" ? "Cleanups you have joined. Leave any time from the event page."
          : "One Saturday cleanup for each beach at Moderate or above. Join any that suit you."
      }
      action={
        user?.role === "moderator" ? (
          <button onClick={() => nav("/platform/events/new")}>Manage events</button>
        ) : undefined
      }
    >
      {selectedBeach && <div className="filter-chips" style={{ margin: 0 }}><button aria-label="Show all beaches" onClick={clearBeach}>{selectedBeach.name} ×</button></div>}
      <div className="filter-chips community-filters" style={{ margin: 0 }}>
        {(["All", "Joined", "Near Me"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => chooseFilter(f)}>
            {f === "All" ? "All Dates" : f}
          </button>
        ))}
      </div>
      {!needs && (
        <button
          className="volunteer-banner"
          onClick={() => nav("/community/needs-volunteers")}
        >
          <span>
            <strong>Beaches Needing Help</strong>
          </span>
          <ChevronRight color={C.lime} size={18} />
        </button>
      )}
      {needs && (
        <SummaryCard eyebrow="Where you can help">
          <p style={{ lineHeight: 1.5, margin: 0 }}>
            These beaches have no recent cleanup or fewer than 3 people joined their next activity.
          </p>
          <button
            style={{ color: C.lime, marginTop: 14 }}
            onClick={() => setWhy(true)}
          >
            Why These Beaches?
          </button>
        </SummaryCard>
      )}
      {filter === "Near Me" && (
        <p className="coastal-footnote" role="status">
          {locating
            ? "Checking your location…"
            : locationError ||
              "Activities within 60 km. Your location stays on this device."}
        </p>
      )}
      {filter === "Near Me" && !position ? (
        locationError ? (
          <DataUnavailable title="Location Unavailable" retry={() => setLocationAttempt((value) => value + 1)}>
            <GhostButton onClick={() => chooseFilter("All")}>See All Dates</GhostButton>
          </DataUnavailable>
        ) : <Skeleton h={190} />
      ) : loading || (needsBeachData && beachesLoading) || (needs && historyLoading) ? (
        <Skeleton h={190} />
      ) : error ? (
        <DataUnavailable
          title="Couldn’t Load Activities"
          retry={() => void refresh()}
        >
          {error}
        </DataUnavailable>
      ) : needsBeachData && beachesError ? (
        <DataUnavailable title="Couldn’t Load Beaches" retry={() => void refreshBeaches()}>
          Please try again.
        </DataUnavailable>
      ) : needs && historyError ? (
        <DataUnavailable title="Couldn’t Load Cleanup History" retry={() => void refreshHistory()}>Please try again.</DataUnavailable>
      ) : !filtered.length && !withoutEvent.length ? (
        <DataUnavailable
          title={
            filter === "Joined"
              ? "You haven't joined a cleanup yet"
              : filter === "Near Me"
                ? "No Cleanups Nearby"
                : selectedBeach ? "No Upcoming Cleanups Here" : "No Activities Yet"
          }
        >
          {filter === "Joined" && !user ? (
            <>
              <p>Log in to keep track of your cleanups.</p>
              <GhostButton onClick={() => nav("/identity?next=" + encodeURIComponent(location.pathname + location.search))}>
                Log In
              </GhostButton>
            </>
          ) : (
            <>
              <p>
                {filter === "Joined" ? "Pick a date under All Dates, then tap Join This Cleanup." : "Try another filter or come back when more activities are available."}
              </p>
              <GhostButton onClick={() => selectedBeach ? clearBeach() : chooseFilter("All")}>
                {selectedBeach ? "Show All Beaches" : "See All Dates"}
              </GhostButton>
            </>
          )}
        </DataUnavailable>
      ) : (
        Object.entries(grouped).map(([date, rows]) => (
          <section key={date}>
            <div className="community-date-heading">
              <span>{relativeEventWeek(date) ?? "Past cleanup"}</span>
              <span>{formatEventDate(date)}</span>
            </div>
            <div className="event-list">
              {rows.map((e) => {
                const b = beaches.find((b) => b.id === e.beachId);
                return (
                  <button
                    key={e.id}
                    className="coastal-event"
                    onClick={() => nav("/events/" + e.id)}
                  >
                    <span className="event-calendar">
                      <strong>{date.slice(8, 10)}</strong>
                      <small>{new Date(date + "T12:00:00+08:00").toLocaleDateString("en-GB", { month: "short", timeZone: "Asia/Kuala_Lumpur" }).toUpperCase()}</small>
                      <small>
                        {new Date(date + "T12:00:00")
                          .toLocaleDateString("en-GB", { weekday: "short" })
                          .toUpperCase()}
                      </small>
                    </span>
                    <span className="grow">
                      <h3>{e.beachName}</h3>
                      <p>{formatEventTimeRange(e.startsAt, e.endsAt)}</p>
                      <p>{e.area}</p>
                      <span className="event-tags">
                        <span>{e.participantCount} joined</span>
                        {e.joined && (
                          <span
                            style={{ background: "#e9f6ee", color: "#177a3e" }}
                          >
                            Joined
                          </span>
                        )}
                        {eventPhase(e, now) === "ended" ? <span>Ended</span> : e.status === "Closed" ? <span>Closed</span> : eventPhase(e, now) === "ongoing" ? <span>In progress</span> : null}
                        {b && (
                          <SeverityBadge
                            band={b.insufficientData ? null : b.severity}
                          />
                        )}
                      </span>
                    </span>
                    <ChevronRight color={C.navy} />
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
      {needs && !loading && !beachesLoading && !historyLoading && !error && !beachesError && !historyError && withoutEvent.map(b => <WhiteCard key={b.id}>
        <LinkRow title={b.name} subtitle="No upcoming cleanup · view this beach" trailing={<SeverityBadge band={b.severity} />} onClick={() => nav("/beach/" + b.id)} />
      </WhiteCard>)}
      {USE_MOCK && <p className="demo-label">Preview · example schedule</p>}
      {why && (
        <Sheet title="Why These Beaches?" onClose={() => setWhy(false)}>
          <WhiteCard>
            <h3>Available litter evidence</h3>
            <p className="subtle">
              A beach is flagged at Moderate, High or Very high when it has no cleanup in the last 30 days, or fewer than 3 people have joined its next cleanup.
            </p>
          </WhiteCard>
          <p className="subtle">
            Low bands and Insufficient Data are not flagged as cleanup priorities.
          </p>
          <LinkRow title="How It’s Rated" onClick={() => nav("/method")} />
        </Sheet>
      )}
    </CoastalPage>
  );
}
