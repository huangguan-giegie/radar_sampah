import { useNavigate, useParams } from 'react-router-dom';
import { CoastalPage, DataUnavailable, WhiteCard } from '../components/CoastalUI';
import { PrimaryButton, GhostButton, Skeleton } from '../components/ui';
import { fetchCleanupEvent } from '../iteration2Api';
import { formatEventDate, formatEventTimeRange } from '../iteration2';
import { useAsyncData } from '../useAsyncData';
import { eventPhase, useEventClock } from '../eventAvailability';
import { beachPhoto } from '../visuals';

/** A public invitation; opening it never creates a registration or share token. */
export default function SharedEventScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const now = useEventClock();
  const { data: event, loading, error, refresh } = useAsyncData(() => fetchCleanupEvent(eventId), [eventId], null);
  if (loading) return <CoastalPage title="Cleanup Invitation" back="/home" tabs={false}><Skeleton h={260} /></CoastalPage>;
  if (!event) return <CoastalPage title="Cleanup Invitation" back="/home" tabs={false}>
    <DataUnavailable title="Activity not found" retry={error ? () => void refresh() : undefined}>{error ?? 'This invitation is no longer available.'}</DataUnavailable>
  </CoastalPage>;
  const photo = beachPhoto(event.beachId);
  const ended = eventPhase(event, now) === 'ended';
  return <CoastalPage title="You’re Invited" back="/home" tabs={false}>
    <WhiteCard className="event-invitation">
      {photo && <img className="invitation-photo" src={photo} alt={event.beachName} />}
      <p className="eyebrow">Community Cleanup</p>
      <h2>{event.beachName}</h2>
      <p>{formatEventDate(event.date)} · {formatEventTimeRange(event.startsAt, event.endsAt)}</p>
      <p className="subtle">{event.area}</p>
      {event.meetingPoint && <p><strong>Meet at:</strong> {event.meetingPoint}</p>}
      <p className="subtle">{ended ? 'This activity has ended. You can still view its details.' : 'Join the community to care for our coast and marine life.'}</p>
      <PrimaryButton height={46} onClick={() => nav('/events/' + encodeURIComponent(event.id))}>{ended ? 'View Activity' : 'See Details & Join'}</PrimaryButton>
      <GhostButton height={44} onClick={() => nav('/beach/' + encodeURIComponent(event.beachId))}>Explore This Beach</GhostButton>
    </WhiteCard>
  </CoastalPage>;
}
