
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
import { BackButton, ErrorNote, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import { safeNextPath } from '../flowRules';

export default function IdentityScreen() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const { createId, restore } = useApp();

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [typedId, setTypedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The number we have just issued. Null means show the two choices; set means
  // show the number and nothing else. State rather than its own route on
  // purpose - Back must not bring "here is your number" up a second time, when
  // the number on screen would no longer be the one they were given.
  const [newId, setNewId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);


  // Ask for a new number.
  async function getNewId() {
    setBusy(true);
    setError(null);
    try {
      const id = await createId();
      // Deliberately no navigation here. The user has to see the number and
      // save it first - moving straight on would lose it before they read it.
      setNewId(id);
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
      await restore(typedId.trim());
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
        <BackButton onClick={() => nav('/welcome')} />

        <div>
          <div style={{ fontSize: 31, fontWeight: 640, letterSpacing: '-.8px' }}>
            Join in — no name needed
          </div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            No name, no email, no phone — ever.
          </div>
        </div>

        {newId ? (
          // The number is issued: show it big, offer a one-tap copy, and press
          // the user to save it. That warning is the honest price of having no
          // password, and the Account page repeats it.
          <>
            <div
              style={{
                background: C.deep,
                borderRadius: 24,
                padding: 24,
                color: C.bg,
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.dim }}>
                YOUR PARTICIPANT ID
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 44,
                  fontWeight: 650,
                  letterSpacing: '.06em',
                  color: C.lime,
                  marginTop: 8,
                  // One tap grabs the whole number, which is how it gets copied
                  // on devices where the button below has no clipboard to use.
                  userSelect: 'all',
                }}
              >
                {newId}
              </div>
              {/* Clipboard writes need a secure context and can still be
                  refused, so the label only flips after a successful write. */}
              <button
                type="button"
                onClick={async () => {
                  if (!navigator.clipboard) return;
                  try {
                    await navigator.clipboard.writeText(newId);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
                style={{
                  marginTop: 10,
                  padding: '7px 11px',
                  borderRadius: 10,
                  border: '1px solid rgba(232,238,245,.28)',
                  color: C.bg,
                  fontSize: 11.5,
                  fontWeight: 650,
                }}
              >
                {copied ? 'Copied' : 'Copy ID'}
              </button>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: C.mist, marginTop: 12 }}>
                Save this number now. You will need it to restore your reports on another device.
              </div>
            </div>

            <PrimaryButton onClick={() => nav(next, { replace: true })}>Continue</PrimaryButton>

            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: C.dim, textAlign: 'center' }}>
              Your ID is always shown on the Account page. If you lose it, a new ID cannot reopen old reports.
            </div>
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
                I have an ID
              </button>
            </div>

            {error && <ErrorNote title="Could not continue" body={error} />}

            {mode === 'new' ? (
              <>
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.line}`,
                    borderRadius: 22,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {[


                    'Your reports stay linked to it, so you can fix them later',
                  ].map((line) => (
                    <div
                      key={line}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: C.ink2,
                      }}
                    >
                      <i
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          background: C.navy,
                          display: 'block',
                          flex: 'none',
                          marginTop: 7,
                        }}
                      />
                      {line}
                    </div>
                  ))}
                </div>

                <PrimaryButton onClick={getNewId} disabled={busy}>
                  {busy ? 'Getting your number…' : 'Get My Number'}
                </PrimaryButton>
              </>
            ) : (
              <form onSubmit={useExistingId} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

                <PrimaryButton type="submit" disabled={busy || !typedId.trim()}>
                  {busy ? 'Checking…' : 'Continue'}
                </PrimaryButton>

                {/* Please do not soften this line. It names what is lost and
                    what is not; vaguer wording reads as "your work was binned",
                    which is not what happens. */}
                <div style={{ fontSize: 12, lineHeight: 1.55, color: C.dim, textAlign: 'center' }}>
                  Forgot it? Get a new ID — your old reports still count toward their beach, but you can't open them again.
                </div>
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
                A report carries only your participant number, the beach, and what you recorded — never your exact location.
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
