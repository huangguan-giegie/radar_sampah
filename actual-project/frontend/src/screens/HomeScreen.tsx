import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBeach, getBeaches, USE_MOCK } from "../api";
import { useApp } from "../AppContext";
import { Camera, Check, CommunityIcon, UserIcon } from "../components/Icon";
import {
  CoastalPage,
  WhiteCard,
  ActionTile,
  DataUnavailable,
  Sheet,
  LinkRow,
} from "../components/CoastalUI";
import {
  DraftChoiceDialog,
  GhostButton,
  PrimaryButton,
  Skeleton,
} from "../components/ui";
import { SeverityBadge } from "../components/ds";
import { hasDraftProgress, resumePath } from "../flowRules";
import { fetchCleanupEvents } from "../iteration2Api";
import { formatEventDate } from "../iteration2";
import { useAsyncData } from "../useAsyncData";
import { C } from "../theme";
import { cleanupDestination } from "../cleanupFlow";
import { eventIsAvailable, useEventClock } from "../eventAvailability";
import { iteration3Request } from "../iteration3Api";
import { dismissNextAction, dismissedNextActions, fallbackNextAction, type NextAction } from "../iteration3Personal";
import "../styles/home-map-alignment.css";
import { getPreferredBeachId } from "../locationPreference";

export default function HomeScreen() {
  const nav = useNavigate();
  const {
    user,
    draft,
    resetDraft,
    patchDraft,
    setLastSavedReport,
    reportsVersion,
  } = useApp();
  const [draftChoice, setDraftChoice] = useState(false);
  const [chooseCleanupBeach, setChooseCleanupBeach] = useState(false);
  const [preferredBeachId] = useState(getPreferredBeachId);
  const [dismissedActions, setDismissedActions] = useState<string[]>(() => dismissedNextActions(user?.participantId));
  useEffect(() => setDismissedActions(dismissedNextActions(user?.participantId)), [user?.participantId]);
  const { data: loadedAction, loading: actionLoading } = useAsyncData(
    () => iteration3Request<NextAction>('/recommendations/next-action'),
    [user?.participantId, reportsVersion], null,
  );
  const nextAction = loadedAction ?? (!actionLoading ? fallbackNextAction(Boolean(user)) : null);
  const now = useEventClock();
  const {
    data: beaches,
    loading,
    error,
    refresh,
  } = useAsyncData(getBeaches, [reportsVersion], []);
  const { data: events } = useAsyncData(
    () => fetchCleanupEvents(user?.participantId),
    [user?.participantId, reportsVersion],
    [],
  );
  const recommendedEvent = events.find((item) => item.id === nextAction?.destination.id && eventIsAvailable(item, now));
  const recommendedBeachId = nextAction?.destination.beachId ?? recommendedEvent?.beachId;
  const beach = beaches.find((item) => item.id === preferredBeachId)
    ?? beaches.find((item) => item.id === recommendedBeachId)
    ?? beaches.find((item) => item.id === "morib")
    ?? beaches[0];
  const { data: detail } = useAsyncData(
    () => (beach ? getBeach(beach.id) : Promise.resolve(null)),
    [beach?.id, reportsVersion],
    null,
  );
  const event = events.find(
    (e) => e.beachId === beach?.id && eventIsAvailable(e, now),
  );
  const dominant = detail?.composition
    ?.slice()
    .sort((a, b) => b.percentage - a.percentage)[0];
  const beginReport = () => {
    resetDraft();
    setLastSavedReport(null);
    if (beach) patchDraft({ beachId: beach.id, beachName: beach.name, locationSource: "manual", coords: null });
    nav("/report/photo");
  };
  const openNextAction = () => {
    if (!nextAction) return;
    if (nextAction.destination.type === "report") {
      if (hasDraftProgress(draft)) { setDraftChoice(true); return; }
      resetDraft();
      setLastSavedReport(null);
      const target = beaches.find((item) => item.id === nextAction.destination.beachId);
      if (target) patchDraft({ beachId: target.id, beachName: target.name, locationSource: "manual", coords: null });
    }
    nav(nextAction.destination.path);
  };
  const exploreBeaches = () => nav("/map?panel=beaches", { state: { fromHome: true } });
  const h = new Date().getHours();
  return (
    <CoastalPage className="home-aligned">
      {draftChoice && (
        <DraftChoiceDialog
          onCancel={() => setDraftChoice(false)}
          onResume={() => nav(resumePath(draft))}
          onStartNew={() => {
            setDraftChoice(false);
            beginReport();
          }}
        />
      )}
      {chooseCleanupBeach && (
        <Sheet title="Where did you clean?" onClose={() => setChooseCleanupBeach(false)}>
          {loading ? <Skeleton h={160} /> : error ? (
            <DataUnavailable title="Could not load beaches" retry={() => void refresh()}>{error}</DataUnavailable>
          ) : beaches.length ? [beach, ...beaches.filter((item) => item.id !== beach?.id)].filter((item) => !!item).map((item) => (
            <LinkRow key={item.id} title={item.name} subtitle={item.area + (item.id === beach?.id ? " · Featured beach" : "")} onClick={() => nav(cleanupDestination(item.id))} />
          )) : <DataUnavailable title="No beaches available" />}
        </Sheet>
      )}
      <header className="home-header">
        <div>
          <p>
            {h < 12
              ? "Good morning,"
              : h < 18
                ? "Good afternoon,"
                : "Good evening,"}
          </p>
          <h1>{user ? "Participant " + user.participantId : "Anonymous"}</h1>
        </div>
        <button
          className="icon-button navy"
          onClick={() => nav("/account")}
          aria-label="Account"
        >
          <UserIcon size={28} color="white" />
        </button>
      </header>
      {(!beach || error) && (
        <GhostButton height={44} onClick={exploreBeaches}>
          Explore Beaches
        </GhostButton>
      )}
      {loading && !beach ? (
        <Skeleton h={340} />
      ) : error ? (
        <DataUnavailable
          title="Could not load beaches"
          retry={() => void refresh()}
        >
          {error}
        </DataUnavailable>
      ) : beach ? (
        <section className="home-beach-card">
          <div className="home-beach-photo">
            {(beach.coverImageUrl || beach.id === "morib") && (
              <img
                src={beach.coverImageUrl || "/home/pantai-morib.jpg"}
                alt={beach.name}
              />
            )}
            <div className="home-beach-overlay">
              <span className="photo-pill">{beach.id === preferredBeachId ? "You’re now in" : "Featured Beach"}</span>
              <div className="home-place">{beach.name}</div>
              <small>{beach.area}</small>
              <div className="home-band">
                <SeverityBadge
                  band={beach.insufficientData ? null : beach.severity}
                />
                {dominant && (
                  <small>
                    Mostly {dominant.category.toLowerCase()} ·{" "}
                    {Math.round(dominant.percentage)}%
                  </small>
                )}
              </div>
            </div>
          </div>
          <div className="home-beach-body">
            <h2>
              {user && event
                ? (event.joined ? "View your " : "Join ") +
                  beach.name +
                  "’s cleanup on " +
                  formatEventDate(event.date) +
                  "."
                : "Find a Beach Cleanup"}
            </h2>
            <p>
              {user ? (
                event ? (
                  "Litter reports and an upcoming activity make this a good next step for you."
                ) : (
                  "Explore the coast and see where your next report could help."
                )
              ) : (
                <button onClick={() => nav("/identity?next=/home")}>
                  Log in for a personal next step.
                </button>
              )}
            </p>
            <PrimaryButton
              onClick={() =>
                nav(user && event ? "/events/" + event.id : "/community")
              }
              trailingArrow
            >
              {user && event ? "View Event" : "View Events"}
            </PrimaryButton>
            <div className="button-pair">
              <GhostButton height={44} onClick={exploreBeaches}>
                See Other Beaches
              </GhostButton>
              <GhostButton
                height={44}
                onClick={() => nav("/beach/" + beach.id)}
              >
                View Beach Details
              </GhostButton>
            </div>
            {user && nextAction && !dismissedActions.includes(nextAction.id) && !(event && nextAction.destination.type === "event" && nextAction.destination.id === event.id) && (
              <div className="home-next-action">
                <button onClick={openNextAction}>{nextAction.actionLabel} →</button>
                <p>{nextAction.reason}</p>
                <button className="home-dismiss" onClick={() => setDismissedActions(dismissNextAction(nextAction.id, user.participantId))}>Dismiss suggestion</button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <DataUnavailable title="No beaches available" />
      )}
      <div className="action-grid">
        <ActionTile title="Report Litter" subtitle="Take a photo" icon={<Camera color={C.navy} size={18} />}
          onClick={() => hasDraftProgress(draft) ? setDraftChoice(true) : beginReport()} />
        <ActionTile title="Join Cleanup" subtitle="Choose an event" icon={<CommunityIcon color={C.navy} size={19} />}
          onClick={() => nav("/community")} />
        <ActionTile title="Log Cleanup" subtitle="What you cleared" icon={<Check color={C.navy} size={21} />}
          onClick={() => setChooseCleanupBeach(true)} />
      </div>
      <button
        className="marine-banner press"
        onClick={() => nav("/marine-life")}
      >
        <img
          src="/species/green-sea-turtle.jpg"
          alt="Green sea turtle swimming underwater"
        />
        <div>
          <strong>
            Discover
            <br />
            Marine Life
          </strong>
          <span>Meet the Species →</span>
        </div>
      </button>
      <WhiteCard>
        <h2>About Us</h2>
        <p className="subtle">
          Who we are, and why it matters: global data on plastic entering the
          ocean.
        </p>
        <PrimaryButton
          style={{ marginTop: 14 }}
          onClick={() => nav("/about")}
          trailingArrow
        >
          Read About Us
        </PrimaryButton>
      </WhiteCard>
      {USE_MOCK && <p className="demo-label">Preview · example data</p>}
    </CoastalPage>
  );
}
