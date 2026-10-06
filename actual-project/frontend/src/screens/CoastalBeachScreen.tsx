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
import { attentionStateFor, daysAgo, formatDate, reportWord, SEVERITY, severityLabel } from "../theme";
import { hasDraftProgress, resumePath } from "../flowRules";
import { compositionFooter } from "./BeachScreen";
import { BandMeter } from "../components/ds";
import { cleanupDestination } from "../cleanupFlow";
import type { SeverityBand } from "../types";
import { useAppBack } from "../navigation";
import { eventIsAvailable, useEventClock } from "../eventAvailability";
import { RecurrenceEvidence } from "../components/RecurrenceEvidence";
import { NearbyMarineSpecies } from "../components/NearbyMarineSpecies";
import { beachReference } from "../beachReference";
import "../styles/home-map-alignment.css";

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
  const reference = beachReference(beachId);
  const newestCountedAt = detail?.newestCountedReportAt
    ?? detail?.latestContributingReportAt
    ?? detail?.lastReportedAt;
  const reportAge = daysAgo(newestCountedAt ?? null);
  const goMap = () => nav("/map?region=" + region);
  return (
    <main className="screen scroll-y coastal-screen beach-aligned">
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
        <button className="coastal-card beach-severity-card" onClick={() => nav("/method")} aria-label="How this litter band is rated">
          <div className="beach-band-header">
            <p className="eyebrow">Litter Severity</p>
            <small>{attention.hasBand ? "✓ " : "ⓘ "}{b.validReports} counted {reportWord(b.validReports)}</small>
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
            {newestCountedAt
              ? reportAge === 0 ? "Reported today" : "Reported " + reportAge + (reportAge === 1 ? " day ago" : " days ago")
              : (fixture?.reported ?? "Not recently reported")}
          </p>
          {!attention.hasBand && (
            <p className="coastal-footnote">{attention.detail}</p>
          )}
        </button>
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
            {reference?.cards.map((card) => (
              <button key={card.name} onClick={() => nav(card.speciesId
                ? "/species/" + card.speciesId
                : "/marine-area/" + region + "?beach=" + beachId)}>
                {card.image ? <SpeciesPicture image={card.image} name={card.name} />
                  : <div className="beach-reference-no-photo">No verified photo</div>}
                <strong>{card.name}</strong>
              </button>
            ))}
          </div>
          {reference?.caption && <p className="beach-local-record">{reference.caption}</p>}
          <div className="section-heading" style={{ marginTop: 12 }}>
            <p className="coastal-footnote">
              {reference?.caption ? "Examples · not sightings" : "Regional examples · not sightings"}
            </p>
            {reference?.source ? <a href={reference.source} target="_blank" rel="noreferrer">Sources ↗</a> : <button
              onClick={() =>
                nav("/marine-area/" + region + "?beach=" + beachId)
              }
            >
              Sources ↗
            </button>}
          </div>
        </section>
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
        <SummaryCard eyebrow="What You Can Do Here">
          <LinkRow title="Report Litter Here" subtitle="Photo, beach and what you saw" onClick={startReport} />
          <LinkRow title="Join a Cleanup" subtitle={event ? "Contribute at an upcoming cleanup" : "No cleanup here yet · contribute at one nearby"}
            onClick={() => nav(event ? "/events/" + event.id : "/community")} />
          <LinkRow title="Log Your Cleanup" subtitle="Confirm what is left after cleaning"
            onClick={() => previewOnly ? setUnsupported(true) : nav(cleanupDestination(beachId, linkedEvent))} />
        </SummaryCard>
        <RecurrenceEvidence evidence={detail?.recurrence ?? cleanup?.recurrence} />
        {cleanup && <LinkRow title="View Recorded Change" subtitle={formatDate(cleanup.createdAt)} onClick={() => nav("/cleanup/result/" + cleanup.id)} />}
        <GhostButton onClick={goMap}>Back to Map</GhostButton>
        <details className="beach-more-context" id="species-model">
          <summary>More marine context</summary>
          <SectionHeading>Modelled Nearby Marine Species</SectionHeading>
          <NearbyMarineSpecies beach={{ id: beachId, lat: detail?.lat ?? null, lng: detail?.lng ?? null, scene: detail?.scene ?? "#edf2f8" }} />
          {pilot && <ConservationCards beachId={beachId} />}
        </details>
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
