import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, Info } from '../components/Icon';
import { Alert, Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import { eventCanRecordAttendance, getCleanup, getCleanupEvent } from '../iteration2';
import { confirmAttendanceData, fetchCleanup, fetchCleanupEvent } from '../iteration2Api';
import { C, formatDate } from '../theme';
import { useAsyncData } from '../useAsyncData';

export default function CleanupResultScreen() {
  const { cleanupId = '' } = useParams();
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const { data: cleanup, loading, error } = useAsyncData(
    () => fetchCleanup(cleanupId),
    [cleanupId],
    getCleanup(cleanupId),
  );
  const { data: event, setData: setEvent } = useAsyncData(
    () => cleanup?.eventId ? fetchCleanupEvent(cleanup.eventId) : Promise.resolve(null),
    [cleanup?.eventId, user?.participantId],
    cleanup?.eventId ? getCleanupEvent(cleanup.eventId) : null,
  );

  if (loading && !cleanup) {
    return <div className="screen scroll-y"><div className="measure i2-page"><Alert title="Loading cleanup result" tone="caution">Checking the saved result.</Alert></div></div>;
  }

  if (!cleanup) {
    return (
      <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={() => nav('/community')} /><EmptyState title="Cleanup result not found" body={error ?? undefined} action="View activities" onAction={() => nav('/community')} /></div></div>
    );
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 28 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(cleanup.eventId ? `/events/${cleanup.eventId}` : `/beach/${cleanup.beachId}`)} />
        <div className="i2-result-score">
          <div className="anim-pop-in" style={{ width: 38, height: 38, borderRadius: 19, margin: '0 auto 10px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check color={C.navy} /></div>
          <SectionLabel size="sm" tone="dark">CLEANUP RECORDED</SectionLabel>
          <strong style={{ marginTop: 9 }}>{cleanup.score}</strong>
          <span style={{ display: 'block', marginTop: 5, color: 'rgba(255,255,255,.76)', fontSize: 12 }}>CLEANUP SCORE · confirmed band changes</span>
        </div>

        <Callout title="Cleanup recorded — awaiting follow-up" tone="reassurance" icon={<Info color={C.green} />}>
          A later report is needed to show what changed.
        </Callout>

        <div className="i2-card">
          <SectionLabel size="sm">RESULT</SectionLabel>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: C.muted, fontSize: 12 }}>Beach</span><strong style={{ fontSize: 12.5 }}>{cleanup.beachName}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: C.muted, fontSize: 12 }}>Date</span><strong style={{ fontSize: 12.5 }}>{formatDate(cleanup.createdAt)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: C.muted, fontSize: 12 }}>Handling</span><strong style={{ fontSize: 12.5, textAlign: 'right' }}>{cleanup.handling}</strong></div>
          </div>
          <div className="i2-divider" style={{ margin: '14px 0 4px' }} />
          {cleanup.rows.map((row) => (
            <div key={row.category} className="i2-quantity-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <span><strong style={{ display: 'block', fontSize: 13 }}>{row.category}</strong><span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: C.dim }}>{row.beforeBand} → {row.afterBand}</span></span>
              <InfoChip color={C.green} background={C.greenBg}>−{row.score}</InfoChip>
            </div>
          ))}
          {cleanup.note && <p style={{ margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12, lineHeight: 1.5, color: C.slate }}>{cleanup.note}</p>}
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">WHAT CHANGES NOW</SectionLabel>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
            Your confirmed bands update this report. The beach rating is worked out separately.
          </p>
          <TextButton onClick={() => nav('/method')}>How it’s rated</TextButton>
        </div>

        {cleanup.eventId && user && event && eventCanRecordAttendance(event, user.participantId) && (
          <PrimaryButton onClick={async () => {
            try {
              setEvent(await confirmAttendanceData(cleanup.eventId!, user.participantId));
              showToast('Attendance recorded');
              nav(`/events/${cleanup.eventId}`);
            } catch (reason) {
              showToast(reason instanceof Error ? reason.message : 'Could not confirm attendance');
            }
          }}>Confirm attendance <ChevronRight color={C.lime} /></PrimaryButton>
        )}
        {cleanup.eventId && <GhostButton onClick={() => nav(`/events/${cleanup.eventId}/result`)}>View event result</GhostButton>}
        <GhostButton onClick={() => nav(`/beach/${cleanup.beachId}`)}>View beach</GhostButton>
      </div>
    </div>
  );
}
