// 匿名参与者编号。
//
// 不收集姓名、邮箱、密码 —— 用户只拿到一个 4 位编号（比如 1637），
// 记录就挂在这个编号下面。换设备时把编号输回去就行。

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
  const [newId, setNewId] = useState<string | null>(null); // 刚领到的编号

  // 领一个新编号
  async function getNewId() {
    setBusy(true);
    setError(null);
    try {
      const id = await createId();
      setNewId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an ID. Please try again.');
    }
    setBusy(false);
  }

  // 用已有编号继续
  async function useExistingId(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await restore(typedId.trim());
      nav(next, { replace: true });
    } catch (err) {
      // 500 或断网也走这里 —— 不能一律告诉用户是号码写错了
      setError(err instanceof Error ? err.message : 'Could not use that ID. Please check the number.');
    }
    setBusy(false);
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 50 }}>
      <div
        className="anim-fade-up pt-page-lg"
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
          // 领到编号之后：把号显示出来，让用户记一下
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
          <>
            {/* 两个选项：领新号 / 用旧号 */}
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
