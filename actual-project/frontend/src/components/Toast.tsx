import { C } from '../theme';

/**
 * The small message bar at the bottom of the screen.
 *
 * role="status" makes a screen reader announce it when it appears, without
 * stealing focus. A message that only exists as pixels is invisible to anyone
 * not looking at that corner of the screen.
 *
 * pointerEvents: 'none' lets taps pass straight through it. It floats over the
 * page, and it must never swallow a press meant for the button underneath.
 *
 * It is for confirmations only. Anything the user has to act on gets a real
 * error panel that stays put - a message that vanishes after two seconds is no
 * place to explain something that needs fixing.
 */
export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 98,
        zIndex: 70,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        className="anim-fade-up"
        style={{
          background: 'rgba(12,24,52,.93)',
          color: C.bg,
          fontSize: 12.5,
          fontWeight: 600,
          padding: '11px 18px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 12px 30px -8px rgba(7,18,40,.5)',
        }}
      >
        <i style={{ width: 6, height: 6, borderRadius: 3, background: C.lime, display: 'block' }} />
        {message}
      </div>
    </div>
  );
}
