import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { USE_MOCK } from '../api';
import { useApp } from '../AppContext';
import { Alert as AlertIcon, Check } from '../components/Icon';
import { Alert, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { formatEventDate, listCleanupEvents, monitoredBeaches, type CleanupEvent } from '../iteration2';
import { createAdminEventData, fetchCleanupEvent, fetchCleanupEvents } from '../iteration2Api';
import { C } from '../theme';
import { useAsyncData } from '../useAsyncData';
import { SignedInBanner } from './AdminAccessDeniedScreen';

// The caution pair from ds.css (--ds-caution / --ds-caution-bg). Written out
// because an SVG stroke attribute cannot read a CSS variable.
const CAUTION = '#8A6420';
const CAUTION_BG = '#FFF5DC';

// How many upcoming days are offered as one-tap choices. A week always holds
// one Saturday, so the admin sees at least one date the weekly schedule has
// already taken. Anything later is still reachable through "Another date".
const CANDIDATE_DAYS = 7;

/** A date as YYYY-MM-DD in Malaysia. Activities happen on local dates, so a
 *  laptop set to another time zone must not shift the list by a day. */
function malaysiaDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function candidateDates(): string[] {
  const noon = new Date(`${malaysiaDay(new Date())}T12:00:00+08:00`).getTime();
  return Array.from({ length: CANDIDATE_DAYS }, (_, index) => malaysiaDay(new Date(noon + (index + 1) * 86_400_000)));
}

type Availability = 'TAKEN' | 'FREE' | null;
type Outcome = { kind: 'created' | 'duplicate'; event: CleanupEvent };

export default function AdminEventScreen() {
  const nav = useNavigate();
  const { user } = useApp();
  const beaches = monitoredBeaches();
  const [dates] = useState(candidateDates);
  const [beachId, setBeachId] = useState<string>(beaches[0].id);
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const outcomeRef = useRef<HTMLElement>(null);
  const dateGroupRef = useRef<HTMLDivElement>(null);
  const returningToForm = useRef(false);

  // The schedule is loaded up front so a clash shows on the date itself,
  // before the button is pressed - not as a surprise afterwards.
  const { data: events, error: eventsError, refresh: refreshEvents } = useAsyncData(
    () => fetchCleanupEvents(),
    [],
    USE_MOCK ? listCleanupEvents() : [],
  );

  const beach = beaches.find((item) => item.id === beachId) ?? beaches[0];
  const laterDate = date && !dates.includes(date) ? date : '';

  // An unknown schedule shows no chip at all. Guessing FREE would invite the
  // clash this list exists to prevent.
  function availability(day: string): Availability {
    if (!events || eventsError) return null;
    return events.some((event) => event.beachId === beachId && event.date === day) ? 'TAKEN' : 'FREE';
  }

  // The form is replaced by the result card, so the button that had focus is
  // gone. Move focus to what replaced it, and back to the dates on return, so
  // a keyboard or screen reader user is not dropped at the top of the page.
  useEffect(() => {
    if (outcome) {
      outcomeRef.current?.focus();
    } else if (returningToForm.current) {
      returningToForm.current = false;
      dateGroupRef.current?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus();
    }
  }, [outcome]);

  async function create() {
    if (!date || saving) return;
    setError(null);
    setSaving(true);
    try {
      const before = await fetchCleanupEvent(`${beachId}-${date}`);
      const takenBefore = Boolean(before) || availability(date) === 'TAKEN';
      const event = await createAdminEventData({ beachId, date });
      setOutcome({ kind: takenBefore ? 'duplicate' : 'created', event });
      void refreshEvents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the activity.');
    } finally {
      setSaving(false);
    }
  }

  function pickAnotherDate() {
    returningToForm.current = true;
    setDate('');
    setError(null);
    setOutcome(null);
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 28 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav('/community')} />
        <div>
          <SectionLabel size="sm">PLATFORM CONSOLE</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>Create an activity</h1>
          <p className="i2-subtitle">Add one extra date. Weekly Saturday activities are created automatically.</p>
        </div>

        <SignedInBanner tone="admin">
          {user ? `Platform admin · Participant ${user.participantId}` : 'Platform admin'}
        </SignedInBanner>

        {outcome ? (
          <OutcomeCard
            outcome={outcome}
            cardRef={outcomeRef}
            onPickAnother={pickAnotherDate}
            onOpen={() => nav(`/events/${outcome.event.id}`)}
          />
        ) : (
          <>
            <div>
              <ChoiceHeader id="admin-beach-label" label="BEACH" readout={beach.name.toUpperCase()} />
              <ChoiceGroup
                labelledBy="admin-beach-label"
                value={beachId}
                onChange={setBeachId}
                options={beaches.map((item) => ({
                  value: item.id,
                  title: item.name,
                  trailing: <span style={{ color: C.muted, fontSize: 11.5, textAlign: 'right' }}>{item.area}</span>,
                }))}
              />
            </div>

            <div>
              <ChoiceHeader id="admin-date-label" label="DATE" />
              <ChoiceGroup
                groupRef={dateGroupRef}
                labelledBy="admin-date-label"
                value={dates.includes(date) ? date : ''}
                onChange={setDate}
                options={dates.map((day) => ({
                  value: day,
                  title: formatEventDate(day),
                  trailing: <AvailabilityChip state={availability(day)} />,
                }))}
              />
              <label style={{ display: 'block', marginTop: 12 }}>
                <span style={{ display: 'block', margin: '0 4px 7px', color: C.muted, fontSize: 11.5 }}>Another date</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input className="i2-field" type="date" value={laterDate} onChange={(event) => setDate(event.target.value)} />
                  {laterDate && <AvailabilityChip state={availability(laterDate)} />}
                </span>
              </label>
              {eventsError && (
                <p style={{ margin: '9px 4px 0', color: C.muted, fontSize: 11.5, lineHeight: 1.45 }}>
                  Could not check which dates are taken. Choosing a taken date still creates nothing new.
                </p>
              )}
            </div>

            <PrimaryButton onClick={create} disabled={!date || saving}>
              {saving ? 'Creating…' : date ? 'Create activity' : 'Select a date'}
            </PrimaryButton>

            {error && <Alert title="Activity not created" tone="error">{error}</Alert>}
          </>
        )}
      </div>
    </div>
  );
}

function ChoiceHeader({ id, label, readout }: { id: string; label: string; readout?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, margin: '0 4px 8px' }}>
      <SectionLabel size="sm"><span id={id}>{label}</span></SectionLabel>
      {readout && <SectionLabel size="sm">{readout}</SectionLabel>}
    </div>
  );
}

/**
 * A single-choice list drawn as full-width rows. It is a real radio group -
 * one tab stop, arrow keys move the choice - because a native select hides
 * the area names and availability chips that make the choice obvious.
 */
function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
  groupRef,
}: {
  options: { value: T; title: ReactNode; trailing?: ReactNode }[];
  value: T | '';
  onChange: (value: T) => void;
  labelledBy: string;
  groupRef?: RefObject<HTMLDivElement>;
}) {
  const selectedIndex = options.findIndex((option) => option.value === value);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    const next = (Math.max(current, 0) + step + radios.length) % radios.length;
    radios[next]?.focus();
    onChange(options[next].value);
  }

  return (
    <div ref={groupRef} role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown} style={{ display: 'grid', gap: 7 }}>
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (selectedIndex === -1 && index === 0) ? 0 : -1}
            className="press"
            onClick={() => onChange(option.value)}
            style={{
              width: '100%',
              minHeight: 46,
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 12,
              padding: '9px 14px',
              borderRadius: 14,
              border: `1px solid ${checked ? C.navy : C.line2}`,
              background: checked ? C.tint : C.white,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: checked ? C.navy : C.cloud }} />
            <span style={{ color: C.ink2, fontSize: 14, fontWeight: 700 }}>{option.title}</span>
            {option.trailing ?? <span />}
          </button>
        );
      })}
    </div>
  );
}

function AvailabilityChip({ state }: { state: Availability }) {
  if (state === 'TAKEN') return <InfoChip color={CAUTION} background={CAUTION_BG}>TAKEN</InfoChip>;
  if (state === 'FREE') return <InfoChip color={C.green} background={C.greenBg}>FREE</InfoChip>;
  return <span />;
}

/** What happened, and the two sensible next steps: another date, or the
 *  activity itself - the new one, or the one that was already there. */
function OutcomeCard({
  outcome,
  cardRef,
  onPickAnother,
  onOpen,
}: {
  outcome: Outcome;
  cardRef: RefObject<HTMLElement>;
  onPickAnother: () => void;
  onOpen: () => void;
}) {
  const created = outcome.kind === 'created';
  const { event } = outcome;
  const body = { margin: 0, color: C.muted, fontSize: 13, lineHeight: 1.5 } as const;
  // Two buttons share one phone-width row, so they get less side padding than
  // a full-width button; otherwise "Pick another date" breaks over two lines.
  const halfWidth = { padding: '11px 10px', fontSize: 14 } as const;
  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      aria-labelledby="admin-outcome-title"
      aria-describedby="admin-outcome-body"
      className="i2-card"
      style={{ outline: 'none', borderColor: created ? 'rgba(23,122,62,.28)' : 'rgba(138,100,32,.28)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          aria-hidden="true"
          style={{ width: 38, height: 38, borderRadius: 19, background: created ? C.greenBg : CAUTION_BG, display: 'grid', placeItems: 'center', flex: 'none' }}
        >
          {created ? <Check color={C.green} /> : <AlertIcon color={CAUTION} />}
        </span>
        <h2 id="admin-outcome-title" style={{ margin: 0, color: C.ink2, fontSize: 17, fontWeight: 720 }}>
          {created ? 'Activity created' : 'Already scheduled'}
        </h2>
      </div>
      <div id="admin-outcome-body" style={{ marginTop: 10 }}>
        {created ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: C.muted, fontSize: 13 }}>
              <span>{event.beachName}</span>
              <span>{formatEventDate(event.date)}</span>
            </div>
            <p style={{ ...body, marginTop: 6 }}>The activity is now open for volunteers to join.</p>
          </>
        ) : (
          <p style={body}>
            {event.beachName} on {formatEventDate(event.date)} already has an event. Nothing new was created.
          </p>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
        <GhostButton onClick={onPickAnother} height={50} style={halfWidth}>Pick another date</GhostButton>
        <PrimaryButton onClick={onOpen} height={50} style={halfWidth}>Open the event</PrimaryButton>
      </div>
    </section>
  );
}
