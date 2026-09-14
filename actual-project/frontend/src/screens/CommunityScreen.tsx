import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from '../components/Icon';
import { EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { useApp } from '../AppContext';
import { formatEventDate, listCleanupEvents } from '../iteration2';
import { C } from '../theme';

export default function CommunityScreen() {
  const nav = useNavigate();
  const { user } = useApp();
  const [filter, setFilter] = useState<'All' | 'Joined'>('All');
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listCleanupEvents>>>([]);
  useEffect(() => {
    let active = true;
    listCleanupEvents(user?.participantId, filter === 'Joined')
      .then((rows) => { if (active) setEvents(rows); })
      .catch(() => { if (active) setEvents([]); });
    return () => { active = false; };
  }, [user?.participantId, filter]);
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
          <h1 className="i2-title" style={{ marginTop: 7 }}>Community Cleanups</h1>
          <p className="i2-subtitle">
            Choose an upcoming Saturday activity. Extra dates added by the platform team appear here too.
          </p>
        </div>

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
              {value === 'All' ? 'All activities' : 'Joined'}
            </button>
          ))}
        </div>

        {events.length === 0 ? (
          <EmptyState
            title="No joined cleanups yet"
            body={user ? 'Join an activity and it will appear here.' : 'Log in, then join an activity to keep it in this list.'}
            action={user ? 'Show all activities' : 'Log in'}
            onAction={() => user ? setFilter('All') : nav(`/identity?next=${encodeURIComponent('/community')}`)}
          />
        ) : (
          Object.entries(grouped).map(([date, rows]) => (
            <section key={date} aria-labelledby={`events-${date}`}>
              <SectionLabel size="sm" style={{ margin: '3px 4px 9px' }}>
                <span id={`events-${date}`}>{formatEventDate(date).toUpperCase()}</span>
              </SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {rows.map((event) => {
                  const day = event.date.slice(8, 10);
                  const weekday = formatEventDate(event.date).slice(-4, -1).toUpperCase();
                  const joined = Boolean(user && event.joinedBy.includes(user.participantId));
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
                        <span style={{ display: 'block', fontSize: 15, fontWeight: 720, color: C.ink2 }}>{event.beachName}</span>
                        <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, color: C.muted }}>
                          {event.startsAt}–{event.endsAt} · {event.area}
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
          ))
        )}
      </div>
    </div>
  );
}
