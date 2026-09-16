import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBeach } from '../api';
import { Check, ChevronRight, Info, SpeciesIcon } from '../components/Icon';
import { Alert, Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import {
  eventCanRecordAttendance,
  formatEventDate,
  getCleanup,
  getCleanupEvent,
  removedBandForRow,
  type CleanupRow,
} from '../iteration2';
import { confirmAttendanceData, fetchCleanup, fetchCleanupEvent } from '../iteration2Api';
import { C, MONO, formatDate } from '../theme';
import type { LitterCategory, QuantityBand } from '../types';
import { useAsyncData } from '../useAsyncData';


function StatusRow({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span style={{ color: C.dim, fontSize: 11, fontWeight: 650 }}>{label}</span>
      <strong style={{ fontSize: 13, color: C.ink2, textAlign: 'left' }}>{children}</strong>
      {onClick ? <ChevronRight color={C.dim} /> : <span />}
    </>
  );
  const style = { display: 'grid', gridTemplateColumns: '104px minmax(0,1fr) auto', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.line}`, width: '100%', textAlign: 'left' as const };
  return onClick
    ? <button type="button" className="press" onClick={onClick} style={style}>{inner}</button>
    : <div style={style}>{inner}</div>;
}

export default function CleanupResultScreen() {
  const { cleanupId = '' } = useParams();
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const [sharing, setSharing] = useState(false);
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
  // Biodiversity is context for the beach, loaded separately so a slow or
  // failed beach request only hides that card and never the cleanup result.
  const { data: beach } = useAsyncData(
    () => cleanup?.beachId ? getBeach(cleanup.beachId) : Promise.resolve(null),
    [cleanup?.beachId],
    null,
  );

  if (loading && !cleanup) {
    return <div className="screen scroll-y"><div className="measure i2-page"><Alert title="Loading cleanup result" tone="caution">Checking the saved result.</Alert></div></div>;
  }

  if (!cleanup) {
    return (
      <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={() => nav('/community')} /><EmptyState title="Cleanup result not found" body={error ?? undefined} action="View activities" onAction={() => nav('/community')} /></div></div>
    );
  }

  const resolved = Boolean(cleanup.resolved);
  const canConfirmAttendance = Boolean(cleanup.eventId && user && event && eventCanRecordAttendance(event, user.participantId));
  const attendanceRecorded = Boolean(user && event?.attendanceBy.includes(user.participantId));

  // Categories the volunteer confirmed as unchanged still belong in the
  // before → after table, so the source report is shown whole.
  const changed = new Set(cleanup.rows.map((row) => row.category));
  const unchangedRows: CleanupRow[] = cleanup.remainingQuantities
    ? (Object.entries(cleanup.remainingQuantities) as [LitterCategory, QuantityBand | undefined][])
      .filter((entry): entry is [LitterCategory, QuantityBand] => Boolean(entry[1]) && !changed.has(entry[0]))
      .map(([category, band]) => ({ category, beforeBand: band, afterBand: band }))
    : [];
  const tableRows = [...cleanup.rows, ...unchangedRows];

  async function confirmAttendance() {
    if (!cleanup?.eventId || !user) return;
    try {
      setEvent(await confirmAttendanceData(cleanup.eventId, user.participantId));
      showToast('Attendance recorded');
      nav(`/events/${cleanup.eventId}`);
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not confirm attendance');
    }
  }

  // A cleanup result is private to the volunteer, so Share hands out the
  // public activity page instead - the same link the event screen shares.
  async function share() {
    if (!cleanup?.eventId) return;
    const shareUrl = `${window.location.origin}/share/events/${cleanup.eventId}`;
    const shareText = event ? `${event.beachName} cleanup · ${formatEventDate(event.date)}` : `${cleanup.beachName} cleanup`;
    if (!navigator.share) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copied');
      } catch {
        showToast('Could not copy the link');
      }
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ title: 'Radar Sampah cleanup', text: shareText, url: shareUrl });
    } catch {
      // Closing the native share sheet needs no recovery message.
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 28 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(cleanup.eventId ? `/events/${cleanup.eventId}` : `/beach/${cleanup.beachId}`)} />
        <div className="i2-result-score">
          <div className="anim-pop-in" style={{ width: 38, height: 38, borderRadius: 19, margin: '0 auto 10px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check color={C.navy} /></div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px', color: C.white }}>
            {resolved ? 'Cleanup completed' : 'Cleanup recorded'}
          </h1>
          <span style={{ display: 'block', marginTop: 6, color: 'rgba(255,255,255,.75)', fontSize: 12.5 }}>
            {cleanup.beachName} · {formatDate(cleanup.createdAt)}
          </span>
          <strong style={{ marginTop: 14 }}>{cleanup.score}</strong>
          <SectionLabel size="sm" tone="dark" style={{ marginTop: 8 }}>CLEANUP SCORE</SectionLabel>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">
            {!cleanup.targetReportId ? 'RESULT' : resolved ? 'SOURCE REMOVED · ALL AFTER BANDS SMALL' : 'SOURCE REPORT · BEFORE → AFTER'}
          </SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 58px auto', gap: 8, marginTop: 10, paddingBottom: 6, borderBottom: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 8.5, letterSpacing: '.08em', color: C.faint }}>
            <span>CATEGORY</span>
            <span style={{ textAlign: 'right' }}>REMOVED</span>
            <span style={{ textAlign: 'right' }}>BANDS</span>
          </div>
          {tableRows.map((row) => {
            // The removed amount in band words, from the before and after
            // bands. An old count-only row has no bands, so it shows "—" rather
            // than a band guessed from a raw item count.
            const removed = removedBandForRow(row);
            return (
              <div key={row.category} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 58px auto', gap: 8, alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.line}` }}>
                <strong style={{ fontSize: 13.5, color: C.ink2 }}>{row.category}</strong>
                <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.green }}>{removed ?? '—'}</span>
                <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                  {row.beforeBand && row.afterBand ? `${row.beforeBand} → ${row.afterBand}` : '—'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">WHAT CHANGES NOW</SectionLabel>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
            Your confirmed bands update this report. The beach rating is worked out separately. A later report is needed to show what changed.
          </p>
          <TextButton onClick={() => nav('/method')}>How it’s rated</TextButton>
        </div>

        <div className="i2-card" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <StatusRow label="Cleanup status">{resolved ? 'Source report removed' : 'Confirmed bands recorded'}</StatusRow>
          {resolved
            ? <StatusRow label="After cleanup">All categories Small · location cleaned</StatusRow>
            : cleanup.targetReportId && <StatusRow label="Still reported">See remaining bands above</StatusRow>}
          <StatusRow label="Handling">{cleanup.handling}</StatusRow>
          {cleanup.eventId && event && (
            <StatusRow label="Event">{event.beachName} · {formatEventDate(event.date)}</StatusRow>
          )}
          {cleanup.eventId && event && user && (
            attendanceRecorded
              ? <StatusRow label="Attendance">Recorded</StatusRow>
              // Attendance still needs the on-the-day check-in, which lives on
              // the event page; the row goes there when it cannot confirm here.
              : <StatusRow label="Attendance" onClick={canConfirmAttendance ? confirmAttendance : () => nav(`/events/${cleanup.eventId}`)}>Not recorded — confirm attendance</StatusRow>
          )}
          {cleanup.note && <p style={{ margin: 0, padding: '10px 0', fontSize: 12, lineHeight: 1.5, color: C.slate }}>{cleanup.note}</p>}
        </div>

        {beach && (
          <div className="i2-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <SectionLabel size="sm">BIODIVERSITY NEARBY</SectionLabel>
              {beach.habitatTag && <InfoChip>{beach.habitatTag}</InfoChip>}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 650, color: C.ink2 }}>{beach.habitat}</div>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {(beach.species ?? []).map((species) => (
                <div key={species.name} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 9 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: C.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SpeciesIcon glyph={species.glyph} size={20} color={C.navy} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 12.5, color: C.ink2 }}>{species.name}</strong>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 11, lineHeight: 1.5, color: C.muted }}>{species.text}</span>
                  </span>
                </div>
              ))}
            </div>
            {beach.ecologicalNote && (
              <p style={{ margin: '12px 0 0', paddingTop: 10, borderTop: `1px solid ${C.line}`, fontSize: 11.5, lineHeight: 1.55, color: C.slate }}>{beach.ecologicalNote}</p>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 10.5, color: C.faint }}>Habitat context — not proof a species is here now.</p>
          </div>
        )}

        <Callout tone="quiet" icon={<Info color={C.slate} />}>
          Based on what you confirmed — not verified proof of a clean beach or recovered habitat.
        </Callout>

        {canConfirmAttendance && (
          <PrimaryButton onClick={confirmAttendance}>Confirm attendance <ChevronRight color={C.lime} /></PrimaryButton>
        )}
        {canConfirmAttendance
          ? <GhostButton onClick={() => nav(`/beach/${cleanup.beachId}`)}>View beach data</GhostButton>
          : <PrimaryButton onClick={() => nav(`/beach/${cleanup.beachId}`)}>View beach data <ChevronRight color={C.lime} /></PrimaryButton>}
        {cleanup.eventId && <GhostButton onClick={() => nav(`/events/${cleanup.eventId}/result`)}>View event result</GhostButton>}
        <div style={{ display: 'grid', gridTemplateColumns: cleanup.eventId ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 8 }}>
          {cleanup.eventId && <GhostButton height={46} onClick={share} disabled={sharing}>{sharing ? 'Opening…' : 'Share'}</GhostButton>}
          <GhostButton height={46} onClick={() => nav('/home')}>Done</GhostButton>
        </div>
      </div>
    </div>
  );
}
