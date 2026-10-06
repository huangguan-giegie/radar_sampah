import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getBeach, USE_MOCK } from "../api";
import content from "../content/coastalContent.json";
import { useApp } from "../AppContext";
import { useAsyncData } from "../useAsyncData";
import {
  fetchCleanupEvents,
  fetchLatestCleanupForBeach,
} from "../iteration2Api";
import { getLitterGallery, litterGalleryPhotoUrl } from "../litterGallery";
import {
  BackButton,
  DraftChoiceDialog,
  GhostButton,
  Skeleton,
} from "../components/ui";
import {
  CoastalPage,
  DataUnavailable,
  LinkRow,
  SectionHeading,
  Sheet,
  SummaryCard,
  WhiteCard,
} from "../components/CoastalUI";
import { SpeciesPicture } from "../components/SpeciesPicture";
import { ConservationCards } from "../components/ConservationCards";
import { attentionStateFor, formatDate, SEVERITY, severityLabel } from "../theme";
import { hasDraftProgress, resumePath } from "../flowRules";
import { compositionFooter } from "./BeachScreen";
import { BandMeter } from "../components/ds";
import { cleanupDestination } from "../cleanupFlow";
import type { SeverityBand } from "../types";
import { useAppBack } from "../navigation";
import { eventIsAvailable, useEventClock } from "../eventAvailability";
import { RecurrenceEvidence } from "../components/RecurrenceEvidence";
import { NearbyMarineSpecies } from "../components/NearbyMarineSpecies";

export default function CoastalBeachScreen() {
  const { beachId = "" } = useParams();
  const nav = useNavigate();
  const now = useEventClock();
  const [params] = useSearchParams();
  const fixture = content.beaches.find((b) => b.id === beachId);
  const goBack = useAppBack("/map" + (fixture?.region ? "?region=" + fixture.region : ""));
  const pilot = ["morib", "bagan", "remis", "kelanang"].includes(beachId);
  const previewOnly = USE_MOCK && !pilot;
  const {
    user,
    draft,
    resetDraft,
    patchDraft,
    setLastSavedReport,
    reportsVersion,
  } = useApp();
  const [draftChoice, setDraftChoice] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const {
    data: detail,
    loading,
    error,
    refresh,
  } = useAsyncData(
    () => (previewOnly ? Promise.resolve(null) : getBeach(beachId)),
    [beachId, reportsVersion],
    null,
  );
  const { data: gallery } = useAsyncData(
    () => (previewOnly ? Promise.resolve([]) : getLitterGallery(beachId)),
    [beachId, reportsVersion],
    [],
  );
  const { data: events } = useAsyncData(
    () => fetchCleanupEvents(user?.participantId),
    [user?.participantId, reportsVersion],
    [],
  );
  const { data: cleanup } = useAsyncData(
    () =>
      previewOnly ? Promise.resolve(null) : fetchLatestCleanupForBeach(beachId),
    [beachId, reportsVersion],
    null,
  );
  const b = detail ?? (previewOnly ? fixture : null);
  const event = events.find(
    (e) => e.beachId === beachId && eventIsAvailable(e, now),
  );
  const linkedEvent = params.get("event");
  const beginReport = () => {
    if (!b) return;
    resetDraft();
    setLastSavedReport(null);
    patchDraft({
      beachId,
      beachName: b.name,
      ...(linkedEvent &&
      events.some(
        (e) => e.id === linkedEvent && e.beachId === beachId && e.joined,
      )
        ? { linkedEventId: linkedEvent }
        : {}),
    });
    nav("/report/photo");
  };
  const startReport = () =>
    previewOnly
      ? setUnsupported(true)
      : hasDraftProgress(draft)
        ? setDraftChoice(true)
        : beginReport();
  if (loading)
    return (
      <CoastalPage back="/map" tabs={false}>
        <Skeleton h={220} />
        <Skeleton h={200} />
      </CoastalPage>
    );
  if (error || !b)
    return (
      <CoastalPage title="Beach" back="/map" tabs={false}>
        <DataUnavailable
          title={error ? "Could not load beach" : "Beach not found"}
          retry={error ? () => void refresh() : undefined}
        >
          {error ?? "Choose a beach from the map."}
        </DataUnavailable>
      </CoastalPage>
    );
  const band = b.severity as SeverityBand | null;
  const attention = attentionStateFor(
    band,
    detail?.insufficientData ?? !band,
    b.validReports,
  );
  const image = detail?.coverImageUrl ?? fixture?.image;
  const region = fixture?.region ?? "selangor";
  const species = (fixture?.species ?? [])
    .map((id) => content.species.find((s) => s.id === id))
    .filter((s) => !!s);
  const regional = content.regions.find((r) => r.id === region)?.records ?? [];
  const goMap = () => nav("/map?region=" + region);
  return (
    <main className="screen scroll-y coastal-screen">
      <header className="coastal-beach-hero">
        {image && <img src={image} alt={b.name} />}
        <div className="beach-hero-top">
          <BackButton dark onClick={goBack} />
          {image && fixture?.photoSource ? (
            <a href={fixture.photoSource} target="_blank" rel="noreferrer">
              {fixture.credit || "Photo source ↗"}
            </a>
          ) : (
            <span>
              {image ? fixture?.credit || b.name : "No photo of this beach yet"}
            </span>
          )}
        </div>
        <div>
          <h1>{b.name}</h1>
          <p>{b.area} · Malaysia</p>
        </div>
      </header>
      <div className="coastal-page measure beach-body">
        <section>
          <SectionHeading
            action="View All →"
            onAction={() => nav("/beach/" + beachId + "/gallery")}
          >
            Litter Gallery
          </SectionHeading>
          <p className="subtle">Public reports from this beach</p>
          {gallery.length ? (
            <div className="beach-gallery">
              {gallery.map((g) => (
                <button
                  key={g.reportId}
                  onClick={() => nav("/beach/" + beachId + "/gallery")}
                >
                  <img
                    src={litterGalleryPhotoUrl(g.photoUrl)}
                    alt="Reported beach litter"
                  />
                  <span>{formatDate(g.reportedAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dashed-empty">No public report photos yet.</div>
          )}
        </section>
        <WhiteCard>
          <div className="beach-band-header">
            <p className="eyebrow">Litter Severity</p>
            <small>{b.validReports} counted reports</small>
          </div>
          <div
            className="beach-band-value"
            style={{
              color:
                attention.hasBand && band ? SEVERITY[band].text : "#586070",
            }}
          >
            <strong>
              {attention.hasBand && band ? severityLabel(band).toUpperCase() : "Insufficient Data"}
            </strong>
            {attention.hasBand && band && (
              <BandMeter
                level={
                  (detail?.band ??
                    ["Low", "Moderate", "High", "Severe"].indexOf(band) + 1) as
                    0 | 1 | 2 | 3 | 4
                }
                tone={
                  band.toLowerCase() as "low" | "moderate" | "high" | "severe"
                }
              />
            )}
          </div>
          <p className="beach-freshness">
            ●{" "}
            {detail?.lastReportedAt
              ? "Reported " + formatDate(detail.lastReportedAt)
              : (fixture?.reported ?? "Not recently reported")}
          </p>
          {!attention.hasBand && (
            <p className="coastal-footnote">{attention.detail}</p>
          )}
          <button className="coastal-footnote" onClick={() => nav("/method")}>
            How it’s rated →
          </button>
        </WhiteCard>
        <SummaryCard eyebrow="What You Can Do Here">
          <LinkRow
            title="Report Litter Here"
            subtitle="Photo, beach and what you saw"
            onClick={startReport}
          />
          <LinkRow
            title="Join a Cleanup"
            subtitle={
              event
                ? "Contribute at an upcoming cleanup"
                : "No cleanup here yet · contribute at one nearby"
            }
            onClick={() => nav(event ? "/events/" + event.id : "/community")}
          />
          <LinkRow
            title="Log Your Cleanup"
            subtitle="Confirm what is left after cleaning"
            onClick={() =>
              previewOnly
                ? setUnsupported(true)
                : nav(cleanupDestination(beachId, linkedEvent))
            }
          />
        </SummaryCard>
        <section>
          <SectionHeading
            action="Species Guide →"
            onAction={() => nav("/marine-life")}
          >
            Marine Life & Habitat
          </SectionHeading>
          {(detail?.habitat || fixture?.habitat) && (
            <p className="subtle">
              Habitat · {detail?.habitat ?? fixture?.habitat}
            </p>
          )}
          <div className="coastal-grid-two" style={{ marginTop: 16 }}>
            {species.slice(0, 2).map((s) => (
              <button key={s.id} onClick={() => nav("/species/" + s.id)}>
                <SpeciesPicture image={s.image} name={s.name} />
                <strong>{s.name}</strong>
              </button>
            ))}
            {species.length < 2 &&
              regional
                .filter((r) => !species.some((s) => s.id === r.speciesId))
                .slice(0, 2 - species.length)
                .map((r, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      nav(
                        r.speciesId
                          ? "/species/" + r.speciesId
                          : "/marine-area/" + region + "?beach=" + beachId,
                      )
                    }
                  >
                    <SpeciesPicture image={r.image} name={r.name} />
                    <strong>{r.name}</strong>
                  </button>
                ))}
          </div>
          <div className="section-heading" style={{ marginTop: 12 }}>
            <p className="coastal-footnote">
              Regional examples · not sightings
            </p>
            <button
              onClick={() =>
                nav("/marine-area/" + region + "?beach=" + beachId)
              }
            >
              Sources ↗
            </button>
          </div>
        </section>
        <section id="species-model">
          <SectionHeading>Modelled Nearby Marine Species</SectionHeading>
          <NearbyMarineSpecies beach={{ id: beachId, lat: detail?.lat ?? null, lng: detail?.lng ?? null, scene: detail?.scene ?? "#edf2f8" }} />
        </section>
        {pilot && <ConservationCards beachId={beachId} />}
        <section>
          <SectionHeading>Litter Composition</SectionHeading>
          {detail?.composition?.length ? (
            <WhiteCard>
              {detail.composition.map((c, i) => (
                <div key={c.category} className="composition-row">
                  <div>
                    <span>{c.category}</span>
                    <strong>{Math.round(c.percentage)}%</strong>
                  </div>
                  <i>
                    <b
                      style={{
                        width: c.percentage + "%",
                        background: i === 0 ? "#b8ff36" : "#5470a8",
                      }}
                    />
                  </i>
                </div>
              ))}
              <p className="coastal-footnote">
                {compositionFooter(detail.compositionSource)}
              </p>
            </WhiteCard>
          ) : (
            <div className="dashed-empty">
              Shown once counted reports list litter types.
            </div>
          )}
        </section>
        {cleanup && (
          <WhiteCard>
            <p className="eyebrow">Latest Recorded Cleanup</p>
            <h2>{formatDate(cleanup.createdAt)}</h2>
            <p className="subtle">{detail?.cleanupStatus ?? cleanup.recurrence?.calloutStatus ?? cleanup.status}</p>
            <p className="subtle">
              A new counted report helps show what happened after the cleanup.
            </p>
            <button
              style={{ marginTop: 14 }}
              onClick={() => nav("/cleanup/result/" + cleanup.id)}
            >
              View Recorded Change →
            </button>
          </WhiteCard>
        )}
        <RecurrenceEvidence evidence={detail?.recurrence ?? cleanup?.recurrence} />
        <GhostButton onClick={goMap}>Back to Map</GhostButton>
        {USE_MOCK && <p className="demo-label">Preview · example data</p>}
      </div>
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
      {unsupported && (
        <Sheet
          title="Choose a Pilot Beach"
          onClose={() => setUnsupported(false)}
        >
          <p className="subtle">
            This beach is available to browse in the preview. Reporting and
            cleanup records are currently available for the four pilot beaches.
          </p>
          {content.beaches
            .filter((b) =>
              ["morib", "bagan", "remis", "kelanang"].includes(b.id),
            )
            .map((b) => (
              <LinkRow
                key={b.id}
                title={b.name}
                onClick={() => {
                  setUnsupported(false);
                  nav("/beach/" + b.id);
                }}
              />
            ))}
        </Sheet>
      )}
    </main>
  );
}
