import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyReportCounts } from '../api';
import { BarChart, ChevronRight, ShieldCheck, UserIcon } from '../components/Icon';
import { PrivacySheet } from '../components/PrivacySheet';
import { GhostButton, Label } from '../components/ui';
import { C, MONO } from '../theme';
import { StatTile, StatusBadge } from '../components/ds';
import { useApp } from '../AppContext';
import type { ReportCounts } from '../types';

export default function AccountScreen() {
  const nav = useNavigate();
  const { user, signOut, reportsVersion, offline, setOffline } = useApp();
  const [counts, setCounts] = useState<ReportCounts | null>(null);

  useEffect(() => {
    getMyReportCounts()
      .then((c) => setCounts(c))
      .catch(() => setCounts(null));
  }, [reportsVersion]);
  const [sheet, setSheet] = useState(false);


  const link = (
    title: string,
    subtitle: string,
    icon: JSX.Element,
    onClick: () => void,
    last = false,
  ) => (
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
      <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 13, background: 'rgba(11,33,97,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 620 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>{subtitle}</div>
      </div>
      <ChevronRight />
    </button>
  );

  return (
    <div className="screen scroll-y" style={{ zIndex: 10 }}>
      <div
        className="anim-fade-up pt-page-lg"
        style={{ paddingInline: 20, paddingBottom: 132, display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-.6px' }}>Account</div>

        <div
          style={{
            background: C.white,
            border: `1px solid ${C.line}`,
            borderRadius: 24,
            padding: 17,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                flex: 'none',
                borderRadius: 28,
                background: 'linear-gradient(140deg,#7A879B,#3E4F6E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserIcon size={26} color={C.bg} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.14em', color: C.dim }}>
                PARTICIPANT ID
              </div>
              <div style={{ fontSize: 24, fontWeight: 660, letterSpacing: '-.3px', marginTop: 2 }}>
                {user?.participantId ?? '—'}
              </div>
            </div>
            <StatusBadge status="counted">ANONYMOUS</StatusBadge>
          </div>

        </div>

        <div className="ds-stats">
          <StatTile value={counts?.counted} caption="Counted" tone="counted" onClick={() => nav('/reports?tab=Counted')} />
          <StatTile value={counts?.duplicate} caption="Duplicate" tone="duplicate" onClick={() => nav('/reports?tab=Excluded')} />
          <StatTile value={counts?.incomplete} caption="Incomplete" tone="incomplete" onClick={() => nav('/reports?tab=Excluded')} />
        </div>

        <Label style={{ fontSize: 9.5 }}>PRIVACY &amp; RULES</Label>
        <div style={{ background: C.white, border: '1px solid rgba(11,33,97,.07)', borderRadius: 22, overflow: 'hidden' }}>
          {link(
            'Location privacy',
            'Exact GPS stays private — beach level only',
            <ShieldCheck size={16} color={C.navy} />,
            () => setSheet(true),
          )}
          {link(
            'Severity scoring method',
            'Weights, thresholds and limits',
            <BarChart size={16} />,
            () => nav('/method'),
            true,
          )}
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: C.white,
            border: '1px solid rgba(11,33,97,.07)',
            borderRadius: 18,
            padding: '14px 16px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={offline}
            onChange={(e) => setOffline(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: C.navy }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 620 }}>Simulate offline mode</div>
            <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>
              Shows the map's offline banner
            </div>
          </div>
        </label>

        <GhostButton
          height={52}
          style={{ borderRadius: 17, fontSize: 14.5 }}
          onClick={async () => {
            await signOut();
            nav('/welcome', { replace: true });
          }}
        >
          Sign Out
        </GhostButton>
        <div style={{ fontSize: 11, lineHeight: 1.5, color: C.dim, textAlign: 'center', marginTop: -10 }}>
          Signing out just forgets your ID on this device. Write the number down first.
        </div>

        <div style={{ fontFamily: MONO, fontSize: 9, lineHeight: 1.7, letterSpacing: '.06em', color: C.faint, textAlign: 'center' }}>
          ITERATION 1 · CORE MVP
          <br />
          AI, REVIEW AND RECOGNITION COME LATER
        </div>
      </div>

      {sheet && <PrivacySheet onClose={() => setSheet(false)} />}
    </div>
  );
}
