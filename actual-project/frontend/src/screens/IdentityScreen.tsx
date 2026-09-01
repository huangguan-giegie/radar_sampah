
// The anonymous participant number - this app's entire idea of an account.
//
// We collect no name, no email, no phone and no password. The user is given a
// four digit number such as 1637, and their reports hang off that number. On a
// new device they type the number back in.
//
// WHY - two reasons, and both are worth saying out loud in a review.
// Privacy: data we never collect cannot be leaked, subpoenaed or sold, and
// litter reports carry locations, so the less we know about who filed them the
// better. Take-up: our user is a volunteer standing on a beach in the sun.
// A sign-up form with email verification is where that person gives up.
//
// The trade-off is real and we do not hide it: lose the number and you lose
// access to your past reports. The screen says so in plain words, twice.
//
// Two pieces of copy further down are load-bearing, so please do not soften
// them. The shield note says a report carries only the participant number, the
// beach, and what was recorded - never the exact location. That is a real
// rule, not a slogan: it is enforced in flowRules.ts and by the backend
// stripping EXIF, and it is shown here, at the moment we ask for an identity,
// rather than buried in a policy page. The "Forgot it?" line says exactly what
// is lost and what is not - the old reports are not deleted, they still count
// for their beach, only the link to this person is gone. Vaguer wording there
// would read as "your work was thrown away".

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
  // The number we have just issued. While it is null we show the two choices;
  // once it is set we show the number itself and nothing else. It is a piece
  // of state and not a separate route on purpose - a user must not be able to
  // reach "here is your number" again with the back button, because the number
  // shown would no longer be the one they were given.
  const [newId, setNewId] = useState<string | null>(null);


  // Ask for a new number.
  async function getNewId() {
    setBusy(true);
    setError(null);
    try {
      const id = await createId();
      // Note we do NOT navigate away here. The user has to see the number and
      // write it down first - jumping straight to the home page would lose it
      // before they ever read it.
      setNewId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an ID. Please try again.');
    }
    setBusy(false);
  }


  // Continue with a number the user already has.
  //
  // The field that feeds this is inputMode="numeric", not type="number". The
  // number input adds spinner arrows, and it silently strips a leading zero -
  // which would turn a valid ID into a different, wrong one before we ever
  // send it.
  async function useExistingId(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await restore(typedId.trim());
      // Back to wherever they were heading before we asked them to sign in.
      // replace, so Back does not return them to this login screen.
      nav(next, { replace: true });
    } catch (err) {
      // A server error or a dead connection also lands here, so we must not
      // blame the user's typing every time. The message from the API is
      // preferred, and "check the number" is only the last resort.
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
          // After the number is issued: show it big, and say to write it down.
          // That warning is the honest cost of having no password. It is
          // repeated on the Account page, because a user who skips it here has
          // no other way to recover their reports.
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
                  // userSelect: 'all' means one tap selects the whole number,
                  // so it can be copied without fiddly text dragging.
                  userSelect: 'all',
                }}
              >
                {newId}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: C.mist, marginTop: 12 }}>
                Write it down — you'll need it on another device.
              </div>
            </div>

            <PrimaryButton onClick={() => nav(next, { replace: true })}>Continue</PrimaryButton>

            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: C.dim, textAlign: 'center' }}>
              Your ID is always shown on the Account page.
            </div>
          </>
        ) : (
          // No number yet. Two choices: get one, or use one you already have.
          // A segmented control rather than two separate pages, so a user who
          // picked the wrong one can switch back without losing what they
          // typed. This branch also ends with a way out that is not the back
          // button - someone who arrived from a deep link should still be able
          // to just look around.
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

                <div style={{ fontSize: 12, lineHeight: 1.55, color: C.dim, textAlign: 'center' }}>
                  Forgot it? Get a new ID — your old reports still count toward their beach, but you can't open them again.
                </div>
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
