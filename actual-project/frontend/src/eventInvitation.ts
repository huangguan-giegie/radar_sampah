import type { CleanupEvent } from './iteration2';
import { formatEventDate, formatEventTimeRange } from './iteration2';

/** Events are public. Invite URLs use their public ID, never an auth/share JWT. */
export function eventInvitationPath(eventId: string): string {
  return '/j/' + encodeURIComponent(eventId);
}

export function eventInvitationText(event: Pick<CleanupEvent, 'beachName' | 'date' | 'startsAt' | 'endsAt'>, url: string): string {
  return `You’re invited to the ${event.beachName} Cleanup!\nJoin us on ${formatEventDate(event.date)} at ${formatEventTimeRange(event.startsAt, event.endsAt)}. Help care for our coast and marine life.\n\nSee details and join: ${url}`;
}
