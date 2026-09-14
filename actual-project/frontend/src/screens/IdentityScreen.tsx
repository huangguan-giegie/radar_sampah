// Anonymous participant access without personal data.
// A participant ID is public-ish account metadata; the recovery token is the
// secret credential. Both are required to restore an existing account.

import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { C, MONO } from '../theme';
import { ShieldCheck } from '../components/Icon';
import { BackButton, ErrorNote, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import { safeNextPath } from '../flowRules';

function needsParticipantIdentity(path: string) {
  const pathname = path.split('?')[0];
  return pathname === '/reports'
    || pathname.startsWith('/reports/')
    || pathname === '/account'
    || pathname.startsWith('/report/')
    || pathname.startsWith('/cleanup/')
    || pathname === '/platform/events/new'
    || /^\/events\/[^/]+\/check-in$/.test(pathname);
}

export default function IdentityScreen() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const { createId, restore } = useApp();

  const [mode, setMode] = useState<'new' | 'existing'>(() =>
    next === '/reports' || next.startsWith('/reports/') ? 'existing' : 'new',
  );
  const [typedId, setTypedId] = useState('');
  const [typedToken, setTypedToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSession, setNewSession] = useState<{ participantId: string; recoveryToken?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedRecovery, setSavedRecovery] = useState(false);
  const [downloadRequested, setDownloadRequested] = useState(false);

  const recoveryKitText = newSession
    ? `Radar Sampah recovery details\nParticipant ID: ${newSession.participantId}${newSession.recoveryToken ? `\nRecovery token: ${newSession.recoveryToken}\n\nKeep this file private. The token works like a password.` : ''}`
    : '';

  function downloadRecoveryKit() {
    if (!newSession) return;
    const url = URL.createObjectURL(new Blob([recoveryKitText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `radar-sampah-recovery-${newSession.participantId}.txt`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadRequested(true);
  }

  function goBack() {
    if (newSession?.recoveryToken && !savedRecovery && !window.confirm('Leave without saving your recovery token?')) return;
    if (needsParticipantIdentity(next)) {
      const historyIndex = window.history.state?.idx;
      if (Number.isInteger(historyIndex) && historyIndex > 0) nav(-1);
      else nav('/map');
      return;
    }
    nav(next === '/home' ? '/welcome' : next);
  }

  async function getNewId() {
    setBusy(true);
    setError(null);
    try {
      const session = await createId();
      setNewSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an ID. Please try again.');
    }
    setBusy(false);
  }

  async function useExistingId(e: FormEvent) {
    e.preventDefault();
    const participantId = typedId.trim();
    const recoveryToken = typedToken.trim();
    if (!participantId || !recoveryToken) {
      setError('Enter both your participant ID and recovery token.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await restore(participantId, recoveryToken);
      nav(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in. Check your ID and recovery token.');
    }
    setBusy(false);
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 50 }}>
      <div
        className="anim-fade-up pt-page-lg measure"
        style={{
          paddingInline: 24,
          paddingBottom: 'calc(var(--safe-bottom) + 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <BackButton onClick={goBack} />

        <div>
          <div style={{ fontSize: 31, fontWeight: 640, letterSpacing: '-.8px' }}>
            {newSession ? (newSession.recoveryToken ? 'Save your recovery token' : 'Your participant ID is ready') : mode === 'existing' ? 'Log in' : 'Join without sharing your name'}
          </div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            {newSession
              ? newSession.recoveryToken ? "You won't see this token again after leaving this screen." : 'Keep your participant ID to restore this account.'
              : mode === 'existing'
                ? 'Use your participant ID and recovery token to access your reports.'
                : 'No name, email or phone number required.'}
          </div>
        </div>

        {newSession ? (
          <>
            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 24, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line}`, color: '#9C4237', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.14em' }}>
                KEEP PRIVATE
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', color: C.dim }}>PARTICIPANT ID</div>
                <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, color: C.navy, marginTop: 5, userSelect: 'all' }}>
                  {newSession.participantId}
                </div>
                {newSession.recoveryToken && <>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', color: C.dim, marginTop: 18 }}>RECOVERY TOKEN</div>
                  <div style={{ fontFamily: MONO, fontSize: 15, lineHeight: 1.65, color: C.ink2, marginTop: 5, wordBreak: 'break-word', userSelect: 'all' }}>
                    {newSession.recoveryToken}
                  </div>
                </>}
              </div>
            </div>

            {newSession.recoveryToken && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <GhostButton
                onClick={async () => {
                  if (!navigator.clipboard) return;
                  try {
                    await navigator.clipboard.writeText(recoveryKitText);
                    setCopied(true);
                    setSavedRecovery(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy details'}
              </GhostButton>
              <GhostButton onClick={downloadRecoveryKit}>{downloadRequested ? 'Download again' : 'Download'}</GhostButton>
            </div>}

            {downloadRequested && <p role="status" style={{ margin: '-8px 2px 0', color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
              Check your downloads for the recovery file. If it is not there, try again or use Copy details.
            </p>}

            {newSession.recoveryToken && <label style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '13px 14px', borderRadius: 16, background: C.tint, color: C.ink2, fontSize: 13.5, fontWeight: 620 }}>
              <input
                type="checkbox"
                checked={savedRecovery}
                onChange={(event) => setSavedRecovery(event.target.checked)}
                style={{ width: 20, height: 20, accentColor: C.navy }}
              />
              I have saved my recovery token
            </label>}

            <PrimaryButton disabled={Boolean(newSession.recoveryToken && !savedRecovery)} onClick={() => nav(next, { replace: true })}>Continue</PrimaryButton>
          </>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: 5,
                background: C.white,
                border: `1px solid ${C.line}`,
                padding: 4,
                borderRadius: 999,
              }}
            >
              <button
                type="button"
                onClick={() => setMode('new')}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 0',
                  borderRadius: 999,
                  background: mode === 'new' ? C.navy : 'transparent',
                  color: mode === 'new' ? C.bg : C.muted,
                  fontSize: 12.5,
                  fontWeight: mode === 'new' ? 650 : 600,
                }}
              >
                Get an ID
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 0',
                  borderRadius: 999,
                  background: mode === 'existing' ? C.navy : 'transparent',
                  color: mode === 'existing' ? C.bg : C.muted,
                  fontSize: 12.5,
                  fontWeight: mode === 'existing' ? 650 : 600,
                }}
              >
                Log in
              </button>
            </div>

            {error && <ErrorNote title="Could not continue" body={error} />}

            {mode === 'new' ? (
              <PrimaryButton onClick={getNewId} disabled={busy}>
                {busy ? 'Creating your ID…' : 'Create participant ID'}
              </PrimaryButton>
            ) : (
              <form onSubmit={useExistingId} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', color: C.dim }}>
                    PARTICIPANT ID
                  </span>
                  <input
                    className="field"
                    inputMode="numeric"
                    value={typedId}
                    onChange={(e) => setTypedId(e.target.value)}
                    placeholder="1637"
                    style={{
                      background: C.white,
                      border: `1.5px solid ${C.cloud}`,
                      borderRadius: 16,
                      padding: 16,
                      fontSize: 20,
                      fontFamily: MONO,
                      letterSpacing: '.1em',
                      color: C.ink,
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', color: C.dim }}>
                    RECOVERY TOKEN
                  </span>
                  <input
                    className="field"
                    type="password"
                    autoComplete="current-password"
                    value={typedToken}
                    onChange={(e) => setTypedToken(e.target.value)}
                    placeholder="RS-..."
                    style={{
                      background: C.white,
                      border: `1.5px solid ${C.cloud}`,
                      borderRadius: 16,
                      padding: 16,
                      fontSize: 16,
                      fontFamily: MONO,
                      color: C.ink,
                    }}
                  />
                </label>

                <PrimaryButton type="submit" disabled={busy || !typedId.trim() || !typedToken.trim()}>
                  {busy ? 'Checking…' : 'Log in'}
                </PrimaryButton>
              </form>
            )}

            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: C.tint,
                borderRadius: 16,
                padding: '13px 14px',
              }}
            >
              <ShieldCheck style={{ flex: 'none', marginTop: 1 }} />
              <div style={{ fontSize: 12, lineHeight: 1.55, color: C.slate }}>
                Reports use your participant ID, not your name. Exact location stays private.
              </div>
            </div>

            <TextButton onClick={() => nav('/map')} style={{ fontSize: 13.5, color: C.dim, padding: 9 }}>
              Keep browsing without an ID
            </TextButton>
          </>
        )}
      </div>
    </div>
  );
}
