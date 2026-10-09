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
import { formatEventDate, formatEventTimeRange } from "../iteration2";
import { fetchCleanupEvents, fetchLatestCleanupDates } from "../iteration2Api";
import { useAsyncData } from "../useAsyncData";
import { C } from "../theme";
import { eventIsAvailable, eventPhase, useEventClock } from "../eventAvailability";
import content from "../content/coastalContent.json";
import { beachNeedsVolunteers } from "../volunteerNeeds";
import { PlaceThumb } from "../components/Visuals";
import { beachPhoto } from "../visuals";

type Filter = "All" | "Near Me" | "Joined";
// Keep the last result only in this tab's memory so a detail-page return does not ask again.
let lastPosition: { lat: number; lng: number } | null = null;

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number | null; lng: number | null },
) {
  if (b.lat == null || b.lng == null) return Number.POSITIVE_INFINITY;
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
    () => needs && beaches.length ? fetchLatestCleanupDates(beaches.map(b => b.id)) : Promise.resolve({} as Record<string, string | null>),
    [needs, beaches, reportsVersion], {} as Record<string, string | null>,
  );
  const nextEvents = [...events].filter(e => eventIsAvailable(e, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const needsHelp = (b: typeof beaches[number]) => beachNeedsVolunteers(b, recentCleanups?.[b.id], nextEvents.find(e => e.beachId === b.id)?.participantCount, now);
  const volunteerPriority = (beach: typeof beaches[number]) => {
    const severityRank = { Severe: 4, High: 3, Moderate: 2, Low: 0 } as Record<string, number>;
    const event = nextEvents.find(item => item.beachId === beach.id);
    const last = recentCleanups?.[beach.id] ? Date.parse(recentCleanups[beach.id] as string) : NaN;
    const noRecentCleanup = recentCleanups?.[beach.id] == null || (Number.isFinite(last) && now - last >= 30 * 86400000);
    return (severityRank[beach.severity ?? ""] ?? 0) + (noRecentCleanup ? 2 : 0) + (event && event.participantCount < 3 ? 1 : 0);
  };
  const withoutEvent = needs && filter !== "Joined" ? beaches.filter(b =>
    (!selectedBeach || b.id === selectedBeach.id) && needsHelp(b) && !nextEvents.some(e => e.beachId === b.id) &&
    (filter !== "Near Me" || !!position && distanceKm(position, b) <= 50)).sort((a, b) => volunteerPriority(b) - volunteerPriority(a)) : [];
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
        return !!position && !!b && distanceKm(position, b) <= 50;
      return true;
    }).sort((a, b) => {
      if (!needs) return a.startsAt.localeCompare(b.startsAt);
      const beachA = beaches.find(item => item.id === a.beachId);
      const beachB = beaches.find(item => item.id === b.beachId);
      return (beachB ? volunteerPriority(beachB) : 0) - (beachA ? volunteerPriority(beachA) : 0);
    });
  const grouped = filtered.reduce<Record<string, typeof events>>((all, e) => {
    (all[e.date] ??= []).push(e);
    return all;
  }, {});
  return (
    <CoastalPage
      title={needs ? "Beaches Needing Help" : "Community Cleanups"}
      back={needs ? "/community" : undefined}
      subtitle={
        needs
          ? "Moderate or above · a little help goes a long way"
          : "Choose a beach. Make a difference together."
      }
      action={
        user?.role === "moderator" ? (
          <button onClick={() => nav("/platform/events/new")}>Organiser</button>
        ) : undefined
      }
    >
      {selectedBeach && <div className="filter-chips" style={{ margin: 0 }}><button aria-label="Show all beaches" onClick={clearBeach}>{selectedBeach.name} ×</button></div>}
      {!needs && (
        <button
          className="volunteer-banner"
          onClick={() => nav("/community/needs-volunteers")}
        >
          <span>
            <strong>Beaches Needing Help</strong>
            <small>Find your next cleanup</small>
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
      <div className="filter-chips" style={{ margin: 0 }}>
        {(["All", "Near Me", "Joined"] as const).map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => chooseFilter(f)}
          >
            {f === "All" ? "Upcoming" : f}
          </button>
        ))}
      </div>
      {filter === "Near Me" && (
        <p className="coastal-footnote" role="status">
          {locating
            ? "Checking your location…"
            : locationError ||
              "Activities within 50 km. Your location stays on this device."}
        </p>
      )}
      {filter === "Near Me" && !position ? (
        locationError ? (
          <DataUnavailable title="Location Unavailable" retry={() => setLocationAttempt((value) => value + 1)}>
            <GhostButton onClick={() => chooseFilter("All")}>Show Upcoming Activities</GhostButton>
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
              ? "No Joined Cleanups Yet"
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
                Try another filter or come back when more activities are
                available.
              </p>
              <GhostButton onClick={() => selectedBeach ? clearBeach() : chooseFilter("All")}>
                {selectedBeach ? "Show All Beaches" : "Show Upcoming Activities"}
              </GhostButton>
            </>
          )}
        </DataUnavailable>
      ) : (
        Object.entries(grouped).map(([date, rows]) => (
          <section key={date}>
            <p className="eyebrow">{formatEventDate(date)}</p>
            <div className="event-list">
              {rows.map((e) => {
                const b = beaches.find((b) => b.id === e.beachId);
                return (
                  <button
                    key={e.id}
                    className="coastal-event"
                    onClick={() => nav("/events/" + e.id)}
                  >
                    <span className="event-thumb">
                      <PlaceThumb image={beachPhoto(e.beachId, b?.coverImageUrl)} lat={b?.lat} lng={b?.lng} size={72} focus={[0.64, 0.32]} />
                      <span className="event-date">
                        <strong>{date.slice(8, 10)}</strong>
                        <small>
                          {new Date(date + "T12:00:00")
                            .toLocaleDateString("en-GB", { weekday: "short" })
                            .toUpperCase()}
                        </small>
                      </span>
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
      <p className="map-credit">Beach photos where available · other thumbnails show the location · map © OpenStreetMap contributors</p>
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
