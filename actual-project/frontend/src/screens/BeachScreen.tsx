// One beach in full: the litter status, what the litter is made of, how the
// band was worked out, and what lives nearby.
//
// The order of the page is an argument. Status first, because that is why the
// user came. Then the evidence, then the method, then the wildlife that makes
// litter matter, and last the report button - by then the user has a reason.
//
// Litter data and biodiversity data are kept visibly apart all the way down.
// Volunteers measure one; the other is reference and modelled context. Mixing
// them would let a species score be read as something seen on this beach.
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { getBeach, getSpeciesDistribution, USE_MOCK } from '../api';
import { BeachCover } from '../components/BeachCover';
import { Camera, Check, ChevronRight, Clock, Info, SpeciesIcon } from '../components/Icon';
import { BackButton, GhostButton, Label, PrimaryButton, Skeleton } from '../components/ui';
import { attentionStateFor, C, formatDate, freshnessLabel, freshStyle, MONO, NOISE, reportWord, SEVERITY, severityLabel } from '../theme';
import { BandMeter, Callout, GlassPanel, InfoChip } from '../components/ds';
import { useApp } from '../AppContext';
import type { BeachDetail, SpeciesDistributionResult } from '../types';
import { hasDraftProgress, resumePath } from '../flowRules';
import { getCleanupTarget, getLatestCleanupForBeach, type CleanupAction, type CleanupTarget } from '../iteration2';
import { MODEL_SPECIES_MEDIA } from '../speciesMedia';
import { litterGalleryPath } from '../litterGallery';
import { EcologicalBackgroundLink } from '../components/EcologicalBackgroundLink';

/*
 * relativeOccurrenceScore is shown exactly as the API sends it, on a 0..1 scale.
 * That is what AC5.5.1 asks for, and the User Story Map was updated to say so.
 *
 * Do not "fix" this into a percentage. A previous version multiplied by 100 to
 * print "12 / 100"; the AC was settled the other way, so the raw value stands.
 */

// Bar colours for the composition rows. They only separate one row from the
// next - they carry no meaning, which is why they are deliberately NOT the four
// severity colours. Reusing those would suggest that a row is "severe".
const COMP_COLORS = ['#B8FF36', '#2C4A8C', '#5470A8', '#7A879B', '#98A4B5', '#CBD3E0'];

type RuntimeCompositionSource = {
  method?: 'yolo' | 'reported_quantity_estimate' | 'active_report_estimate';
  createdAt?: string;
  activeReportCount?: number;
  windowDays?: number;
};

export default function BeachScreen() {
  const { beachId = '' } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  // "Learn More" on the map's biodiversity layer asks for the species cards,
  // not the top of the page, so it arrives with focus: 'species'.
  const speciesRef = useRef<HTMLDivElement | null>(null);
  const { user, draft, resetDraft, patchDraft, setLastSavedReport } = useApp();
  const [b, setB] = useState<BeachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [modelResult, setModelResult] = useState<SpeciesDistributionResult | null>(null);
  const [latestCleanup, setLatestCleanup] = useState<CleanupAction | null>(null);
  const [cleanupTarget, setCleanupTarget] = useState<CleanupTarget | null>(null);

  // beachId is in the dependency list, so moving between beaches refetches.
  // Without it React would show the previous beach under the new name. Model
  // state is cleared on the same pass, and the model call is kept separate from
  // the beach call so a model failure never takes the whole page down.
  useEffect(() => {
    setLoading(true);
    setModelResult(null);
    getBeach(beachId)
      .then((data) => {
        setB(data);
        if (!USE_MOCK) {
          getSpeciesDistribution(data.lat, data.lng)
            .then(setModelResult)
            .catch(() => setModelResult(null));
        }
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [beachId]);

  useEffect(() => {
    let active = true;
    Promise.all([getLatestCleanupForBeach(beachId), getCleanupTarget(beachId)]).then(([cleanup, target]) => {
      if (!active) return;
      setLatestCleanup(cleanup);
      setCleanupTarget(target);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [beachId]);

  // Scroll once the beach has loaded - before that the section does not exist
  // yet. scrollIntoView is skipped for anyone who has asked for reduced motion.
  useEffect(() => {
    if (!b || (location.state as { focus?: string } | null)?.focus !== 'species') return;
    const target = speciesRef.current;
    if (!target) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }, [b, location.state]);

  // Reporting from this page pre-fills the beach and its name, so the user
  // skips the location step for a beach they are already looking at.
  //
  // An unfinished draft is never thrown away without asking. If one exists the
  // user is offered it back, and Resume returns them to the furthest step they
  // had reached. Choosing Cancel starts a new report instead, which also has to
  // clear the last saved report: while that value is set the report routes send
  // the user to /reports, so a new report would bounce straight out of the flow
  // if it were left behind.
  const startReport = () => {
    if (hasDraftProgress(draft)) {
      if (window.confirm('Resume your unfinished report? Choose Cancel to start a new report.')) {
        nav(resumePath(draft));
        return;
      }
    }
    resetDraft();
    setLastSavedReport(null);
    patchDraft({ beachId, beachName: b?.name ?? null });
    nav(user ? '/report/photo' : `/identity?next=${encodeURIComponent('/report/photo')}`);
  };

  // Early return for loading and failure. The back button is rendered in BOTH
  // states: a user who reaches a beach that will not load must still be able to
  // leave without the browser's back button.
  if (loading || !b) {
    return (
      <div className="screen scroll-y" style={{ zIndex: 20 }}>
        <div className="pt-page measure" style={{ paddingInline: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <BackButton onClick={() => nav(-1)} />
          {failed ? (
            <div style={{ color: C.red, fontSize: 14 }}>Could not load this beach.</div>
          ) : (
            <>
              <Skeleton h={240} r={24} />
              <Skeleton h={120} r={24} />
              <Skeleton h={200} r={24} />
            </>
          )}
        </div>
      </div>
    );
  }

  // One shared helper decides whether a beach has earned a band, so this page,
  // the home list, the map markers and the confirm screen all draw that line in
  // the same place. sev stays null unless the helper agrees there is a band, so
  // a severity value that arrives with too few reports behind it still cannot
  // be shown as one.
  const attention = attentionStateFor(b.severity, b.insufficientData, b.validReports);
  const sev = attention.hasBand && b.severity ? SEVERITY[b.severity] : null;
  const fs = freshStyle(b.freshnessKind);
  // Scientific name is the only id a species card and a model prediction share.
  const modelByScientificName = new Map(
    (modelResult?.predictions ?? []).map((prediction) => [prediction.scientificName, prediction]),
  );
  const compositionSource = b.compositionSource as unknown as RuntimeCompositionSource | null;
  const activeComposition = compositionSource?.method === 'active_report_estimate';

  return (
    <div className="screen scroll-y" style={{ zIndex: 20 }}>

      <BeachCover coverImageUrl={b.coverImageUrl} scene={b.scene} alt={b.name} style={{ height: 300 }}>
        {/* The cover is a real photo when the backend has one. When it does
            not, the gradient the backend sends is used instead, so a beach
            looks the same everywhere in the app rather than getting a random
            placeholder per screen. The noise layer only goes on that gradient. */}
        {!b.coverImageUrl && (
          <div style={{ position: 'absolute', inset: 0, opacity: 0.32, backgroundImage: NOISE }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(9,24,52,.35) 0%,transparent 30%,transparent 52%,rgba(9,22,48,.72) 100%)' }} />
        <BackButton dark onClick={() => nav(-1)} style={{ position: 'absolute', top: 'var(--top-inset)', left: 18, zIndex: 5 }} />

        {/* The title follows the reading column. On a wide window without this
            it would sit hard against the left edge while the content it
            introduces sits in the middle of the screen, hundreds of pixels
            away. The back button above is chrome and stays at the edge. */}
        <div className="measure" style={{ position: 'absolute', left: 20, right: 20, bottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.2em', color: 'rgba(9,26,64,.8)', marginBottom: 8 }}>
            WEST COAST · {b.habitatTag}
          </div>
          <div style={{ fontSize: 33, fontWeight: 650, letterSpacing: '-.8px', color: C.bg, lineHeight: 1.05 }}>
            {b.name}
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(232,238,245,.8)', marginTop: 5 }}>
            {b.area} · Malaysia
          </div>
        </div>
      </BeachCover>



      {/* The status card, pulled up over the cover photo by the negative top
          margin. The width is set with calc() rather than the .measure class,
          because this card's 16px side margins are written inline and inline
          styles beat a stylesheet. On a phone calc(100% - 32px) is exactly the
          width it had before, so the phone layout did not change. */}
      <GlassPanel
        style={{
          margin: '-40px auto 0',
          width: 'calc(100% - 32px)',
          maxWidth: 'var(--measure)',
          position: 'relative',
          padding: 18,
        }}
      >
        {/* wrap, and let the left block shrink. "MODERATE" is the widest band
            word we render - 163px against HIGH's 76px, wider even than
            "VERY HIGH" - and next to a long freshness chip it used to push the
            chip column past the right edge of the phone, clipping "6 counted
            reports" to "6 counted repor". Wrapping drops the chips onto their
            own row instead of overflowing; minWidth 0 lets the band block give
            way first, because a flex item will not shrink below its content
            without it. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', rowGap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.muted }}>
              LITTER STATUS
            </div>
            {/* A band, or an honest refusal to give one. Never a default and
                never a zero - both would read as "this beach is fine". The
                words of the refusal come from the shared helper, so this page
                and the map explain the gap in the same terms. */}
            {sev ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <div style={{ fontSize: 29, fontWeight: 750, letterSpacing: '.02em', color: sev.text }}>
                  {b.severity ? severityLabel(b.severity).toUpperCase() : null}
                </div>
                <BandMeter
                  level={(b.band ?? 0) as 0 | 1 | 2 | 3 | 4}
                  tone={b.severity?.toLowerCase() as 'low' | 'moderate' | 'high' | 'severe' | undefined}
                  style={{ paddingBottom: 4 }}
                />
              </div>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.2px', color: C.muted, marginTop: 6 }}>
                  {attention.pageLabel}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: C.muted, marginTop: 5, maxWidth: 250 }}>
                  {attention.detail}
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <InfoChip>
              {/* A tick only once the reports add up to a band. Beside a count
                  too small to band, the same tick would read as approval of a
                  beach nobody has measured enough. */}
              {attention.hasBand ? (
                <Check size={11} color={C.slate} strokeWidth={2.2} />
              ) : (
                <Info size={11} color={C.slate} strokeWidth={2.2} />
              )}
              {b.validReports} active {reportWord(b.validReports)}
            </InfoChip>
            {/* The raw attention score is deliberately NOT shown. Epic 4's
                call: the public sees the band, not the number behind it. The
                value still arrives on BeachDetail and /method still publishes
                the whole rule, so the arithmetic is still checkable - you just
                cannot read one beach's score off its own page. No acceptance
                criterion asks for the number: AC4.1.2 asks for the band,
                AC4.2.4 lists count, date and freshness as the evidence
                context, and AC4.3.2 asks for the rule to be documented. Do not
                re-add this chip without asking Epic 4. */}
            <InfoChip color={fs.c} background={fs.bg}>
              <i style={{ width: 6, height: 6, borderRadius: 3, background: fs.dot, display: 'block' }} />
              {freshnessLabel(b.freshnessKind, b.lastReportedAt)}
            </InfoChip>
          </div>
        </div>

        {/* 'stale' covers two different situations (API.md section 4): nothing
            in 90 days, and never reported at all. They need different
            sentences. Without the split, a beach nobody has ever reported would
            be told how old its most recent report is - a report that does not
            exist. */}
        {b.freshnessKind === 'stale' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: '11px 13px', borderRadius: 16, background: 'rgba(30,36,44,.05)', border: '1px solid rgba(30,36,44,.12)' }}>
            <Clock style={{ flex: 'none', marginTop: 1 }} />
            <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: C.muted }}>

              {b.lastReportedAt
                ? 'Last reported over 90 days ago. That means unchecked, not clean.'
                : 'No counted report yet. That means unchecked, not clean.'}
            </div>
          </div>
        )}
      </GlassPanel>

      <div className="measure" style={{ padding: '20px 16px calc(var(--safe-bottom) + 36px)', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {cleanupTarget && (
          <div className="i2-card">
            <Label style={{ marginBottom: 8 }}>CLEANUP CHECK</Label>
            <div style={{ fontSize: 17, fontWeight: 680, color: C.ink2 }}>Does this litter need clearing?</div>
            <div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.5, color: C.muted }}>
              If you removed any of it, record what changed.
            </div>
            <div style={{ marginTop: 9, fontFamily: MONO, fontSize: 9, color: C.dim }}>
              REPORT {cleanupTarget.reportId.toUpperCase()} · ACTIVE BAND STATE
            </div>
            <PrimaryButton onClick={() => nav(user ? `/cleanup/${beachId}` : `/identity?next=${encodeURIComponent(`/cleanup/${beachId}`)}`)} style={{ marginTop: 13 }}>
              <span>Add a Cleanup</span>
              <small style={{ marginLeft: 6, fontSize: '0.72em', fontWeight: 500 }}>(commit to cleaning it)</small>
              <ChevronRight size={13} color={C.lime} />
            </PrimaryButton>
          </div>
        )}

        <div>
          <Label style={{ marginBottom: 12 }}>LITTER COMPOSITION</Label>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: C.muted, margin: '-4px 0 12px' }}>
            {activeComposition
              ? `Current unresolved litter · ${compositionSource?.activeReportCount ?? b.validReports} active ${reportWord(compositionSource?.activeReportCount ?? b.validReports)} · last ${compositionSource?.windowDays ?? 90} days`
              : compositionSource?.method === 'yolo'
                ? 'Latest report photo · YOLO + backend percentages'
                : 'Latest report · backend percentage estimate'}
          </div>
          {/* Current unresolved composition uses the same active Counted report
              set as Beach Attention. Linked cleanups apply the submitted remaining
              bands; resolved targets disappear from the active estimate while
              historical reports remain available. */}
          {b.composition ? (
            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {b.composition.map((c, i) => (
                <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 88, flex: 'none', fontSize: 12.5, fontWeight: 620, color: C.ink2 }}>
                    {c.category}
                  </span>
                  <div style={{ flex: 1, height: 14, borderRadius: 7, background: 'rgba(11,33,97,.05)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(100, c.percentage))}%`,
                        height: '100%',
                        borderRadius: 7,
                        background: COMP_COLORS[i % COMP_COLORS.length],
                      }}
                    />
                  </div>
                  <span style={{ width: 44, flex: 'none', textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.ink2 }}>
                    {c.percentage}%
                  </span>
                </div>
              ))}
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.1em', color: C.faint, marginTop: 4 }}>
                {activeComposition
                  ? 'ACTIVE COUNTED REPORTS · AFTER LINKED CLEANUPS'
                  : compositionSource?.createdAt
                    ? `REPORT ${formatDate(compositionSource.createdAt).toUpperCase()} · ${compositionSource.method === 'yolo' ? 'YOLO + BACKEND' : 'BACKEND ESTIMATE'}`
                    : 'BACKEND CALCULATED'}
              </div>
            </div>
          ) : (
            /* No active unresolved report. A dashed empty box, not a chart of
               zeroes: an empty chart still looks like a measurement. */
            <div style={{ border: '1.5px dashed rgba(11,33,97,.18)', borderRadius: 24, padding: 22, textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 640, color: C.muted }}>
                No active unresolved litter report
              </div>

            </div>
          )}
        </div>

        {latestCleanup && (
          <Callout title="Cleanup recorded — awaiting follow-up" tone="reassurance" icon={<Check color={C.green} />}>
            Cleanup recorded on {formatDate(latestCleanup.createdAt)}. A new report will confirm the change.
          </Callout>
        )}


        {/* The whole card is the link. It carries the three lines that matter
            most from the method, with a way through to the full page: somebody
            who has just read a band about their own beach should not have to go
            looking for how it was calculated. */}
        <button
          type="button"
          onClick={() => nav('/method')}
          className="press"
          style={{
            background: C.deep,
            borderRadius: 24,
            padding: 20,
            color: C.bg,
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', border: '1px solid rgba(184,255,54,.15)' }} />
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.dim }}>
            HOW THIS BAND IS CALCULATED
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 650, marginTop: 9 }}>One consistent 90-day rule</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 13, paddingTop: 11 }}>

            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 650, color: C.lime, whiteSpace: 'nowrap' }}>
              Full method <ChevronRight size={12} color={C.lime} strokeWidth={2.4} />
            </span>
          </div>
        </button>


        <div ref={speciesRef} id="species-model">
          <Label style={{ marginBottom: 12 }}>BIODIVERSITY NEAR THIS BEACH</Label>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.muted, margin: '-4px 0 12px' }}>
            Habitat · {b.habitat}
          </div>
          <div
            className="scroll-x"
            style={{
              display: 'flex',
              gap: 12,
              paddingBottom: 6,
              margin: '0 -16px',
              paddingLeft: 16,
              paddingRight: 16,
              scrollSnapType: 'x proximity',
            }}
          >
            {MODEL_SPECIES_MEDIA.map((species) => {
              const prediction = modelByScientificName.get(species.scientificName);
              return (
                <article
                  key={species.scientificName}
                  style={{
                    width: 226,
                    flex: 'none',
                    background: C.white,
                    border: `1px solid ${C.line}`,
                    borderRadius: 22,
                    overflow: 'hidden',
                    scrollSnapAlign: 'start',
                    boxShadow: '0 10px 26px -24px rgba(11,33,97,.7)',
                  }}
                >
                  <div style={{ height: 132, position: 'relative', overflow: 'hidden', background: b.scene }}>
                    <img
                      src={species.imageUrl}
                      alt={species.imageAlt}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        objectFit: 'cover',
                        objectPosition: species.imageObjectPosition ?? 'center',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg,transparent 48%,rgba(7,22,50,.66) 100%)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        right: 10,
                        bottom: 10,
                        minHeight: 26,
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '5px 9px',
                        borderRadius: 999,
                        background: 'rgba(7,22,50,.82)',
                        color: C.bg,
                        fontFamily: MONO,
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {prediction ? `RELATIVE SCORE ${prediction.relativeOccurrenceScore}` : 'SCORE PENDING'}
                    </div>
                  </div>
                  <div style={{ padding: '14px 14px 15px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <div
                        aria-hidden="true"
                        style={{
                          width: 34,
                          height: 34,
                          flex: 'none',
                          borderRadius: 17,
                          background: C.tint,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <SpeciesIcon glyph={species.glyph} />
                      </div>
                      <div style={{ minWidth: 0, paddingTop: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 680, lineHeight: 1.25, color: C.ink2 }}>
                          {species.commonName}
                        </div>
                        <div style={{ fontSize: 11.5, fontStyle: 'italic', lineHeight: 1.35, color: C.dim, marginTop: 3 }}>
                          {species.scientificName}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, lineHeight: 1.45, color: C.muted, marginTop: 11 }}>
                      Photo:{' '}
                      <a
                        href={species.imageSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: C.slate, textDecoration: 'underline', textUnderlineOffset: 2 }}
                      >
                        {species.imageAuthor}
                      </a>
                      {' · '}
                      <a
                        href={species.imageLicenseUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: C.slate, textDecoration: 'underline', textUnderlineOffset: 2 }}
                      >
                        {species.imageLicense}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            Relative model scores · not probabilities or confirmed sightings · OBIS snapshot, CC BY-NC
          </div>

          <div style={{ marginTop: 16, background: C.tint, borderRadius: 20, padding: '16px 17px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.14em', color: C.slate }}>
              WHY LITTER MATTERS HERE
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.ink2, marginTop: 7 }}>
              {b.ecologicalNote}
            </div>
            <EcologicalBackgroundLink />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <PrimaryButton onClick={startReport}>
            <Camera size={16} strokeWidth={1.9} />
            Report Litter Here
          </PrimaryButton>
          <GhostButton onClick={() => nav(user ? `/cleanup/${beachId}` : `/identity?next=${encodeURIComponent(`/cleanup/${beachId}`)}`)}>
            <span>Add a Cleanup</span>
            <small style={{ marginLeft: 6, fontSize: '0.72em', fontWeight: 500 }}>(commit to cleaning it)</small>
          </GhostButton>
          <GhostButton onClick={() => nav(litterGalleryPath(beachId))}>Litter Gallery</GhostButton>
          <GhostButton onClick={() => nav('/community')}>Community Cleanups</GhostButton>
          <GhostButton onClick={() => nav('/map')}>Back to Map</GhostButton>
        </div>
      </div>
    </div>
  );
}