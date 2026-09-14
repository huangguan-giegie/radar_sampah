import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, Pin } from '../components/Icon';
import { Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { useApp } from '../AppContext';
import {
  eventCleanups,
  formatEventDate,
  getCleanupEvent,
  getSharedItems,
  joinCleanupEvent,
  type CleanupEvent,
} from '../iteration2';
import { iteration2SharedPhotoUrl } from '../api';
import { C } from '../theme';

type SharedReport = {
  id: string;
  beachId: string;
  beachName: string;
  reportedAt: string;
  status: string;
  quantities: Record<string, string>;
  itemCounts: Record<string, number>;
  remainingItemCounts: Record<string, number>;
  remainingTotal: number;
  photoAvailable: boolean;
};

export default function SharedEventScreen() {
  const { eventId = '', shareToken, reportId } = useParams();
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [event, setEvent] = useState<CleanupEvent | null>(null);
  const [report, setReport] = useState<SharedReport | null>(null);
  const [cleanupCount, setCleanupCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const load = shareToken
      ? getSharedItems(shareToken)
      : reportId
        ? getSharedItems(reportId)
        : getCleanupEvent(eventId).then((eventResult) => ({ event: eventResult, report: null }));
    load.then(async ({ event: eventResult, report: reportResult }) => {
      if (!active) return;
      setEvent(eventResult);
      setReport(reportResult);
      if (eventResult) {
        const rows = await eventCleanups(eventResult.id);
        if (active) setCleanupCount(rows.length);
      }
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [eventId, reportId, shareToken]);

  const link = window.location.href;
  const participantId = user?.participantId;
  const joined = Boolean(participantId && event?.joinedBy.includes(participantId));
  const checkedIn = Boolean(participantId && event?.checkIns[participantId] === 'within_area');
  const canClean = Boolean(report && report.remainingTotal > 0);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast('Link copied');
    } catch {
      setCopied(false);
      showToast('Could not copy the link');
    }
  }

  async function systemShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: 'Radar Sampah cleanup', url: link });
    } catch {
      // Closing the native share sheet needs no recovery message.
    }
  }

  async function joinEvent() {
    if (!event || !participantId) {
      nav(`/identity?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    try {
      setEvent(await joinCleanupEvent(event.id, participantId));
      showToast('Activity joined');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not join this activity.');
    }
  }

  if (loading) {
    return <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={() => nav('/community')} /><SectionLabel size="sm">Loading shared activity…</SectionLabel></div></div>;
  }
  if (error || (!event && !report)) {
    return <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={() => nav('/community')} /><EmptyState title="Shared activity not found" body="This link does not expose any other reports or activities." action="View activities" onAction={() => nav('/community')} /></div></div>;
  }

  const beachName = report?.beachName ?? event?.beachName ?? 'Cleanup activity';
  const eventPath = event ? `/events/${event.id}` : '/community';
  const sharePath = shareToken ? `/share/${encodeURIComponent(shareToken)}` : reportId ? `/share/reports/${encodeURIComponent(reportId)}` : `/share/events/${encodeURIComponent(eventId)}`;
  const cleanedCounts = report?.remainingItemCounts ?? {};

  return (
    <div className="screen scroll-y" style={{ zIndex: 27 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(eventPath)} />

        <div className="i2-link-field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{link}</span>
          <button type="button" onClick={copyLink} className="press" style={{ color: copied ? C.green : C.navy, fontWeight: 750 }}>{copied ? 'Copied' : 'Copy'}</button>
        </div>

        {event && (
          <div className="i2-hero i2-hero-compact">
            <SectionLabel size="sm" tone="dark">SHARED CLEANUP EVENT</SectionLabel>
            <h1 style={{ margin: '8px 0 0', fontSize: 25, letterSpacing: '-.6px' }}>{event.beachName}</h1>
            <div className="i2-event-meta">
              <span><Clock color={C.lime} />{formatEventDate(event.date)} · {event.startsAt}–{event.endsAt}</span>
              <span><Pin color={C.lime} />{event.area}</span>
            </div>
            <div className="i2-stat-grid" style={{ marginTop: 15 }}>
              <div className="i2-stat"><strong>{event.participantCount}</strong><span>PARTICIPANTS</span></div>
              <div className="i2-stat"><strong>{event.attendanceBy.length}</strong><span>RECORDED</span></div>
              <div className="i2-stat"><strong style={{ fontSize: 15 }}>{event.status}</strong><span>STATUS</span></div>
            </div>
          </div>
        )}

        {report && (
          <div className="i2-card">
            <SectionLabel size="sm">SHARED REPORT</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginTop: 10 }}>
              <div>
                <strong style={{ display: 'block', color: C.ink2, fontSize: 14.5 }}>Report {report.id.toUpperCase()}</strong>
                <span style={{ display: 'block', marginTop: 4, color: C.muted, fontSize: 11.5 }}>{report.beachName} · {report.remainingTotal} items remain</span>
              </div>
              <InfoChip color={C.green} background={C.greenBg}>{report.status}</InfoChip>
            </div>
            {report.photoAvailable && shareToken && (
              <img src={iteration2SharedPhotoUrl(shareToken)} alt="Original litter report photo" style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 16, marginTop: 12 }} />
            )}
            <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
              {Object.entries(report.itemCounts).map(([category, count]) => (
                <div key={category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: C.muted }}>{category}</span>
                  <strong>{count} reported · {cleanedCounts[category] ?? 0} remaining</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {cleanupCount > 0 && (
          <Callout title="Recorded cleanup" tone="reassurance" icon={<Check color={C.green} />}>
            {cleanupCount} cleanup {cleanupCount === 1 ? 'action is' : 'actions are'} linked to this event. The result records activity and does not claim full beach cleanliness or ecological recovery.
          </Callout>
        )}

        {event && <div className="i2-share-grid">
          <a href={`https://wa.me/?text=${encodeURIComponent(`${beachName} cleanup · ${link}`)}`} target="_blank" rel="noreferrer" className="btn-ghost press i2-share-button">WhatsApp</a>
          <button type="button" className="btn-ghost press i2-share-button" onClick={systemShare}>Share…</button>
          <button type="button" className={`btn-primary press i2-share-button${copied ? ' i2-copy-success' : ''}`} onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>}

        <div className="i2-action-stack">
          {event && !user && (
            <PrimaryButton onClick={() => nav(`/identity?next=${encodeURIComponent(sharePath)}`)}>{canClean ? 'Join to clean up' : 'Sign in to join'}</PrimaryButton>
          )}
          {event && user && !joined && (
            <PrimaryButton onClick={joinEvent}>{user ? 'Join this activity' : 'Join to clean up'}</PrimaryButton>
          )}
          {event && user && joined && !checkedIn && (
            <PrimaryButton onClick={() => nav(`/events/${event.id}/check-in?next=${encodeURIComponent(sharePath)}`)}>Check in to continue</PrimaryButton>
          )}
          {canClean && (!event || (user && joined && checkedIn)) && user && (
            <PrimaryButton onClick={() => nav(`/cleanup/${report!.beachId}?${event ? `event=${encodeURIComponent(event.id)}&` : ''}target=${encodeURIComponent(report!.id)}`)}>
              Clean up this report
            </PrimaryButton>
          )}
          {canClean && !event && !user && <PrimaryButton onClick={() => nav(`/identity?next=${encodeURIComponent(sharePath)}`)}>Sign in to clean up</PrimaryButton>}
          {!canClean && event && <PrimaryButton onClick={() => nav(eventPath)}>Open event</PrimaryButton>}
          {event && <GhostButton onClick={() => nav(eventPath)}>Back to the event page</GhostButton>}
          {!event && <GhostButton onClick={() => nav('/community')}>View activities</GhostButton>}
        </div>
      </div>
    </div>
  );
}
