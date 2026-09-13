
// The anonymous participant number - this app's whole idea of an account.
// No name, no email, no password. The user gets a four digit number and their
// reports hang off it. Data we never collect cannot leak, and a volunteer
// standing on a beach in the sun will not stop to verify an email address.
// The cost is real, so the screen says it twice: lose the number and the old
// reports still count for their beach, but nobody can reopen them.

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

  // A visit to My Reports usually means the participant already has an ID.
  // Start with the restore form there so it does not look like the only way
  // forward is to create a new account. People without an ID can still switch
  // to Get an ID.
  const [mode, setMode] = useState<'new' | 'existing'>(() =>
    next === '/reports' || next.startsWith('/reports/') ? 'existing' : 'new',
  );
  const [typedId, setTypedId] = useState('');
  const [typedToken, setTypedToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The number we have just issued. Null means show the two choices; set means
  // show the number and nothing else. State rather than its own route on
  // purpose - Back must not bring "here is your number" up a second time, when
  // the number on screen would no longer be the one they were given.
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
    // Let the browser start consuming the Blob before releasing its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadRequested(true);
  }

  function goBack() {
    if (newSession?.recoveryToken && !savedRecovery && !window.confirm('Leave without saving your recovery token?')) return;
    // RequireAuth replaces a protected tab's URL with this page. Going to
    // `next` here would immediately hit RequireAuth again. Return to the
    // actual previous app page when one exists; a directly opened protected
    // link falls back to the public map.
    if (needsParticipantIdentity(next)) {
      const historyIndex = window.history.state?.idx;
      if (Number.isInteger(historyIndex) && historyIndex > 0) nav(-1);
      else nav('/map');
      return;
    }
    nav(next === '/home' ? '/welcome' : next);
  }


  // Ask for a new number.
  async function getNewId() {
    setBusy(true);
    setError(null);
    try {
      const session = await createId();
      // Deliberately no navigation here. The user has to see the number and
      // save it first - moving straight on would lose it before they read it.
      setNewSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an ID. Please try again.');
    }
    setBusy(false);
  }


  // Continue with a number the user already has.
  //
  // The field feeding this is inputMode="numeric", not type="number". A number
  // input silently drops a leading zero, which would send a different ID.
  async function useExistingId(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await restore(typedId.trim(), typedToken.trim());
      // On to wherever they were heading before we asked for an ID. Replace,
      // so Back does not drop them onto this screen again.
      nav(next, { replace: true });
    } catch (err) {
      // A server fault or a dead connection lands here too, so we must not
      // blame the user's typing every time. Prefer the message from the API.
      setError(err instanceof Error ? err.message : 'Could not use that ID. Please check the number.');
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
                ? 'Use your participant ID to view your reports. A recovery token is optional for older accounts.'
                : 'No name, email or phone number required.'}
          </div>
        </div>

        {newSession ? (
          // The number is issued: show it big, offer a one-tap copy, and press
          // the user to save it. That warning is the honest price of having no
          // password, and the Account page repeats it.
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
          // No number yet. A segmented control instead of two separate pages,
          // so someone who picked the wrong side can switch back without losing
          // what they typed. It ends with a way out for people who only want to
          // look around.
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
              <>
                <PrimaryButton onClick={getNewId} disabled={busy}>
                  {busy ? 'Creating your ID…' : 'Create participant ID'}
                </PrimaryButton>
              </>
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
                    RECOVERY TOKEN · OPTIONAL
                  </span>
                  <input
                    className="field"
                    type="password"
                    autoComplete="current-password"
                    value={typedToken}
                    onChange={(e) => setTypedToken(e.target.value)}
                    placeholder="Optional"
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

                <PrimaryButton type="submit" disabled={busy || !typedId.trim()}>
                  {busy ? 'Checking…' : 'Log in'}
                </PrimaryButton>

              </form>
            )}

            {/* A rule, not a slogan: flowRules drops the coordinates and the
                backend strips EXIF. Said here, where we ask for an identity,
                rather than buried in a policy page. */}
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
