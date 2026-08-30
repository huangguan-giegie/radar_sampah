import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { C } from '../theme';


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
