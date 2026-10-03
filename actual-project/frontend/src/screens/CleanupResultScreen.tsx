import { useNavigate, useParams } from "react-router-dom";
import {
  CoastalPage,
  DataUnavailable,
  WhiteCard,
} from "../components/CoastalUI";
import { Check } from "../components/Icon";
import { GhostButton, PrimaryButton, Skeleton } from "../components/ui";
import { cleanupDoneDestination } from "../cleanupFlow";
import { fetchCleanup } from "../iteration2Api";
import { useAsyncData } from "../useAsyncData";
export default function CleanupResultScreen() {
  const { cleanupId = "" } = useParams();
  const nav = useNavigate();
  const {
    data: cleanup,
    loading,
    error,
    refresh,
  } = useAsyncData(() => fetchCleanup(cleanupId), [cleanupId], null);
  if (loading)
    return (
      <CoastalPage title="Cleanup Recorded" back="/home" backMode="destination" tabs={false}>
        <Skeleton h={240} />
      </CoastalPage>
    );
  if (!cleanup)
    return (
      <CoastalPage title="Cleanup" back="/home" backMode="destination" tabs={false}>
        <DataUnavailable title="Cleanup result not found" retry={error ? () => void refresh() : undefined}>
          {error}
        </DataUnavailable>
      </CoastalPage>
    );
  return (
    <CoastalPage back={cleanupDoneDestination(cleanup.eventId)} backMode="destination" tabs={false}>
      <div style={{ textAlign: "center", padding: "14px 0" }}>
        <span
          style={{
            width: 68,
            height: 68,
            display: "grid",
            placeItems: "center",
            background: "#177a3e",
            borderRadius: "50%",
            margin: "0 auto 20px",
          }}
        >
          <Check color="white" size={32} />
        </span>
        <h1>Cleanup Recorded</h1>
        <p className="subtle">{cleanup.beachName}</p>
      </div>
      <WhiteCard>
        <p className="eyebrow">What changed</p>
        {cleanup.rows.map((row) => (
          <div key={row.category}>
            <h2 style={{ fontSize: 19 }}>{row.category}</h2>
            <div className="band-comparison">
              <div>
                <small>Before</small>
                <span className="band-pill">{row.beforeBand ?? "—"}</span>
              </div>
              <span>→</span>
              <div>
                <small>After cleanup</small>
                <span className="band-pill after">
                  {row.afterBand ?? row.removedBand ?? "—"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </WhiteCard>
      <WhiteCard>
        <h3>What this means</h3>
        <p className="subtle">
          Your cleanup is recorded. The remaining amount updates the linked
          report. A later report helps track changes in beach condition.
        </p>
        <p className="coastal-footnote">
          These records do not prove the beach is clean.
        </p>
      </WhiteCard>
      <PrimaryButton
        onClick={() => nav("/beach/" + encodeURIComponent(cleanup.beachId), { replace: true })}
        trailingArrow
      >
        View Beach
      </PrimaryButton>
      <GhostButton onClick={() => nav(cleanupDoneDestination(cleanup.eventId), { replace: true })}>
        Done
      </GhostButton>
    </CoastalPage>
  );
}
