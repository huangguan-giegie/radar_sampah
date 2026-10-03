import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getMyReportCounts,
  getMyReports,
  storedRecoveryToken,
  USE_MOCK,
} from "../api";
import { useApp } from "../AppContext";
import { fetchCleanupEvents } from "../iteration2Api";
import { useAsyncData } from "../useAsyncData";
import {
  CoastalPage,
  DataUnavailable,
  LinkRow,
  Sheet,
  SummaryCard,
  WhiteCard,
} from "../components/CoastalUI";
import {
  GhostButton,
  PrimaryButton,
  downloadRecoveryKit,
  Skeleton,
} from "../components/ui";
import {
  BarChart,
  BookmarkIcon,
  ShieldCheck,
  SpeciesIcon,
  UserIcon,
} from "../components/Icon";
import { formatDate } from "../theme";
import {
  readPreviewProfile,
  savePreviewProfile,
  validNickname,
} from "../accountPreview";
const TOP = [
  ["PenyuPal", 184],
  ["KakiPantai", 176],
  ["PantaiPatrol", 151],
  ["SabahShores", 139],
  ["TerengganuTides", 127],
];
export default function AccountScreen() {
  const { section } = useParams();
  const nav = useNavigate();
  const { user, signOut, reportsVersion, showToast } = useApp();
  const id = user?.participantId ?? "";
  const { data: counts, loading: countsLoading, error: countsError, refresh: refreshCounts } = useAsyncData(
    getMyReportCounts,
    [reportsVersion, id],
    null,
  );
  const { data: events, loading: eventsLoading, error: eventsError, refresh: refreshEvents } = useAsyncData(
    () => fetchCleanupEvents(id, true),
    [id, reportsVersion],
    [],
  );
  const { data: reports, loading: reportsLoading, error: reportsError, refresh: refreshReports } = useAsyncData(
    getMyReports,
    [id, reportsVersion],
    [],
  );
  const attendance = events.filter(
    (e) => e.attendanceConfirmed || e.attendanceBy?.includes(id),
  );
  const loading = countsLoading || eventsLoading || reportsLoading;
  const error = countsError || eventsError || reportsError;
  const ready = !loading && !error;
  const points = ready && counts ? counts.counted + attendance.length * 5 : null;
  const counted = ready ? counts?.counted ?? "—" : "—";
  const contributionSummary = loading ? "Loading contributions…" : error ? "Contributions unavailable" : `${attendance.length} recorded attendance · ${counted} counted reports`;
  const loadError = error ? (
    <DataUnavailable title="Couldn’t Load Contributions" retry={() => { void refreshCounts(); void refreshEvents(); void refreshReports(); }}>Please try again.</DataUnavailable>
  ) : null;
  const [profile, setProfile] = useState(() => readPreviewProfile(id));
  const [nickname, setNickname] = useState(profile.nickname);
  const [validation, setValidation] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const recoveryToken = storedRecoveryToken();
  function save(join?: boolean) {
    if (!validNickname(nickname)) {
      setValidation(
        "Use 3–30 characters. Don’t use an email address or phone number.",
      );
      return;
    }
    const next = {
      nickname: nickname.trim(),
      joinedLeaderboard: join ?? profile.joinedLeaderboard,
    };
    try {
      savePreviewProfile(id, next);
      setProfile(next);
      setValidation("");
      showToast("Saved on this device");
      if (join === undefined) nav("/account");
    } catch {
      setValidation(
        "Could not save on this device. Please enable browser storage.",
      );
    }
  }
  const icon = (child: JSX.Element) => (
    <span
      className="row-thumb"
      style={{ width: 36, height: 36, borderRadius: 10 }}
    >
      {child}
    </span>
  );
  const nicknameInput = (
    <WhiteCard>
      <label className="eyebrow" htmlFor="public-nickname">
        Nickname
      </label>
      <input
        id="public-nickname"
        className="coastal-input"
        maxLength={30}
        autoComplete="off"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <p className="coastal-footnote">
        3–30 characters. Not your name, email or phone.
      </p>
      {validation && (
        <p
          role="alert"
          className="coastal-footnote"
          style={{ color: "#9c4237" }}
        >
          {validation}
        </p>
      )}
    </WhiteCard>
  );
  if (section === "nickname")
    return (
      <CoastalPage
        title="Public Nickname"
        back="/account"
        subtitle="Only shown on the leaderboard if you join."
      >
        {USE_MOCK ? (
          <>
            {nicknameInput}
            <PrimaryButton onClick={() => save()}>Save Nickname</PrimaryButton>
            <p className="demo-label">Preview · saved only on this device</p>
          </>
        ) : (
          <DataUnavailable title="Nickname Editing Is Not Available Yet">
            Your participant ID is still available in Account.
          </DataUnavailable>
        )}
      </CoastalPage>
    );
  if (section === "history")
    return (
      <CoastalPage title="Contribution History" back="/account">
        <SummaryCard
          eyebrow={USE_MOCK ? "Your Points · Preview" : "Your Contributions"}
          value={USE_MOCK ? (points ?? "—") : counted}
          description={USE_MOCK ? "points" : "counted reports"}
        >
          <p className="account-divider">
            {contributionSummary}
          </p>
        </SummaryCard>
        {loading ? <Skeleton h={160} /> : loadError}
        {ready && attendance.map((e) => (
          <WhiteCard key={e.id}>
            <LinkRow
              title="Recorded attendance"
              subtitle={e.beachName + " · " + formatDate(e.date)}
              trailing={USE_MOCK ? <b>+5</b> : undefined}
              onClick={() => nav("/events/" + e.id)}
            />
          </WhiteCard>
        ))}
        {ready && reports
          .filter((r) => r.status === "Counted")
          .map((r) => (
            <WhiteCard key={r.id}>
              <LinkRow
                title="Counted report"
                subtitle={r.beachName + " · " + formatDate(r.createdAt)}
                trailing={USE_MOCK ? <b>+1</b> : undefined}
                onClick={() => nav("/reports/" + r.id)}
              />
            </WhiteCard>
          ))}
        {ready && !attendance.length && !reports.some((r) => r.status === "Counted") && (
          <DataUnavailable title="Your History Starts Here">
            Counted reports and recorded attendance will appear here.
          </DataUnavailable>
        )}
        <p className="coastal-footnote">
          Duplicate and incomplete reports are not included.{" "}
          {USE_MOCK
            ? "Preview points: recorded attendance +5, counted report +1."
            : ""}
        </p>
      </CoastalPage>
    );
  if (section === "leaderboard")
    return (
      <CoastalPage
        title="Leaderboard"
        back="/account"
        subtitle={
          profile.joinedLeaderboard
            ? "Nicknames only. You opted in."
            : "Off until you join. Leave any time."
        }
      >
        {USE_MOCK && loadError}
        {!USE_MOCK ? (
          <DataUnavailable title="Leaderboard Not Available Yet">
            You can still view your own reports and contribution history.
          </DataUnavailable>
        ) : profile.joinedLeaderboard ? (
          <>
            <SummaryCard
              eyebrow="Your Preview Profile"
              description={profile.nickname}
              value={points ?? "—"}
            >
              <p className="account-divider">
                points · personal rank not calculated
              </p>
            </SummaryCard>
            <WhiteCard>
              {TOP.map(([name, value], i) => (
                <div className="leaderboard-row" key={name}>
                  <span>#{i + 1}</span>
                  <strong>{name}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </WhiteCard>
            <p className="demo-label">Example leaderboard · as of 27-09-2026</p>
            <GhostButton
              onClick={() => {
                const next = { ...profile, joinedLeaderboard: false };
                try {
                  savePreviewProfile(id, next);
                  setProfile(next);
                } catch {
                  showToast("Could not save your preference.");
                }
              }}
            >
              Leave Leaderboard
            </GhostButton>
          </>
        ) : (
          <>
            {nicknameInput}
            <SummaryCard eyebrow="Others Will See">
              <div className="leaderboard-row">
                <strong style={{ color: "white" }}>
                  {nickname || "Your nickname"}
                </strong>
                <span style={{ color: "#b8ff36" }}>{points ?? "—"} pts</span>
              </div>
            </SummaryCard>
            <PrimaryButton onClick={() => save(true)}>
              Join Leaderboard
            </PrimaryButton>
            <p className="demo-label">
              Preview · this choice stays on your device
            </p>
          </>
        )}
      </CoastalPage>
    );
  return (
    <CoastalPage title="Account">
      <SummaryCard eyebrow="">
        <div className="account-id">
          <div>
            <p className="eyebrow">Participant ID</p>
            <strong>{id}</strong>
          </div>
          <div>
            <p className="eyebrow">{USE_MOCK ? "Points" : "Reports"}</p>
            <strong>
              {USE_MOCK ? (points ?? "—") : counted}
            </strong>
          </div>
        </div>
        <p className="account-divider">
          {contributionSummary}
        </p>
      </SummaryCard>
      {loadError}
      <WhiteCard>
        <LinkRow
          title="Marine Life"
          subtitle="Explore species and habitats"
          leading={icon(<SpeciesIcon glyph="turtle" />)}
          onClick={() => nav("/marine-life")}
        />
      </WhiteCard>
      <WhiteCard>
        <LinkRow
          title="Public Nickname"
          trailing={<small>{profile.nickname || "Not set"}</small>}
          leading={icon(<UserIcon />)}
          onClick={() => nav("/account/nickname")}
        />
        <LinkRow
          title="Contribution History"
          leading={icon(<BarChart />)}
          onClick={() => nav("/account/history")}
        />
        <LinkRow
          title="Leaderboard"
          leading={icon(<BarChart />)}
          onClick={() => nav("/account/leaderboard")}
        />
        <LinkRow
          title="My Reports"
          trailing={<small>{reportsLoading || reportsError ? "—" : reports.length}</small>}
          leading={icon(<BookmarkIcon />)}
          onClick={() => nav("/reports")}
        />
      </WhiteCard>
      <WhiteCard>
        <LinkRow
          title="How It’s Rated"
          leading={icon(<BarChart />)}
          onClick={() => nav("/method")}
        />
      </WhiteCard>
      <WhiteCard>
        <LinkRow
          title="Location Privacy"
          leading={icon(<ShieldCheck />)}
          onClick={() => setPrivacy(true)}
        />
        {recoveryToken && (
          <LinkRow
            title="Save Recovery Details"
            leading={icon(<ShieldCheck />)}
            onClick={() => downloadRecoveryKit(id, recoveryToken)}
          />
        )}
        <LinkRow
          title="Sign Out"
          onClick={async () => {
            await signOut();
            nav("/welcome", { replace: true });
          }}
        />
      </WhiteCard>
      <p className="coastal-footnote" style={{ textAlign: "center" }}>
        Save your ID and recovery token before signing out.
      </p>
      {USE_MOCK && (
        <p className="demo-label">
          Preview · points are calculated on this device
        </p>
      )}
      {privacy && (
        <Sheet title="Your Privacy Matters" onClose={() => setPrivacy(false)}>
          <p className="subtle">
            You can browse beaches and Insights without sharing device location.
          </p>
          <ul className="subtle">
            <li>
              For a report, GPS can suggest a beach and check for matching
              litter. You can select a beach manually.
            </li>
            <li>
              Personalised suggestions use beach-level context. Device location
              is optional.
            </li>
          </ul>
          <SummaryCard eyebrow="Your location">
            <p>
              Report GPS is used for checks, then discarded. Others see only the
              beach.
            </p>
          </SummaryCard>
          <PrimaryButton
            style={{ marginTop: 16 }}
            onClick={() => setPrivacy(false)}
          >
            Got It
          </PrimaryButton>
        </Sheet>
      )}
    </CoastalPage>
  );
}
