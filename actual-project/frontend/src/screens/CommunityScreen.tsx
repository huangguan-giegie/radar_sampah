import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from '../components/Icon';
import { EmptyState, InfoChip, SectionLabel, SeverityBadge } from '../components/ds';
import { useApp } from '../AppContext';
import { getBeaches } from '../api';
import { formatEventDate, formatEventTimeRange, listCleanupEvents, relativeEventWeek } from '../iteration2';
import { fetchCleanupEvents } from '../iteration2Api';
import { useAsyncData } from '../useAsyncData';
import { attentionStateFor, C, MONO } from '../theme';
import type { BeachSummary } from '../types';

export default function CommunityScreen() {
  const nav = useNavigate();
  const { user } = useApp();
  const [filter, setFilter] = useState<'All' | 'Joined'>('All');
  const { data, loading, error } = useAsyncData(
    () => filter === 'Joined' && !user
      ? Promise.resolve([])
      : fetchCleanupEvents(user?.participantId, filter === 'Joined'),
    [user?.participantId, filter],
    listCleanupEvents(user?.participantId, filter === 'Joined'),
  );
  // With the real API the loader starts empty (null) until the first answer
  // arrives; treat that as "no rows yet" instead of crashing the tab.
  const events = data ?? [];
  // The same beach list the map and home screen use. A row shows the beach's
  // band so a volunteer can see where help is most needed before opening it.
  // If this request fails the rows simply go without a band - the schedule
  // itself must still load.
  const { data: beaches } = useAsyncData<BeachSummary[]>(() => getBeaches(), [], []);
  const beachById = useMemo(
    () => new Map((beaches ?? []).map((beach) => [beach.id, beach])),
    [beaches],
  );
  const grouped = useMemo(() => {
    return events.reduce<Record<string, typeof events>>((groups, event) => {
      (groups[event.date] ??= []).push(event);
      return groups;
    }, {});
  }, [events]);

  return (
    <div className="screen scroll-y" style={{ zIndex: 20 }}>
      <div className="measure i2-page anim-fade-up">
        <div>
          <SectionLabel size="sm">COMMUNITY</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 7 }}>
            <h1 className="i2-title">Community Cleanups</h1>
            {/* Only moderators can create activities, so only they see the
                way in. Everyone else would land on an access-denied page. */}
            {user?.role === 'moderator' && (
              <button
                type="button"
                className="press link-hover"
                onClick={() => nav('/platform/events/new')}
                aria-label="Organiser console"
                style={{ flex: 'none', minHeight: 44, padding: '0 4px', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: C.navy }}
              >
                ORGANISER
              </button>
            )}
          </div>
          <p className="i2-subtitle">
            Choose an upcoming Saturday activity. Extra dates added by the platform team appear here too.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div className="i2-chip-row" role="tablist" aria-label="Cleanup activity filter">
            {(['All', 'Joined'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="i2-chip press"
                role="tab"
                aria-selected={filter === value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === 'All' ? 'All dates' : 'Joined'}
              </button>
            ))}
          </div>
          {/* The chips already tell a screen reader which filter is on. */}
          <SectionLabel size="sm" style={{ flex: 'none' }}>
            <span aria-hidden="true">{filter === 'All' ? 'ALL DATES' : 'JOINED'}</span>
          </SectionLabel>
        </div>

        {loading ? (
          <EmptyState title="Loading activities…" body="Checking the latest shared cleanup schedule." />
        ) : error ? (
          <EmptyState title="Couldn't load activities" body={error} action="Show all activities" onAction={() => setFilter('All')} />
        ) : events.length === 0 ? (
          <EmptyState
            title="No joined cleanups yet"
            body={user ? 'Join an activity and it will appear here.' : 'Log in, then join an activity to keep it in this list.'}
            action={user ? 'Show all activities' : 'Log in'}
            onAction={() => user ? setFilter('All') : nav(`/identity?next=${encodeURIComponent('/community')}`)}
          />
        ) : (
          Object.entries(grouped).map(([date, rows]) => {
            const relative = relativeEventWeek(date);
            return (
              <section key={date} aria-labelledby={`events-${date}`}>
                <div
                  id={`events-${date}`}
                  style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '3px 4px 9px' }}
                >
                  {relative && <SectionLabel size="sm" tone="strong">{relative}</SectionLabel>}
                  <SectionLabel size="sm">{formatEventDate(date).toUpperCase()}</SectionLabel>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {rows.map((event) => {
                    const day = event.date.slice(8, 10);
                    const weekday = formatEventDate(event.date).slice(-4, -1).toUpperCase();
                    const joined = Boolean(user && event.joinedBy.includes(user.participantId));
                    const beach = beachById.get(event.beachId);
                    // attentionStateFor decides whether the beach has earned a
                    // band; below the report minimum the badge says so instead.
                    const attention = beach
                      ? attentionStateFor(beach.severity, beach.insufficientData, beach.validReports)
                      : null;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        className="i2-card i2-event-card press card-hover"
                        onClick={() => nav(`/events/${event.id}`)}
                      >
                        <span className="i2-date" aria-hidden="true">
                          <strong>{day}</strong>
                          <span>{weekday}</span>
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 15, fontWeight: 720, color: C.ink2 }}>{event.beachName}</span>
                            {beach && attention && (
                              <SeverityBadge band={attention.hasBand ? beach.severity : null} label={attention.pageLabel} />
                            )}
                          </span>
                          <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, color: C.muted }}>
                            {formatEventTimeRange(event.startsAt, event.endsAt)} · {event.area}
                          </span>
                          <span style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                            <InfoChip>{event.participantCount} joined</InfoChip>
                            {joined && <InfoChip color={C.green} background={C.greenBg}>Joined</InfoChip>}
                            {event.source === 'admin' && <InfoChip>Extra date</InfoChip>}
                          </span>
                        </span>
                        <ChevronRight color={C.navy} />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
