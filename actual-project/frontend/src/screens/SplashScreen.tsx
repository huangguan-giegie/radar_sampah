// The opening screen: the logo, then straight on to /welcome.
//
// It is a screen, not a loading screen. Nothing is being fetched here. It
// exists so the app opens with its name and its purpose instead of dropping a
// first-time visitor into a map of dots with no explanation.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, MONO } from '../theme';

// One expanding circle of the radar animation. Written as a function so the
// three rings differ only in when they start and how strong they are - the
// staggered delays are what make it read as a pulse going outwards.
const ring = (delay: string, opacity: number): React.CSSProperties => ({
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  border: `1px solid rgba(184,255,54,${opacity})`,
  animation: `ripple 3.2s ease-out ${delay} infinite`,
});

export default function SplashScreen() {
  const nav = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => nav('/welcome', { replace: true }), 2600);
    // Clearing the timer on unmount matters: if the user taps through first,
    // this would otherwise fire later and yank them off whatever page they had
    // reached by then.
    return () => window.clearTimeout(t);
  }, [nav]);

  return (
    // The whole screen is a <button>, not a <div> with onClick. That gives
    // us keyboard focus and Enter for free, so a returning user does not have
    // to sit through the animation. replace: true keeps the splash out of the
    // history, or Back from /welcome would land on it again and again.
    <button
      type="button"
      onClick={() => nav('/welcome', { replace: true })}
      className="screen"
      style={{
        zIndex: 60,
        background:
          'radial-gradient(120% 90% at 50% 8%,#153A6E 0%,#081739 55%,#0B1F45 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <div style={{ position: 'relative', width: 190, height: 190, marginBottom: 40 }}>
        <div style={ring('0s', 0.55)} />
        <div style={ring('1.1s', 0.4)} />
        <div style={ring('2.2s', 0.3)} />
        <div style={{ position: 'absolute', inset: 22, borderRadius: '50%', border: '1px solid rgba(221,227,236,.14)' }} />
        <div style={{ position: 'absolute', inset: 48, borderRadius: '50%', border: '1px solid rgba(221,227,236,.1)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'conic-gradient(from 0deg,rgba(184,255,54,.22),transparent 110deg)',
              animation: 'spin 5s linear infinite',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 9,
            height: 9,
            margin: -4.5,
            borderRadius: '50%',
            background: C.lime,
            boxShadow: '0 0 18px rgba(184,255,54,.8)',
          }}
        />
        <div style={{ position: 'absolute', left: '31%', top: '36%', width: 5, height: 5, borderRadius: '50%', background: C.faint, animation: 'pulseDot 2.6s ease infinite' }} />
        <div style={{ position: 'absolute', left: '64%', top: '60%', width: 5, height: 5, borderRadius: '50%', background: C.faint, animation: 'pulseDot 2.6s ease .9s infinite' }} />
      </div>
      <div style={{ fontSize: 31, fontWeight: 650, letterSpacing: '-.5px', color: C.bg }}>
        Radar Sampah
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.24em', color: C.faint, marginTop: 10 }}>
        SEE IT · REPORT IT · CORRECT IT
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(var(--safe-bottom) + 46px)',
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: '.18em',
          color: 'rgba(221,227,236,.45)',
        }}
      >
        COMMUNITY COASTAL MONITORING — SELANGOR
      </div>
    </button>
  );
}
