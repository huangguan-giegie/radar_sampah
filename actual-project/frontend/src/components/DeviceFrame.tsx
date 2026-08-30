import type { ReactNode } from 'react';
import { C } from '../theme';






export function DeviceFrame({ children }: { children: ReactNode }) {
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
