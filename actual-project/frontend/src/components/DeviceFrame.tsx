import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { C } from '../theme';

/**
 * The shell every screen sits inside.
 *
 * HOW THE SAME CODE SERVES PHONE AND DESKTOP. The shell always fills the
 * window, at every width. It never branches on screen size, and there is no
 * separate mobile build and no device detection anywhere in this project.
 * Instead, each screen caps its own text column with the .measure class (see
 * global.css). So on a phone the column IS the screen, and on a laptop the
 * same column is centred with space around it.
 *
 * That is why "make it work on the web" changed no screen logic: one codebase,
 * one set of components, one behaviour.
 *
 * The one exception is ?frame=phone in the URL, which shrinks the shell to a
 * 402x874 phone. It exists to take screenshots for slides, works on any page,
 * and changes nothing else.
 */
export function DeviceFrame({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  const phoneFrame = new URLSearchParams(search).get('frame') === 'phone';

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(90% 70% at 50% 0%,#F2F5F9 0%,#E7ECF2 60%,#DEE5EE 100%)',
      }}
    >
      <div
        className="app-shell"
        data-frame={phoneFrame ? 'phone' : undefined}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 'var(--shell-w)',
          height: 'var(--shell-h)',
          overflow: 'hidden',
          background: C.bg,
          color: C.ink,
          borderRadius: 'var(--shell-r)',
          boxShadow: 'var(--shell-shadow)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
