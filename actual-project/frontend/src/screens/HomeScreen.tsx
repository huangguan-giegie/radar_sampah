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
import { eventIsAvailable, useEventClock } from "../eventAvailability";
import { iteration3Request } from "../iteration3Api";
import { dismissNextAction, dismissedNextActions, fallbackNextAction, type NextAction } from "../iteration3Personal";

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
  const beach = beaches.find((b) => b.id === "morib") ?? beaches[0];
  const { data: detail } = useAsyncData(
    () => (beach ? getBeach(beach.id) : Promise.resolve(null)),
    [beach?.id, reportsVersion],
    null,
  );
  const { data: events } = useAsyncData(
    () => fetchCleanupEvents(user?.participantId),
    [user?.participantId, reportsVersion],
    [],
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
    nav("/report/photo");
  };
  const exploreBeaches = () => nav("/map?panel=beaches", { state: { fromHome: true } });
  const h = new Date().getHours();
  return (
    <CoastalPage>
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
          ) : beaches.length ? beaches.map((item) => (
            <LinkRow key={item.id} title={item.name} subtitle={item.area} onClick={() => nav("/cleanup/" + item.id)} />
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
      {nextAction && !dismissedActions.includes(nextAction.id) && (
        <WhiteCard>
          <p className="eyebrow">Next Action</p>
          <h2>{nextAction.actionLabel}</h2>
          <p className="subtle">{nextAction.reason}</p>
          <PrimaryButton onClick={() => {
            if (nextAction.destination.type === 'report') {
              if (hasDraftProgress(draft)) { setDraftChoice(true); return; }
              resetDraft();
              setLastSavedReport(null);
              if (nextAction.destination.beachId) {
                const targetBeach = beaches.find(item => item.id === nextAction.destination.beachId);
                if (targetBeach) patchDraft({ beachId: targetBeach.id, beachName: targetBeach.name, locationSource: 'manual', coords: null });
              }
            }
            nav(nextAction.destination.path);
          }}>{nextAction.actionLabel}</PrimaryButton>
          {nextAction.loginPrompt && <button onClick={() => nav(nextAction.loginPath ?? '/identity?next=/home')}>{nextAction.loginPrompt}</button>}
          <button onClick={() => {
            setDismissedActions(dismissNextAction(nextAction.id, user?.participantId));
          }}>Dismiss suggestion</button>
        </WhiteCard>
      )}
      {(!beach || error) && (
        <GhostButton height={44} onClick={exploreBeaches}>
          Explore Beaches
        </GhostButton>
      )}
      <div className="action-grid">
        <ActionTile
          title="Report Litter"
          subtitle="Take a photo"
          icon={<Camera color={C.navy} size={18} />}
          onClick={() =>
            hasDraftProgress(draft) ? setDraftChoice(true) : beginReport()
          }
        />
        <ActionTile
          title="Join Cleanup"
          subtitle="Choose an event"
          icon={<CommunityIcon color={C.navy} size={19} />}
          onClick={() => nav("/community")}
        />
        <ActionTile
          title="Log Cleanup"
          subtitle="What you cleared"
          icon={<Check color={C.navy} size={21} />}
          onClick={() => setChooseCleanupBeach(true)}
        />
      </div>
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
              <span className="photo-pill">Featured Beach</span>
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
          </div>
        </section>
      ) : (
        <DataUnavailable title="No beaches available" />
      )}
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
