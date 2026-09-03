// The welcome screen. Its one job is to offer two doors:
//
//   "See What's Out There"  -> the map, with no account at all
//   "Count Me In"           -> get a participant number, then the home page
//
// Looking comes first on purpose. Asking a stranger to sign up before they
// have seen anything is the fastest way to lose them, and browsing genuinely
// needs no identity in this app - only filing a report does.
//
// The small line under the two buttons says the same thing in plain words.
// People hesitate at a sign up button because they expect to be asked for an
// email; that line answers it before they have to worry about it.
import { useNavigate } from 'react-router-dom';
import { C, MONO, NOISE } from '../theme';
import { Pin } from '../components/Icon';

export default function WelcomeScreen() {
  const nav = useNavigate();

  return (
    <div
      className="screen"
      style={{
        zIndex: 50,
        background:
          'linear-gradient(172deg,#7FC4DE 0%,#4E9EC936 30%,transparent 60%),radial-gradient(110% 55% at 72% 20%,rgba(221,227,236,.35),transparent 58%),linear-gradient(180deg,#8FD0E8 0%,#4E9EC9 34%,#2E6EA8 52%,#1C4A85 76%,#102E5C 100%)',
      }}
      /* Three stacked layers make the background: a horizon line, a grain
         texture, then a dark wash at the bottom. The wash is not decoration -
         it is what keeps the white text readable over a light sky. */
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 42%,rgba(221,227,236,.22) 47%,rgba(156,174,168,.12) 51%,transparent 60%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, backgroundImage: NOISE }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(9,24,52,.28) 0%,transparent 26%,transparent 55%,rgba(7,20,44,.82) 100%)' }} />

      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--top-inset) + 8px)',
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: '.2em',
          color: 'rgba(9,26,64,.8)',
        }}
      >
        <i style={{ width: 6, height: 6, borderRadius: 3, background: C.lime, display: 'block' }} />
        SELANGOR · STRAIT OF MALACCA
      </div>

      <div
        /* className="measure" caps the text column at 640px and centres it.
           On a phone nothing changes; on a laptop it stops the headline from
           stretching across the whole window, which is unreadable. This one
           class is how the same code serves both, with no separate web build. */
        className="measure"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '24px 24px calc(var(--safe-bottom) + 36px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 41, lineHeight: 1.06, fontWeight: 620, letterSpacing: '-1.2px', color: C.bg }}>
          Your beach walk
          <br />
          can count for something.
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgba(232,238,245,.82)', maxWidth: 310 }}>
          Four Selangor beaches, mapped by volunteers like you. Marine life next door, on the same map.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => nav('/map')}
            className="press"
            style={{
              height: 56,
              borderRadius: 18,
              background: C.bg,
              color: C.navy,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              fontSize: 15.5,
              fontWeight: 650,
              boxShadow: '0 14px 34px -12px rgba(0,0,0,.5)',
            }}
          >
            <Pin size={16} color={C.navy} strokeWidth={2} />
            See What's Out There
          </button>
          <button
            type="button"
            onClick={() => nav('/identity?next=/home')}
            className="press"
            style={{
              height: 56,
              borderRadius: 18,
              background: 'rgba(255,255,255,.12)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255,255,255,.35)',
              color: C.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15.5,
              fontWeight: 600,
            }}
          >
            Count Me In
          </button>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(221,227,236,.7)', lineHeight: 1.5 }}>
            You'll only need an ID when you add something.
          </div>
        </div>
      </div>
    </div>
  );
}
