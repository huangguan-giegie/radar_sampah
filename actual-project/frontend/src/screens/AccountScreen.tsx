import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getMyReportCounts,
  getMyReports,
  storedRecoveryToken,
  USE_MOCK,
  apiRequest,
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
interface Profile {
  nickname: string;
  joinedLeaderboard: boolean;
}
interface ContributionSummary {
  points: number;
  countedReports: number;
  recordedAttendances: number;
  history: {
    kind: "report" | "attendance";
    points: number;
    createdAt: string;
    beachName: string;
    reportId?: string;
    eventId?: string;
  }[];
}
interface LeaderboardRow {
  rank: number;
  nickname: string;
  points: number;
}
export default function AccountScreen() {
  const { section } = useParams();
  const nav = useNavigate();
  const { user, signOut, reportsVersion, showToast } = useApp();
  const id = user?.participantId ?? "";
  const { data: counts, loading: countsLoading, error: countsError, refresh: refreshCounts } = useAsyncData(
    () => USE_MOCK ? getMyReportCounts() : Promise.resolve(null),
    [reportsVersion, id],
    null,
  );
  const { data: events, loading: eventsLoading, error: eventsError, refresh: refreshEvents } = useAsyncData(
    () => USE_MOCK ? fetchCleanupEvents(id, true) : Promise.resolve([]),
    [id, reportsVersion],
    [],
  );
  const { data: reports, loading: reportsLoading, error: reportsError, refresh: refreshReports } = useAsyncData(
    getMyReports,
    [id, reportsVersion],
    [],
  );
  const {
    data: liveProfile, setData: setLiveProfile, loading: profileLoading,
    error: profileError, refresh: refreshProfile,
  } = useAsyncData<Profile | null>(
    () => USE_MOCK ? Promise.resolve(null) : apiRequest<Profile>("/profile"),
    [id], null,
  );
  const { data: contributions, loading: contributionsLoading, error: contributionsError, refresh: refreshContributions } = useAsyncData<ContributionSummary | null>(
    () => USE_MOCK ? Promise.resolve(null) : apiRequest<ContributionSummary>("/contributions"),
    [id, reportsVersion], null,
  );
  const { data: leaderboard, loading: leaderboardLoading, error: leaderboardError, refresh: refreshLeaderboard } = useAsyncData<LeaderboardRow[]>(
    () => !USE_MOCK && section === "leaderboard" ? apiRequest<LeaderboardRow[]>("/leaderboard") : Promise.resolve([]),
    [section, id], [],
  );
  const attendance = events.filter(
    (e) => e.attendanceConfirmed || e.attendanceBy?.includes(id),
  );
  const loading = USE_MOCK ? countsLoading || eventsLoading || reportsLoading : contributionsLoading;
  const error = USE_MOCK ? countsError || eventsError || reportsError : contributionsError;
  const ready = !loading && !error;
  const points = USE_MOCK ? ready && counts ? counts.counted + attendance.length * 5 : null : ready ? contributions?.points ?? null : null;
  const counted = ready ? (USE_MOCK ? counts?.counted : contributions?.countedReports) ?? "—" : "—";
  const attendanceCount = USE_MOCK ? attendance.length : contributions?.recordedAttendances ?? 0;
  const contributionSummary = loading ? "Loading contributions…" : error ? "Contributions unavailable" : `${attendanceCount} recorded attendance at recorded cleanups · ${counted} counted reports`;
  const loadError = error ? (
    <DataUnavailable title="Couldn’t Load Contributions" retry={() => { if (USE_MOCK) { void refreshCounts(); void refreshEvents(); void refreshReports(); } else void refreshContributions(); }}>Please try again.</DataUnavailable>
  ) : null;
  const [previewProfile, setPreviewProfile] = useState(() => USE_MOCK ? readPreviewProfile(id) : { nickname: "", joinedLeaderboard: false });
  const profile = USE_MOCK ? previewProfile : liveProfile ?? { nickname: "", joinedLeaderboard: false };
  const [nickname, setNickname] = useState(profile.nickname);
  useEffect(() => { if (!USE_MOCK && liveProfile) setNickname(liveProfile.nickname); }, [liveProfile]);
  const [validation, setValidation] = useState("");
  const [saving, setSaving] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const recoveryToken = storedRecoveryToken();
  async function save(join?: boolean) {
    if (nickname.trim() && !validNickname(nickname)) {
      setValidation(
        "Use 3–30 characters. Don’t use an email address or phone number.",
      );
      return;
    }
    const next = {
      nickname: nickname.trim(),
      joinedLeaderboard: join ?? profile.joinedLeaderboard,
    };
    setSaving(true);
    try {
      if (USE_MOCK) {
        savePreviewProfile(id, next);
        setPreviewProfile(next);
      } else {
        const saved = await apiRequest<Profile>("/profile", "PATCH", join === undefined ? { nickname: next.nickname } : next);
        setLiveProfile(saved);
        if (join !== undefined) await refreshLeaderboard();
      }
      setValidation("");
      showToast(USE_MOCK ? "Saved on this device" : "Profile saved");
      if (join === undefined) nav("/account");
    } catch (reason) {
      setValidation(USE_MOCK ? "Could not save on this device. Please enable browser storage." : reason instanceof Error ? reason.message : "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  async function leaveLeaderboard() {
    setSaving(true);
    try {
      if (USE_MOCK) {
        const next = { ...profile, joinedLeaderboard: false };
        savePreviewProfile(id, next);
        setPreviewProfile(next);
      } else {
        setLiveProfile(await apiRequest<Profile>("/profile", "PATCH", { joinedLeaderboard: false }));
        await refreshLeaderboard();
      }
      setValidation("");
      showToast("Leaderboard participation turned off");
    } catch (reason) {
      setValidation(reason instanceof Error ? reason.message : "Could not save your preference.");
    } finally {
      setSaving(false);
    }
  }
  const profileFailure = profileError ? <DataUnavailable title="Could not load your profile" retry={() => void refreshProfile()}>{profileError}</DataUnavailable> : null;
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
        {!USE_MOCK && profileLoading ? <Skeleton h={160} /> : profileError ? profileFailure : (
          <>
            {nicknameInput}
            <PrimaryButton disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save Nickname"}</PrimaryButton>
            {USE_MOCK && <p className="demo-label">Preview · saved only on this device</p>}
          </>
        )}
      </CoastalPage>
    );
  if (section === "history")
    return (
      <CoastalPage title="Contribution History" back="/account">
        <SummaryCard
          eyebrow={USE_MOCK ? "Your Points · Preview" : "Your Contributions"}
          value={points ?? "—"}
          description="points"
        >
          <p className="account-divider">
            {contributionSummary}
          </p>
        </SummaryCard>
        {loading ? <Skeleton h={160} /> : loadError}
        {ready && !USE_MOCK && contributions?.history.map((entry, index) => (
          <WhiteCard key={`${entry.kind}-${entry.reportId ?? entry.eventId ?? index}`}>
            <LinkRow
              title={entry.kind === "report" ? "Counted report" : "Recorded attendance"}
              subtitle={entry.beachName + " · " + formatDate(entry.createdAt)}
              trailing={<b>+{entry.points}</b>}
              onClick={() => { if (entry.reportId) nav("/reports/" + entry.reportId); else if (entry.eventId) nav("/events/" + entry.eventId); }}
            />
          </WhiteCard>
        ))}
        {ready && USE_MOCK && attendance.map((e) => (
          <WhiteCard key={e.id}>
            <LinkRow
              title="Recorded attendance"
              subtitle={e.beachName + " · " + formatDate(e.date)}
              trailing={USE_MOCK ? <b>+5</b> : undefined}
              onClick={() => nav("/events/" + e.id)}
            />
          </WhiteCard>
        ))}
        {ready && USE_MOCK && reports
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
        {ready && (USE_MOCK ? !attendance.length && !reports.some((r) => r.status === "Counted") : !contributions?.history.length) && (
          <DataUnavailable title="Your History Starts Here">
            Counted reports and recorded attendance will appear here.
          </DataUnavailable>
        )}
        <p className="coastal-footnote">
          Duplicate and incomplete reports are not included. Attendance earns points once the event has a recorded cleanup.{" "}
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
        {loadError}
        {!USE_MOCK && profileLoading ? <Skeleton h={160} /> : profileError ? profileFailure : profile.joinedLeaderboard ? (
          <>
            <SummaryCard
              eyebrow={USE_MOCK ? "Your Preview Profile" : "Your Profile"}
              description={profile.nickname || `Volunteer ${id}`}
              value={points ?? "—"}
            >
              <p className="account-divider">
                points{USE_MOCK ? " · personal rank not calculated" : ""}
              </p>
            </SummaryCard>
            {!USE_MOCK && leaderboardLoading ? <Skeleton h={160} /> : !USE_MOCK && leaderboardError ? (
              <DataUnavailable title="Could not load the leaderboard" retry={() => void refreshLeaderboard()}>{leaderboardError}</DataUnavailable>
            ) : <WhiteCard>
              {(USE_MOCK ? TOP.map(([name, value], i) => ({ rank: i + 1, nickname: String(name), points: Number(value) })) : leaderboard).map((row) => (
                <div className="leaderboard-row" key={row.nickname}>
                  <span>#{row.rank}</span>
                  <strong>{row.nickname}</strong>
                  <span>{row.points}</span>
                </div>
              ))}
              {!USE_MOCK && !leaderboard.length && <p className="subtle">No participants have joined the leaderboard yet.</p>}
            </WhiteCard>}
            {USE_MOCK && <p className="demo-label">Example leaderboard · as of 27-09-2026</p>}
            {validation && <p role="alert" className="coastal-footnote">{validation}</p>}
            <GhostButton
              disabled={saving}
              onClick={() => void leaveLeaderboard()}
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
                  {nickname || `Volunteer ${id}`}
                </strong>
                <span style={{ color: "#b8ff36" }}>{points ?? "—"} pts</span>
              </div>
            </SummaryCard>
            <PrimaryButton disabled={saving} onClick={() => void save(true)}>
              {saving ? "Saving…" : "Join Leaderboard"}
            </PrimaryButton>
            {USE_MOCK && <p className="demo-label">
              Preview · this choice stays on your device
            </p>}
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
            <p className="eyebrow">Points</p>
            <strong>
              {points ?? "—"}
            </strong>
          </div>
        </div>
        <p className="account-divider">
          {contributionSummary}
        </p>
      </SummaryCard>
      {loadError}
      {profileFailure}
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
