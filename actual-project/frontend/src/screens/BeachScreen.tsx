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
import { pendingSourceLabel } from '../sources';
import { BeachCover } from '../components/BeachCover';
import { Camera, Check, ChevronRight, Clock, Info, SpeciesIcon } from '../components/Icon';
import { BackButton, GhostButton, Label, PrimaryButton, Skeleton } from '../components/ui';
import { attentionStateFor, C, formatDate, freshnessLabel, freshStyle, MONO, NOISE, reportWord, SEVERITY, severityLabel } from '../theme';
import { BandMeter, GlassPanel, InfoChip } from '../components/ds';
import { useApp } from '../AppContext';
import type { BeachDetail, SpeciesDistributionResult } from '../types';
import { hasDraftProgress, resumePath } from '../flowRules';

// Bar colours for the composition rows. They only separate one row from the
// next - they carry no meaning, which is why they are deliberately NOT the four
// severity colours. Reusing those would suggest that a row is "severe".
const COMP_COLORS = ['#B8FF36', '#2C4A8C', '#5470A8', '#7A879B', '#98A4B5', '#CBD3E0'];

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
  const [modelFailed, setModelFailed] = useState(false);

  // beachId is in the dependency list, so moving between beaches refetches.
  // Without it React would show the previous beach under the new name. Model
  // state is cleared on the same pass, and the model call is kept separate from
  // the beach call so a model failure never takes the whole page down.
  useEffect(() => {
    setLoading(true);
    setModelResult(null);
    setModelFailed(false);
    getBeach(beachId)
      .then((data) => {
        setB(data);
        if (!USE_MOCK) {
          getSpeciesDistribution(data.lat, data.lng)
            .then(setModelResult)
            .catch(() => setModelFailed(true));
        }
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
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

  // Bar width comes from the quantity band, not from a percentage. There are
  // only four bands and they do not add up to 100 - drawing them as shares of a
  // whole would invent precision the data does not have.
  const BAND_WIDTH: Record<string, string> = {
    Small: '25%', Medium: '50%', Large: '75%', 'Very Large': '100%',
  };

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
              {b.validReports} counted {reportWord(b.validReports)}
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
                ? 'The most recent counted report is older than 90\u00a0days. Conditions may have changed in either direction.'
                : 'No counted report has ever been filed for this beach. That is missing evidence, not a finding.'}
            </div>
          </div>
        )}
      </GlassPanel>

      <div className="measure" style={{ padding: '20px 16px calc(var(--safe-bottom) + 36px)', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <div>
          <Label style={{ marginBottom: 12 }}>LITTER COMPOSITION</Label>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: C.muted, margin: '-4px 0 12px' }}>
            Latest reported litter categories and quantity bands. Litter status above uses the median of eligible reports from the last 90 days.
          </div>
          {/* What the litter is made of. This comes from the single most recent
              counted report, and that report's date is printed under the bars -
              so the user knows they are reading one day's observation, not an
              average over months. */}
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
                        width: BAND_WIDTH[c.quantity] ?? '25%',
                        height: '100%',
                        borderRadius: 7,
                        background: COMP_COLORS[i % COMP_COLORS.length],
                      }}
                    />
                  </div>
                  <span style={{ width: 62, flex: 'none', textAlign: 'right', fontFamily: MONO, fontSize: 9.5, color: C.muted }}>
                    {c.quantity}
                  </span>
                </div>
              ))}
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.1em', color: C.faint, marginTop: 4 }}>
                {b.compositionSource
                  ? `REPORT ${formatDate(b.compositionSource.createdAt).toUpperCase()} · BROAD CATEGORIES`
                  : 'BROAD CATEGORIES'}
              </div>
            </div>
          ) : (
            /* No counted report yet. A dashed empty box, not a chart of
               zeroes: an empty chart still looks like a measurement. */
            <div style={{ border: '1.5px dashed rgba(11,33,97,.18)', borderRadius: 24, padding: 22, textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 640, color: C.muted }}>
                No counted report yet
              </div>

            </div>
          )}
        </div>


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
          <div style={{ fontSize: 15.5, fontWeight: 650, marginTop: 9 }}>Same rule for every beach</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 11 }}>
            {[
              'Duplicates and incomplete reports are excluded.',
              'Each report uses the highest category score; the beach uses the median over 90 days.',
              'Four fixed bands: Low · Moderate · High · Very high.',
            ].map((t) => (
              <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.5, color: C.mist }}>
                <i style={{ width: 5, height: 5, borderRadius: 3, background: C.lime, display: 'block', flex: 'none', marginTop: 6 }} />
                {t}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 13, paddingTop: 11 }}>

            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 650, color: C.lime, whiteSpace: 'nowrap' }}>
              Full method <ChevronRight size={12} color={C.lime} strokeWidth={2.4} />
            </span>
          </div>
        </button>


        <div ref={speciesRef}>
          <Label style={{ marginBottom: 12 }}>BIODIVERSITY NEARBY · {b.habitat}</Label>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: C.muted, margin: '-4px 0 12px' }}>
            Contextual information only — it does not contribute to litter severity.
          </div>
          <div className="scroll-x" style={{ display: 'flex', gap: 12, paddingBottom: 6, margin: '0 -16px', paddingLeft: 16, paddingRight: 16 }}>
            {/* Biodiversity. A separate section with its own heading, its own
                colours and its own sources - it is context for why litter here
                matters, and never an input to the litter status. */}
            {b.species.map((sp) => (
              <div key={sp.name} style={{ width: 196, flex: 'none', background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden' }}>

                {/* The species' own photo, or just the gradient. This used to
                    fall back to the beach cover, which made every card on a
                    beach show the same picture - and each one read as "this is
                    what that animal looks like". */}
                <BeachCover coverImageUrl={sp.pictureUrl ?? null} scene={b.scene} style={{ height: 88 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,24,52,.25)' }} />
                  <div
                    style={{
                      position: 'absolute',
                      left: 14,
                      bottom: -16,
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      background: C.bg,
                      border: '1px solid rgba(11,33,97,.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 14px -6px rgba(14,30,64,.4)',
                    }}
                  >
                    <SpeciesIcon glyph={sp.glyph} />
                  </div>
                </BeachCover>
                <div style={{ padding: '24px 14px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 650, letterSpacing: '-.1px' }}>{sp.name}</div>
                  {sp.scientificName && (
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: C.dim, marginTop: 3 }}>
                      {sp.scientificName}
                      {sp.threatCategory ? ` · ${sp.threatCategory}` : ''}
                    </div>
                  )}
                  {/* Live model context, printed as a plain labelled line so it
                      is never mistaken for the card's sourced content. */}
                  {sp.scientificName && modelByScientificName.has(sp.scientificName) && (
                    <div style={{ marginTop: 7, fontFamily: MONO, fontSize: 8, letterSpacing: '.07em', color: '#855A10' }}>
                      MODELLED CONTEXT · RELATIVE SCORE {modelByScientificName.get(sp.scientificName)?.relativeOccurrenceScore}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, lineHeight: 1.5, color: C.muted, marginTop: 3 }}>{sp.text}</div>

                  {/* The occurrence box appears only once there is a score in
                      it. It used to render for 'pending' and 'unavailable' too,
                      and the basis text it printed comes straight from the API:
                      "Green sea turtle is one of the four modelled species.
                      Backend not connected yet." That is a sentence about our
                      wiring, shown on a public page to somebody who came to
                      look at a beach - and it is live on the deployed site,
                      because the real API returns it as well.

                      Static cards remain source-pending. The live model result is
                      shown in the separate contextual panel below, so a modelled
                      score is never mistaken for a sourced card or a severity band. */}
                  {sp.likelihood?.state === 'ready' && (

                    <div
                      style={{
                        marginTop: 10,
                        padding: '9px 10px',
                        borderRadius: 12,
                        background: 'rgba(154,106,20,.07)',
                        border: '1px dashed rgba(154,106,20,.32)',
                      }}
                    >
                      {/* Amber and dashed, never the severity colours and never
                          a bar: this is a different kind of measure. It is a
                          relative score rather than a probability, so no % sign
                          - the label says so and "/ 100" gives the scale. */}
                      <div style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: '.1em', color: '#855A10' }}>
                        RELATIVE OCCURRENCE SCORE · NOT A PROBABILITY
                      </div>
                      {sp.likelihood.score !== undefined && (
                        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 650, color: '#855A10', marginTop: 3 }}>
                          {sp.likelihood.score}
                          <span style={{ fontSize: 9, marginLeft: 4, letterSpacing: '.08em' }}>/ 100</span>
                        </div>
                      )}
                      <div style={{ fontSize: 10, lineHeight: 1.45, color: C.muted, marginTop: 3 }}>
                        {sp.likelihood.basis}
                      </div>
                    </div>
                  )}

                  {/* Show the gap when there is no real source yet. An amber
                      badge is embarrassing; an invented citation in a marked
                      assignment is misconduct. The wording comes from
                      sources.ts, because habitat and group cards are team
                      descriptions and were never coming from FishBase or OBIS -
                      calling those "source pending" promised a source that was
                      never going to arrive. */}
                  {sp.source.dataset === 'pending' ? (

                    <div
                      style={{
                        marginTop: 9,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(217,162,75,.14)',
                        border: '1px solid rgba(217,162,75,.35)',
                        borderRadius: 6,
                        padding: '4px 7px',
                        fontFamily: MONO,
                        fontSize: 7.5,
                        letterSpacing: '.08em',
                        color: '#8A6420',
                      }}
                    >
                      <i style={{ width: 4, height: 4, borderRadius: 2, background: '#D9A24B', display: 'block' }} />
                      {pendingSourceLabel(sp.kind)}
                    </div>
                  ) : (
                    /* The credit line, printed on every card. CC BY-NC requires
                       attribution and DMP section 9 requires the access date, so
                       both are shown rather than stored and forgotten. */
                    <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '.08em', color: C.faint, marginTop: 9, lineHeight: 1.5 }}>
                      SOURCE · {sp.source.citation}
                      {sp.source.accessedAt ? ` · accessed ${sp.source.accessedAt}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, background: C.tint, borderRadius: 20, padding: '16px 17px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.14em', color: C.slate }}>
              WHY LITTER MAY MATTER HERE
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.ink2, marginTop: 7 }}>
              {b.ecologicalNote}
            </div>
            {/* This line is the AC5.2.3 promise, so it is the last thing that
                should be hard to read. It used to be C.dim, which is 3.11:1 on
                this tint - under the 4.5:1 AA floor for text this size. C.muted
                measures 5.11:1 on the same background.

                The model sentence is ADDED to it, never swapped in for it: the
                beaches showing actual numbers must not be the ones that drop
                the warning that those numbers are not sightings.

                It now waits for state 'ready' rather than for the field to
                merely exist. The sentence is there to qualify a number, and
                until the model is connected there is no number on screen - so
                46 words describing how a score is built were sitting on a page
                that shows no score, on every beach that has a modelled species.
                When Su's output lands, the sentence comes back with it. */}
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
              Context only — never proof of current presence or of ecological recovery.
              {b.species.some((sp) => sp.likelihood?.state === 'ready') ? (
                <>
                  {' '}The relative occurrence score is built from OBIS records and background
                  samples at coordinate level. It is not a calibrated probability of presence,
                  never a confirmed sighting, and never a measure of litter severity or of
                  ecological recovery.
                </>
              ) : null}
            </div>
            {/* AC5.1.3 - the datasets and their licence, shown to the user
                rather than only recorded in the DMP.

                FUTURE TENSE, deliberately. The long form said "REFERENCE
                DATASETS · FISHBASE ... OBIS" in the present tense directly
                under three badges reading "NOT YET FROM FISHBASE / OBIS" - the
                same page asserting both that we use these datasets and that we
                do not. No extract has run, so "will come from" is the true one,
                and it stops contradicting the badges.

                It was also the least legible text on the page: 8.5px at C.faint
                is 2.16:1, less than half the AA floor, which is a strange way
                to satisfy a licence whose whole point is visible attribution.
                One line at 10px/C.muted measures 5.11:1.

                When the extract lands: switch to the present tense, restore the
                full citations from sources.ts, and bring back the
                NON_COMMERCIAL_NOTICE sentence about image copyright - there are
                no species images on these cards yet, so it currently warns
                about something that is not on screen. */}
            <div style={{ fontSize: 10, color: C.muted, marginTop: 10, lineHeight: 1.55 }}>
              Biodiversity cards are contextual; modelled occurrence uses a packaged OBIS snapshot · CC BY-NC, non-commercial academic use
            </div>
          </div>
        </div>

        {/* The model result on its own, apart from the sourced cards. Mock mode
            runs no model, so it says that outright instead of showing an empty
            panel or a simulated score. */}
        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, padding: '16px 17px' }}>
          <Label style={{ marginBottom: 9 }}>MODELLED SPECIES CONTEXT</Label>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: C.muted }}>
            {USE_MOCK
              ? 'The offline species model is not enabled in mock mode. No model result is being simulated.'
              : 'Packaged OBIS snapshot baseline for the beach broad-area coordinate. Context only — it does not contribute to litter severity.'}
          </div>
          {!USE_MOCK && modelResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {modelResult.predictions.map((prediction) => (
                <div key={prediction.speciesSlug} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: C.ink2 }}>
                  <span>{prediction.commonNameEn}</span>
                  <span style={{ fontFamily: MONO, color: '#855A10' }}>{prediction.relativeOccurrenceScore}</span>
                </div>
              ))}
              <div style={{ fontSize: 10.5, lineHeight: 1.45, color: C.muted, marginTop: 3 }}>
                Not a calibrated probability or a real-time OBIS query. Model version {modelResult.modelVersion}.
              </div>
            </div>
          )}
          {!USE_MOCK && !modelResult && (
            <div style={{ fontSize: 11, color: modelFailed ? C.muted : C.dim, marginTop: 10 }}>
              {modelFailed ? 'Model context is unavailable for this beach; the biodiversity cards remain contextual.' : 'Loading model context…'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <PrimaryButton onClick={startReport}>
            <Camera size={16} strokeWidth={1.9} />
            Report Litter Here
          </PrimaryButton>
          <GhostButton onClick={() => nav('/map')}>Back to Map</GhostButton>
        </div>
      </div>
    </div>
  );
}
