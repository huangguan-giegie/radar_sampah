import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Shield } from '../components/Icon';
import { Alert, Callout, SectionLabel } from '../components/ds';
import { BackButton, PrimaryButton } from '../components/ui';
import { createAdminEvent, formatEventDate, getCleanupEvent, monitoredBeaches } from '../iteration2';
import { C } from '../theme';

export default function AdminEventScreen() {
  const nav = useNavigate();
  const beaches = monitoredBeaches();
  const [beachId, setBeachId] = useState<string>(beaches[0].id);
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'duplicate' | 'error'; text: string } | null>(null);

  async function create() {
    setMessage(null);
    setSubmitting(true);
    try {
      const id = `${beachId}-${date}`;
      const before = await getCleanupEvent(id);
      const event = await createAdminEvent({ beachId, date });
      if (before) setMessage({ kind: 'duplicate', text: `An activity already exists for ${formatEventDate(event.date)}. No duplicate was created.` });
      else setMessage({ kind: 'success', text: `${event.beachName} · ${formatEventDate(event.date)} was added.` });
    } catch (reason) {
      setMessage({ kind: 'error', text: reason instanceof Error ? reason.message : 'Could not create the activity.' });
    } finally {
      setSubmitting(false);
    }
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

        <Callout title="Administrator access" tone="quiet" icon={<Shield color={C.navy} />}>
          This page is not linked from the participant app. The signed-in account role controls access.
        </Callout>

        <div className="i2-card">
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: 7, color: C.muted, fontSize: 11.5 }}>Beach</span>
            <select className="i2-field" value={beachId} onChange={(event) => setBeachId(event.target.value)}>
              {beaches.map((beach) => <option key={beach.id} value={beach.id}>{beach.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'block', marginTop: 13 }}>
            <span style={{ display: 'block', marginBottom: 7, color: C.muted, fontSize: 11.5 }}>Date</span>
            <input className="i2-field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <PrimaryButton onClick={create} disabled={!date || submitting} height={50} style={{ marginTop: 15 }}>{submitting ? 'Creating…' : 'Create activity'}</PrimaryButton>
        </div>

        {message?.kind === 'success' && <Callout title="Activity created" tone="reassurance" icon={<Check color={C.green} />}>{message.text}</Callout>}
        {message?.kind === 'duplicate' && <Alert title="Date already used" tone="caution">{message.text}</Alert>}
        {message?.kind === 'error' && <Alert title="Activity not created" tone="error">{message.text}</Alert>}
      </div>
    </div>
  );
}
