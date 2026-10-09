import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getSpeciesCatalog } from "../api";
import { useAsyncData } from "../useAsyncData";
import { BackButton, GhostButton, PrimaryButton } from "../components/ui";
import { CoastalPage, DataUnavailable, WhiteCard } from "../components/CoastalUI";
import { mediaForScientificName } from "../speciesMedia";
import { speciesPhotoReference } from "../visuals";
import { findModelSpecies } from "../modelSpeciesNavigation";
import { useAppBack } from "../navigation";
import type { SpeciesCatalog } from "../types";

/**
 * An introductory guide for all 40 marine-distribution model taxa, including
 * those absent from the 38-entry published coastal guide.
 * Content is provided by the existing public species catalogue endpoint, not
 * fabricated from a score or claimed as a local observation.
 */
export default function ModelSpeciesScreen() {
  const { scientificKey } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const beachId = params.get("beach");
  const origin = beachId && /^[a-z0-9_-]{1,120}$/i.test(beachId) ? "/beach/" + encodeURIComponent(beachId) : "/marine-life";
  const goBack = useAppBack(origin);
  const { data, loading, error, refresh } = useAsyncData<SpeciesCatalog | null>(
    () => getSpeciesCatalog(),
    [],
    null,
  );
  const species = findModelSpecies(data, scientificKey);

  if (loading) return (
    <CoastalPage title="Species Introduction" subtitle="Loading species information…" back={origin} tabs={false}>
      <p role="status" className="subtle">Loading the published species catalogue…</p>
    </CoastalPage>
  );
  if (error) return (
    <CoastalPage title="Species Introduction" back={origin} tabs={false}>
      <DataUnavailable title="Species introduction could not be loaded" retry={() => void refresh()}>
        Please try again to load the reference sources.
      </DataUnavailable>
    </CoastalPage>
  );
  if (!species) return (
    <CoastalPage title="Species Introduction" back={origin} tabs={false}>
      <DataUnavailable title="Species not found">
        This species is not included in the packaged 40-species catalogue.
      </DataUnavailable>
    </CoastalPage>
  );

  const curated = mediaForScientificName(species.scientificName);
  const photo = speciesPhotoReference(species.commonNameEn);
  const imageUrl = curated?.imageUrl ?? photo?.image;
  const photoCreditsUrl = curated?.imageSourceUrl ?? photo?.creditsUrl;
  const years = species.recordYears;
  const recordYears = years?.min && years?.max ? (
    years.min === years.max ? String(years.min) : years.min + "–" + years.max
  ) : years?.min ?? years?.max ?? null;

  return (
    <main className="screen scroll-y coastal-screen">
      <div className="species-hero">
        {imageUrl ? (
          <img src={imageUrl} alt={species.commonNameEn + " · species reference photo, not a local sighting"} loading="eager" />
        ) : (
          <div className="species-placeholder" style={{ height: "100%" }}>Photo unavailable</div>
        )}
        <div className="back-overlay"><BackButton onClick={goBack} /></div>
      </div>
      <div className="coastal-page measure species-body" style={{ paddingBottom: 60 }}>
        <div>
          <p className="eyebrow">Marine Life · Species Introduction</p>
          <h1>{species.commonNameEn}</h1>
          <p className="subtle" style={{ fontStyle: "italic", marginTop: 6 }}>{species.scientificName}</p>
          <p className="coastal-footnote">Species reference photograph · not a confirmed sighting at this beach</p>
        </div>

        <WhiteCard>
          <h3>About this species</h3>
          <p style={{ fontSize: 15, lineHeight: 1.65, marginTop: 12 }}>{species.introEn}</p>
          {species.introZh && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer" }}>中文介绍</summary>
              <p style={{ lineHeight: 1.6, marginTop: 8 }}>{species.introZh}</p>
            </details>
          )}
        </WhiteCard>

        <WhiteCard>
          <h3>Evidence &amp; scope</h3>
          <p style={{ fontSize: 13, lineHeight: 1.65, marginTop: 10 }}>
            This guide describes a species in the OBIS-derived historical marine distribution model.
            Nearby marine-grid suggestions describe possible ecological context; they do not
            confirm this species was observed at the selected beach and are not occurrence probabilities.
          </p>
          {recordYears != null && (
            <p className="coastal-footnote">Historical source record years: {recordYears}</p>
          )}
          <p className="coastal-footnote">Species model: {data?.modelVersion} · {data?.modelCount} packaged species</p>
        </WhiteCard>

        <WhiteCard>
          <h3>Sources &amp; Photo Credit</h3>
          {(species.sources ?? []).map(source => (
            <a key={source.url} className="species-source" href={source.url} target="_blank" rel="noreferrer">
              {source.title} ↗
            </a>
          ))}
          {photoCreditsUrl && (
            <a className="species-source" href={photoCreditsUrl}
              target={photoCreditsUrl.startsWith("https://") ? "_blank" : undefined} rel="noreferrer">
              Species photograph source &amp; licence ↗
            </a>
          )}
          {curated && <p className="coastal-footnote">Photo: {curated.imageAuthor} · {curated.imageLicense}</p>}
          {photo && !curated && <p className="coastal-footnote">Photo: {photo.note} · photographer and licence on the linked source page</p>}
        </WhiteCard>

        <GhostButton onClick={() => nav("/community/wildlife-help")}>
          Hurt or stranded animal? Get help
        </GhostButton>
        <PrimaryButton onClick={goBack}>{beachId ? "Back to Beach" : "Back"}</PrimaryButton>
      </div>
    </main>
  );
}
