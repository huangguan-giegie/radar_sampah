import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Info } from '../components/Icon';
import { Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton } from '../components/ui';
import { CLEANUP_BAND_UNITS, eventCleanups, formatEventDate, getCleanupEvent } from '../iteration2';
import { C } from '../theme';
import type { LitterCategory } from '../types';

export default function EventResultScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const [event, setEvent] = useState<Awaited<ReturnType<typeof getCleanupEvent>>>(null);
  const [cleanups, setCleanups] = useState<Awaited<ReturnType<typeof eventCleanups>>>([]);
  useEffect(() => {
    let active = true;
    Promise.all([getCleanupEvent(eventId), eventCleanups(eventId)]).then(([eventResult, cleanupRows]) => {
      if (!active) return;
      setEvent(eventResult);
      setCleanups(cleanupRows);
    });
    return () => { active = false; };
  }, [eventId]);
  const totals = useMemo(() => {
    const result: Partial<Record<LitterCategory, number>> = {};
    cleanups.flatMap((cleanup) => cleanup.rows).forEach((row) => {
      const units = row.removedUnits ?? (row.removedBand ? CLEANUP_BAND_UNITS[row.removedBand] : 0);
      if (units > 0) result[row.category] = (result[row.category] ?? 0) + units;
    });
    return result;
  }, [cleanups]);
  const score = cleanups.reduce((sum, cleanup) => sum + cleanup.score, 0);

  if (!event) return null;

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(`/events/${event.id}`)} />
        <div>
          <SectionLabel size="sm">EVENT RESULT</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>{event.beachName}</h1>
          <p className="i2-subtitle">{formatEventDate(event.date)} · recorded activity data</p>
        </div>

        <div className="i2-result-score">
          <div className="anim-pop-in" style={{ width: 38, height: 38, borderRadius: 19, margin: '0 auto 10px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check color={C.navy} /></div>
          <strong>{score}</strong>
          <span style={{ display: 'block', marginTop: 5, color: 'rgba(255,255,255,.76)', fontSize: 12 }}>EVENT CLEANUP SCORE · BAND UNITS</span>
          <div className="i2-stat-grid" style={{ marginTop: 17 }}>
            <div className="i2-stat"><strong>{event.participantCount}</strong><span>PARTICIPANTS</span></div>
            <div className="i2-stat"><strong>{event.attendanceBy.length}</strong><span>ATTENDANCE</span></div>
            <div className="i2-stat"><strong>{cleanups.length}</strong><span>CLEANUPS</span></div>
          </div>
        </div>

        {cleanups.length === 0 ? (
          <EmptyState title="No cleanup result yet" body="The activity is listed, but no linked cleanup has been recorded." />
        ) : (
          <div className="i2-card">
            <SectionLabel size="sm">RECORDED REDUCTION</SectionLabel>
            <div style={{ marginTop: 10 }}>
              {(Object.entries(totals) as [LitterCategory, number][]).map(([category, amount]) => (
                <div key={category} className="i2-quantity-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <strong style={{ fontSize: 13 }}>{category}</strong>
                  <InfoChip color={C.green} background={C.greenBg}>{amount} band unit{amount === 1 ? '' : 's'}</InfoChip>
                </div>
              ))}
              {Object.keys(totals).length === 0 && (
                <p style={{ margin: 0, color: C.muted, fontSize: 12 }}>Only legacy cleanup records are attached to this activity.</p>
              )}
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
          These values summarize quantity-band reductions. They are not moderator verification, an environmental-impact score, or proof that the beach is clean.
        </Callout>

        <GhostButton onClick={() => nav(`/share/events/${event.id}`)}>Open sharing page</GhostButton>
        <GhostButton onClick={() => nav(`/beach/${event.beachId}`)}>View beach</GhostButton>
      </div>
    </div>
  );
}
