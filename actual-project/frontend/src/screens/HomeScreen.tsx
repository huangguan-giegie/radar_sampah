// The home page: where a signed-in volunteer starts.
//
// It answers three questions in this order:
//   1. Which beach needs me?      -> the map card
//   2. What can I do right now?   -> Add a Report / How It's Rated
//   3. What have I already done?  -> the three status tiles
//
// It works signed out too. A guest sees the same beaches and the same map -
// only the personal counts are missing. Making the home page refuse to load
// without an account would put a wall in front of the public data, which is
// the opposite of what this project is for.
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getBeaches, getMyReportCounts } from '../api';
import { ArrowRight, BarChart, Camera, Check, Info, UserIcon } from '../components/Icon';
import { ErrorNote, Label, Skeleton } from '../components/ui';
import { OverlayChip, SeverityBadge, StatTile } from '../components/ds';
import { attentionStateFor, C, MONO, NOISE, lastReportedLabel } from '../theme';
import { useApp } from '../AppContext';
import type { BeachSummary, ReportCounts } from '../types';
import { hasDraftProgress, resumePath } from '../flowRules';

// Morning / afternoon / evening, from the device clock. The date is a
// parameter with a default so this can be tested without faking the clock.
function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}


/**
 * One beach in the evidence list.
 *
 * attentionStateFor is the one place that decides whether a beach has earned
 * a severity band. Asking it here, instead of reading b.severity straight
 * off, is what stops the same beach reading "Low" on the map and
 * "Insufficient data" on its own page.
 *
 * The icon carries the important distinction: a tick means we have enough
 * counted reports to rate this beach, the info symbol means we do not. Those
 * are very different claims, so they must not look the same at a glance.
 *
 * `last` only removes the final divider line - a border under the last row
 * would double up with the card edge below it.
 */
function BeachRow({ b, last, onClick }: { b: BeachSummary; last: boolean; onClick: () => void }) {
  const attention = attentionStateFor(b.severity, b.insufficientData, b.validReports);
  return (
    <button
      type="button"
      onClick={onClick}
      className="row-hover"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '15px 16px',
        width: '100%',
        borderBottom: last ? 'none' : '1px solid rgba(11,33,97,.06)',
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          flex: 'none',
          borderRadius: 14,
          background: b.insufficientData
            ? 'linear-gradient(160deg,#2F6B7C,#123244)'
            : 'linear-gradient(160deg,#4E9EC9,#1C4A85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Shape as well as colour. Someone who cannot tell the two blues
            apart still sees a tick against an "i". */}
        {attention.hasBand ? <Check size={16} color={C.lime} strokeWidth={2} /> : <Info size={16} color={C.cloud} />}
      </div>
      {/* minWidth: 0 lets this flex child shrink. Without it a long beach
          name refuses to shrink and pushes the severity badge off screen -
          the classic flexbox overflow. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 620 }}>{b.name}</div>
        <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>
          {b.validReports} counted reports · {lastReportedLabel(b.lastReportedAt).toLowerCase()}
        </div>
      </div>
      <SeverityBadge band={attention.hasBand ? b.severity : null} label={attention.pageLabel} block />
    </button>
  );
}

export default function HomeScreen() {
  const nav = useNavigate();
  const { user, draft, resetDraft, setLastSavedReport, reportsVersion } = useApp();

  // Three pieces of state for one request: the data, "still waiting", and
  // "it failed". A single `beaches` array cannot tell an empty result apart
  // from a request that never came back, and those need different screens.
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [loadingBeaches, setLoadingBeaches] = useState(true);
  const [beachesFailed, setBeachesFailed] = useState(false);

  // A named function, not an inline effect body, because the error panel's
  // Retry button calls exactly the same code. Retry must repeat the request,
  // not something that only looks like it.
  function loadBeaches() {
    setLoadingBeaches(true);
    setBeachesFailed(false);
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeachesFailed(true))
      .finally(() => setLoadingBeaches(false));
  }

  useEffect(loadBeaches, []);


  // My report counts. reportsVersion is in the dependency list below, so
  // submitting a report anywhere in the app makes these tiles refresh - the
  // user comes back to home and their new report is already counted.
  const [counts, setCounts] = useState<ReportCounts | null>(null);

  useEffect(() => {

    // /home is deliberately not behind RequireAuth, so a guest can land here.
    // For a guest this endpoint would answer 401 every time - there is no
    // point asking, and a red error would be misleading rather than useful.
    if (!user) {
      setCounts(null);
      return;
    }
    getMyReportCounts()
      .then((c) => setCounts(c))
      .catch(() => setCounts(null));
  }, [reportsVersion, user]);

  // An unfinished draft is never thrown away without asking. Resume takes the
  // user back to the furthest step they had reached, so a report started days
  // ago can still be finished instead of being started again from the photo.
  const startReport = () => {
    if (hasDraftProgress(draft)) {
      if (window.confirm('Resume your unfinished report? Choose Cancel to start a new report.')) {
        nav(resumePath(draft));
        return;
      }
    }
    // Cancel means "start a new one", so the old draft goes. Otherwise a
    // report abandoned last week would come back with its old photo and old
    // beach already filled in, and that stale beach could be submitted
    // without the user noticing.
    //
    // Clearing the last saved report matters too: while that value is set the
    // report routes send the user to /reports, so a new report would bounce
    // straight out of the flow.
    resetDraft();
    setLastSavedReport(null);
    // A guest is sent to get a number first, and ?next= brings them straight
    // back to the photo step. Without that they would land on the home page
    // after signing in and have to find this button again.
    nav(user ? '/report/photo' : '/identity?next=/report/photo');
  };



  return (
    <div className="screen scroll-y" style={{ zIndex: 10 }}>
      <div
        className="anim-fade-up pt-page-lg measure"
        style={{ paddingInline: 20, paddingBottom: 132, display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14.5, color: C.dim }}>{greeting()}</div>
            {/* The participant number IS the name here. Showing it on the
                home page every visit is also how the user keeps seeing the
                number they were told to write down. */}
            <div style={{ fontSize: 23, fontWeight: 650, letterSpacing: '-.4px', marginTop: 1 }}>
              {user ? `Participant ${user.participantId}` : 'Guest'}
            </div>
          </div>
          {/* aria-label because this button has an icon and no text. Without
              it a screen reader announces only "button". */}
          <button
            type="button"
            onClick={() => nav('/account')}
            aria-label="Account"
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              background: 'linear-gradient(140deg,#7A879B,#3E4F6E)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.bg,
              fontSize: 16,
              fontWeight: 650,
              border: `2px solid ${C.white}`,
              boxShadow: '0 6px 16px -6px rgba(11,33,97,.4)',
            }}
          >
            <UserIcon size={20} color={C.bg} strokeWidth={1.9} />
          </button>
        </div>

        <div
          style={{
            fontSize: 30,
            fontWeight: 630,
            letterSpacing: '-.9px',
            lineHeight: 1.12,
            margin: '24px 0 18px',
            textWrap: 'balance',
          }}
        >

        </div>

        <button
          type="button"
          onClick={() => nav('/map')}
          className="lift press"
          style={{
            position: 'relative',
            height: 212,
            borderRadius: 26,
            overflow: 'hidden',
            boxShadow: '0 20px 44px -18px rgba(14,30,64,.45)',
            background:
              'radial-gradient(110% 60% at 70% 18%,rgba(221,227,236,.4),transparent 55%),linear-gradient(178deg,#8FD0E8 0%,#4E9EC9 36%,#2E6EA8 58%,#173E77 100%)',
            width: '100%',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 40%,rgba(221,227,236,.18) 46%,transparent 54%)' }} />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundImage: NOISE }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 30%,rgba(9,22,48,.78) 100%)' }} />
          {/* `|| 4` keeps the chip sensible while the list is still loading -
              it would otherwise flash "0 BEACHES" for a moment, which reads
              as "there is nothing here". */}
          <OverlayChip style={{ position: 'absolute', top: 14, left: 14 }}>
            MAP · {beaches.length || 4} BEACHES
          </OverlayChip>
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-.4px', color: C.bg }}>
              Which beach needs you?
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'rgba(232,238,245,.8)', marginTop: 4, maxWidth: 250 }}>

            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                marginTop: 11,
                padding: '9px 15px',
                borderRadius: 999,
                background: 'rgba(255,255,255,.14)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,.3)',
                color: C.bg,
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              Take a Look <ArrowRight size={13} />
            </div>
          </div>
        </button>

        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          <button
            type="button"
            onClick={startReport}
            className="btn-primary press"
            style={{
              flex: 1,
              background: C.navy,
              borderRadius: 24,
              padding: '18px 16px',
              color: C.bg,
              display: 'flex',
              flexDirection: 'column',
              gap: 26,
              boxShadow: '0 18px 38px -18px rgba(11,33,97,.6)',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(184,255,54,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera />
            </div>
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 650, letterSpacing: '-.2px' }}>Add a Report</div>
              <div style={{ fontSize: 11.5, color: C.mist, marginTop: 3, lineHeight: 1.4 }}>
                One photo, two taps, about a minute
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => nav('/method')}
            className="card-hover press"
            style={{
              flex: 1,
              background: C.white,
              border: `1px solid ${C.line}`,
              borderRadius: 24,
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 26,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(11,33,97,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart />
            </div>
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 650, letterSpacing: '-.2px' }}>How It's Rated</div>
              <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3, lineHeight: 1.4 }}>
                The exact maths
              </div>
            </div>
          </button>
        </div>

        {/* The three tiles are the same three statuses the backend uses, and
            each one links into the filtered list. A number the user cannot
            click through to is just a number they have to trust. */}
        <Label style={{ margin: '28px 0 12px' }}>WHAT YOU'VE ADDED</Label>
        <div style={{ display: 'flex', gap: 10 }}>
          <StatTile value={counts?.counted} caption="Counted" tone="counted" onClick={() => nav('/reports?tab=Counted')} />
          <StatTile value={counts?.duplicate} caption="Duplicate" tone="duplicate" onClick={() => nav('/reports?tab=Excluded')} />
          <StatTile value={counts?.incomplete} caption="Incomplete" tone="incomplete" onClick={() => nav('/reports?tab=Excluded')} />
        </div>

        <Label style={{ margin: '26px 0 12px' }}>
          {beachesFailed ? 'EVIDENCE STATUS' : `EVIDENCE STATUS · ${beaches.length || 4} BEACHES`}
        </Label>
        {beachesFailed ? (
          <ErrorNote
            title="Couldn't load the beaches"
            body="The data is fine — this is just the connection."
            onRetry={loadBeaches}
          />
        ) : (
        <div style={{ background: C.white, border: '1px solid rgba(11,33,97,.07)', borderRadius: 22, overflow: 'hidden' }}>
          {/* Skeleton rows, not a spinner: they hold the space the real rows
              will take, so the page does not jump when the data arrives. */}
          {loadingBeaches && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton h={38} r={14} />
              <Skeleton h={38} r={14} />
            </div>
          )}
          {beaches.map((b, i) => (
            <BeachRow
              key={b.id}
              b={b}
              last={i === beaches.length - 1}
              onClick={() => nav(`/beach/${b.id}`)}
            />
          ))}
        </div>
        )}

        <div
          style={{
            marginTop: 10,
            padding: '12px 14px',
            borderRadius: 16,
            background: 'rgba(11,33,97,.03)',
            border: '1px solid rgba(11,33,97,.07)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: '.14em', color: C.dim }}>
            <Info size={11} color={C.dim} strokeWidth={2} />
            READING THE MAP
          </div>
          {/* The last sentence is the whole point of this box. Both labels
              mean "we do not know", and a user who reads them as "this beach
              is fine" would take away the opposite of what the data says. */}
          <div style={{ fontSize: 11, lineHeight: 1.6, color: C.muted, marginTop: 6 }}>
            <b style={{ color: C.muted }}>Insufficient data</b> — fewer than three counted reports.{' '}
            <b style={{ color: C.muted }}>Not recently reported</b> — nothing counted in 90 days.
            Neither means the beach is clean.
          </div>
        </div>
      </div>
    </div>
  );
}
