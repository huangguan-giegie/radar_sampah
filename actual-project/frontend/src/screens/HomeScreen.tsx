import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getBeaches, getMyReportCounts } from '../api';
import { ArrowRight, BarChart, Camera, Info, UserIcon } from '../components/Icon';
import { ErrorNote, Label, Skeleton } from '../components/ui';
import { OverlayChip, SeverityBadge, StatTile } from '../components/ds';
import { attentionStateFor, C, lastReportedLabel, MONO, NOISE, reportWord } from '../theme';
import { useApp } from '../AppContext';
import type { BeachSummary, ReportCounts } from '../types';
import { hasDraftProgress, orderByNeed, resumePath } from '../flowRules';

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}


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
        {/* A bar chart, not a tick. This glyph says "this beach has enough
            evidence to carry a rating" - but a lime green CHECK MARK says
            "passed", and it was sitting immediately left of a red HIGH badge on
            the two dirtiest beaches in the list. AC4.2.3 is the one criterion
            marked [Blocker], and the app is careful never to imply a beach is
            clean in words; a green tick says it in a way words cannot take
            back. The bars also match the BandMeter on the beach page, so the
            same idea is drawn the same way in both places. Info still marks the
            beaches we cannot rate. */}
        {attention.hasBand ? <BarChart size={16} color={C.cloud} strokeWidth={2} /> : <Info size={16} color={C.cloud} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 620 }}>{b.name}</div>
        <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>
          {b.validReports} counted {reportWord(b.validReports)} · {lastReportedLabel(b.lastReportedAt).toLowerCase()}
        </div>
      </div>
      <SeverityBadge band={attention.hasBand ? b.severity : null} label={attention.pageLabel} block />
    </button>
  );
}

export default function HomeScreen() {
  const nav = useNavigate();
  const { user, draft, resetDraft, setLastSavedReport, reportsVersion } = useApp();

  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [loadingBeaches, setLoadingBeaches] = useState(true);
  const [beachesFailed, setBeachesFailed] = useState(false);

  function loadBeaches() {
    setLoadingBeaches(true);
    setBeachesFailed(false);
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeachesFailed(true))
      .finally(() => setLoadingBeaches(false));
  }

  useEffect(loadBeaches, []);


  const [counts, setCounts] = useState<ReportCounts | null>(null);

  useEffect(() => {

    if (!user) {
      setCounts(null);
      return;
    }
    getMyReportCounts()
      .then((c) => setCounts(c))
      .catch(() => setCounts(null));
  }, [reportsVersion, user]);

  const startReport = () => {
    if (hasDraftProgress(draft)) {
      if (window.confirm('Resume your unfinished report? Choose Cancel to start a new report.')) {
        nav(resumePath(draft));
        return;
      }
    }
    resetDraft();
    setLastSavedReport(null);
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
            <div style={{ fontSize: 23, fontWeight: 650, letterSpacing: '-.4px', marginTop: 1 }}>
              {user ? `Participant ${user.participantId}` : 'Guest'}
            </div>
          </div>
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

        <Label style={{ margin: '28px 0 12px' }}>WHAT YOU'VE ADDED</Label>
        <div style={{ display: 'flex', gap: 10 }}>
          <StatTile value={counts?.counted} caption="Counted" tone="counted" onClick={() => nav('/reports?tab=Counted')} />
          <StatTile value={counts?.duplicate} caption="Duplicate" tone="duplicate" onClick={() => nav('/reports?tab=Excluded')} />
          <StatTile value={counts?.incomplete} caption="Incomplete" tone="incomplete" onClick={() => nav('/reports?tab=Excluded')} />
        </div>

        <Label style={{ margin: '26px 0 12px' }}>
          {/* The list is ordered, so the header says so. UF-17: participants
              could not tell what the order meant and asked whether it was
              distance or random. */}
          {beachesFailed ? 'EVIDENCE STATUS' : `EVIDENCE STATUS · NEEDS ATTENTION FIRST`}
        </Label>
        {beachesFailed ? (
          <ErrorNote
            title="Couldn't load the beaches"
            body="The data is fine — this is just the connection."
            onRetry={loadBeaches}
          />
        ) : (
        <div style={{ background: C.white, border: '1px solid rgba(11,33,97,.07)', borderRadius: 22, overflow: 'hidden' }}>
          {loadingBeaches && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton h={38} r={14} />
              <Skeleton h={38} r={14} />
            </div>
          )}
          {orderByNeed(beaches).map((b, i) => (
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
