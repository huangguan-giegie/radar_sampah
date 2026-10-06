import { useNavigate, useParams } from 'react-router-dom';
import { Check, Info } from '../components/Icon';
import { Alert, Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { cleanupBandLabelForRow, eventCleanups, formatEventDate, formatEventTimeRange, getCleanupEvent } from '../iteration2';
import { fetchCleanupEvent, fetchEventCleanups } from '../iteration2Api';
import { C, MONO } from '../theme';
import { useAsyncData } from '../useAsyncData';
import { CoastalPage, DataUnavailable } from '../components/CoastalUI';
import { useAppBack } from '../navigation';
import { RecurrenceEvidence } from '../components/RecurrenceEvidence';
import '../styles/community-alignment.css';

export default function EventResultScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const back = useAppBack(`/events/${encodeURIComponent(eventId)}`);
  const { data: event, loading, error, refresh } = useAsyncData(
    () => fetchCleanupEvent(eventId),
    [eventId],
    getCleanupEvent(eventId),
  );
  const { data, loading: cleanupsLoading, error: cleanupsError, refresh: refreshCleanups } = useAsyncData(
    () => fetchEventCleanups(eventId),
    [eventId],
    eventCleanups(eventId),
  );
  const cleanups = data ?? [];
  const cleanupResultsReady = !cleanupsLoading && !cleanupsError;
  const latestCleanup = cleanups.reduce<(typeof cleanups)[number] | undefined>((latest, cleanup) =>
    !latest || Date.parse(cleanup.createdAt) > Date.parse(latest.createdAt) || (Date.parse(cleanup.createdAt) === Date.parse(latest.createdAt) && cleanup.id > latest.id) ? cleanup : latest,
  undefined);
  const recordedRows = cleanups.flatMap(cleanup => cleanup.rows.map((row, index) => ({
    key: `${cleanup.id}:${index}`, category: row.category, bands: cleanupBandLabelForRow(row),
  })));

  if (loading && !event) return <CoastalPage title="Event Results" back="/community" tabs={false}><div role="status">Loading event results…</div></CoastalPage>;
  if (!event) return <CoastalPage title="Event Results" back="/community" tabs={false}><DataUnavailable title="Event result not found" retry={error ? () => void refresh() : undefined}>{error}</DataUnavailable></CoastalPage>;

  return (
    <div className="screen scroll-y event-result-alignment" style={{ zIndex: 26 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={back} />
        <div>
          {/* Closed events read COMPLETED, as in the prototype. An open event
              says OPEN, so a result page never claims an activity is over
              while people can still join it. */}
          <SectionLabel size="sm">EVENT RESULT · {event.status === 'Closed' ? 'COMPLETED' : 'OPEN'}</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>{event.beachName}</h1>
          <p className="i2-subtitle">{formatEventDate(event.date)} · {formatEventTimeRange(event.startsAt, event.endsAt)}</p>
        </div>

        <div className="event-result-hero">
          <div className="anim-pop-in" style={{ width: 38, height: 38, borderRadius: 19, margin: '0 auto 10px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check color={C.navy} /></div>
          <h2 style={{margin:'8px 0 0',fontSize:23,color:C.white}}>{cleanupResultsReady && cleanups.length > 0 ? 'Cleanup Recorded' : 'Cleanup Results'}</h2>
          <div className="i2-stat-grid" style={{ marginTop: 17 }}>
            <div className="i2-stat"><span>Participants</span><strong>{event.participantCount}</strong></div>
            <div className="i2-stat"><span>Recorded Attendance</span><strong>{event.attendanceCount}</strong></div>
            <div className="i2-stat"><span>Cleanups</span><strong>{cleanupResultsReady ? cleanups.length : '—'}</strong></div>
          </div>
        </div>

        {cleanupsError ? (
          <DataUnavailable title="Could not load cleanup results" retry={() => void refreshCleanups()}>{cleanupsError}</DataUnavailable>
        ) : cleanupsLoading ? (
          <Alert title="Loading cleanup results" tone="caution">Checking the recorded cleanups.</Alert>
        ) : cleanups.length === 0 ? (
          <EmptyState title="No cleanup result yet" body="The activity is listed, but no linked cleanup has been recorded." />
        ) : (
          <div className="i2-card">
            <SectionLabel size="sm">CLEANED AT THIS EVENT</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
              <SectionLabel size="sm">CATEGORY</SectionLabel>
              <SectionLabel size="sm">BEFORE → AFTER</SectionLabel>
            </div>
            <div style={{ marginTop: 2 }}>
              {recordedRows.map(row => (
                <div key={row.key} className="i2-quantity-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <strong style={{ fontSize: 13 }}>{row.category}</strong>
                  <strong style={{ fontFamily: MONO, fontSize: 12.5, color: C.green, textAlign: 'right' }}>{row.bands ?? '—'}</strong>
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

        {cleanupResultsReady && <RecurrenceEvidence evidence={latestCleanup?.recurrence} />}
        <Callout title="Recorded evidence only" tone="quiet" icon={<Info color={C.navy} />}>
          Results come from the amounts people confirmed. They don’t prove the beach is clean.
        </Callout>

        <PrimaryButton onClick={back} trailingArrow>Back to event</PrimaryButton>
        <GhostButton onClick={() => nav(`/beach/${event.beachId}`)}>View beach data</GhostButton>
      </div>
    </div>
  );
}
