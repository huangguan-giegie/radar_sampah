import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Info } from '../components/Icon';
import { Alert, Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { eventCleanups, formatEventDate, formatEventTimeRange, getCleanupEvent, removedBandForRow } from '../iteration2';
import { fetchCleanupEvent, fetchEventCleanups } from '../iteration2Api';
import { C, MONO } from '../theme';
import type { LitterCategory } from '../types';
import { useAsyncData } from '../useAsyncData';

export default function EventResultScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const { data: event, loading, error } = useAsyncData(
    () => fetchCleanupEvent(eventId),
    [eventId],
    getCleanupEvent(eventId),
  );
  const { data } = useAsyncData(
    () => fetchEventCleanups(eventId),
    [eventId],
    eventCleanups(eventId),
  );
  // The real API starts empty (null) until the list arrives.
  const cleanups = data ?? [];
  // One line per category, naming the band each cleanup removed ("Small"),
  // as the prototype does. Bands are words, not amounts, so two cleanups of
  // the same category are listed side by side rather than added into a band
  // neither volunteer chose. A category with no band to name (nothing taken
  // away, or an older count-only record) shows "—", as the cleanup result does.
  const removedBands = useMemo(() => {
    const result: Partial<Record<LitterCategory, string[]>> = {};
    cleanups.flatMap((cleanup) => cleanup.rows).forEach((row) => {
      const bands = (result[row.category] ??= []);
      const band = removedBandForRow(row);
      if (band) bands.push(band);
    });
    return result;
  }, [cleanups]);
  const score = cleanups.reduce((sum, cleanup) => sum + cleanup.score, 0);

  if (loading && !event) return <div className="screen scroll-y"><div className="measure i2-page"><Alert title="Loading event result" tone="caution">Checking the latest recorded activity.</Alert></div></div>;
  if (!event) return <div className="screen scroll-y"><div className="measure i2-page"><EmptyState title="Event result not found" body={error ?? undefined} action="View activities" onAction={() => nav('/community')} /></div></div>;

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(`/events/${event.id}`)} />
        <div>
          {/* Closed events read COMPLETED, as in the prototype. An open event
              says OPEN, so a result page never claims an activity is over
              while people can still join it. */}
          <SectionLabel size="sm">EVENT RESULT · {event.status === 'Closed' ? 'COMPLETED' : 'OPEN'}</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>{event.beachName}</h1>
          <p className="i2-subtitle">{formatEventDate(event.date)} · {formatEventTimeRange(event.startsAt, event.endsAt)}</p>
        </div>

        <div className="i2-result-score">
          <div className="anim-pop-in" style={{ width: 38, height: 38, borderRadius: 19, margin: '0 auto 10px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check color={C.navy} /></div>
          <strong>{score}</strong>
          <span style={{ display: 'block', marginTop: 5, color: 'rgba(255,255,255,.76)', fontSize: 12 }}>EVENT CLEANUP SCORE</span>
          <div className="i2-stat-grid" style={{ marginTop: 17 }}>
            <div className="i2-stat"><strong>{event.participantCount}</strong><span>PARTICIPANTS</span></div>
            <div className="i2-stat"><strong>{event.attendanceCount}</strong><span>RECORDED ATTENDANCE</span></div>
            <div className="i2-stat"><strong>{cleanups.length}</strong><span>CLEANUPS</span></div>
          </div>
        </div>

        {cleanups.length === 0 ? (
          <EmptyState title="No cleanup result yet" body="The activity is listed, but no linked cleanup has been recorded." />
        ) : (
          <div className="i2-card">
            <SectionLabel size="sm">CLEANED AT THIS EVENT</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
              <SectionLabel size="sm">CATEGORY</SectionLabel>
              <SectionLabel size="sm">BAND REMOVED</SectionLabel>
            </div>
            <div style={{ marginTop: 2 }}>
              {(Object.entries(removedBands) as [LitterCategory, string[]][]).map(([category, bands]) => (
                <div key={category} className="i2-quantity-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <strong style={{ fontSize: 13 }}>{category}</strong>
                  <strong style={{ fontFamily: MONO, fontSize: 12.5, color: C.green, textAlign: 'right' }}>{bands.length > 0 ? bands.join(' + ') : '—'}</strong>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
              <span style={{ color: C.muted, fontSize: 12 }}>Handling</span>
              <div className="i2-chip-row" style={{ marginTop: 8 }}>
                {(['Collected for disposal', 'Recycled / handled', 'Not recorded'] as const).map((option) => {
                  const selected = cleanups.some((cleanup) => cleanup.handling === option);
                  return <InfoChip key={option} color={selected ? C.white : C.dim} background={selected ? C.navy : undefined}>{option}</InfoChip>;
                })}
              </div>
            </div>
          </div>
        )}

        <Callout title="Recorded evidence only" tone="quiet" icon={<Info color={C.navy} />}>
          These are cleanup scores from confirmed bands. They are not contribution points, impact evidence or proof that the beach is clean.
        </Callout>

        <PrimaryButton onClick={() => nav(`/events/${event.id}`)} trailingArrow>Back to event</PrimaryButton>
        <GhostButton onClick={() => nav(`/beach/${event.beachId}`)}>View beach data</GhostButton>
      </div>
    </div>
  );
}
