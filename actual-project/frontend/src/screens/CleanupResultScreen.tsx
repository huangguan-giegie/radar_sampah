import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, Info } from '../components/Icon';
import { Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { CLEANUP_BAND_UNITS, getCleanup } from '../iteration2';
import { C, formatDate } from '../theme';

export default function CleanupResultScreen() {
  const { cleanupId = '' } = useParams();
  const nav = useNavigate();
  const [cleanup, setCleanup] = useState<Awaited<ReturnType<typeof getCleanup>>>(null);
  useEffect(() => {
    let active = true;
    getCleanup(cleanupId).then((row) => { if (active) setCleanup(row); });
    return () => { active = false; };
  }, [cleanupId]);

  if (!cleanup) {
    return (
      <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={() => nav('/community')} /><EmptyState title="Cleanup result not found" action="View activities" onAction={() => nav('/community')} /></div></div>
    );
  }

  const linkedToReport = Boolean(cleanup.targetReportId);

  return (
    <div className="screen scroll-y" style={{ zIndex: 28 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(cleanup.eventId ? `/events/${cleanup.eventId}` : `/beach/${cleanup.beachId}`)} />
        <div className="i2-result-score">
          <div className="anim-pop-in" style={{ width: 38, height: 38, borderRadius: 19, margin: '0 auto 10px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check color={C.navy} /></div>
          <SectionLabel size="sm" tone="dark">CLEANUP RECORDED</SectionLabel>
          <strong style={{ marginTop: 9 }}>{cleanup.score}</strong>
          <span style={{ display: 'block', marginTop: 5, color: 'rgba(255,255,255,.76)', fontSize: 12 }}>CLEANUP SCORE · quantity-band units</span>
        </div>

        <Callout title={cleanup.resolved ? 'Target resolved' : 'Awaiting follow-up'} tone="reassurance" icon={<Info color={C.green} />}>
          {cleanup.resolved
            ? 'No Medium, Large, or Very Large litter remains in this linked report. The original report and cleanup record stay in history.'
            : 'Cleanup recorded — awaiting follow-up. This does not claim the beach is completely clean or ecologically recovered.'}
        </Callout>

        <div className="i2-card">
          <SectionLabel size="sm">RESULT</SectionLabel>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: C.muted, fontSize: 12 }}>Beach</span><strong style={{ fontSize: 12.5 }}>{cleanup.beachName}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: C.muted, fontSize: 12 }}>Date</span><strong style={{ fontSize: 12.5 }}>{formatDate(cleanup.createdAt)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: C.muted, fontSize: 12 }}>Handling</span><strong style={{ fontSize: 12.5, textAlign: 'right' }}>{cleanup.handling}</strong></div>
          </div>
          <div className="i2-divider" style={{ margin: '14px 0 4px' }} />
          {cleanup.rows.map((row) => {
            const units = row.removedUnits ?? (row.removedBand ? CLEANUP_BAND_UNITS[row.removedBand] : null);
            return (
              <div key={row.category} className="i2-quantity-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <span>
                  <strong style={{ display: 'block', fontSize: 13 }}>{row.category}</strong>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: C.dim }}>
                    {row.before
                      ? `${row.before} → ${row.after ?? 'None'} remaining`
                      : row.removedBand
                        ? `${row.removedBand} recorded as removed`
                        : 'Legacy cleanup amount recorded'}
                  </span>
                </span>
                {units !== null && <InfoChip color={C.green} background={C.greenBg}>−{units} unit{units === 1 ? '' : 's'}</InfoChip>}
              </div>
            );
          })}
          {cleanup.note && <p style={{ margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12, lineHeight: 1.5, color: C.slate }}>{cleanup.note}</p>}
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">WHAT CHANGES NOW</SectionLabel>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
            {linkedToReport
              ? "The confirmed post-cleanup bands become this report's current litter state. If only Small or no litter remains, it leaves the active beach rating while the historical report stays intact."
              : 'This cleanup is standalone evidence for the beach. It records removed quantity bands without changing any unrelated report.'}
          </p>
          <TextButton onClick={() => nav('/method')}>How it’s rated</TextButton>
        </div>

        {cleanup.eventId && <PrimaryButton onClick={() => nav(`/events/${cleanup.eventId}/result`)}>View event result <ChevronRight color={C.lime} /></PrimaryButton>}
        <GhostButton onClick={() => nav(`/beach/${cleanup.beachId}`)}>View beach</GhostButton>
      </div>
    </div>
  );
}
