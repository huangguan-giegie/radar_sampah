import type { ReactNode } from 'react';
import { C } from '../theme';

/**
 * Web app 外壳。
 * 手机上铺满视口；桌面上收成一台 402×874 的手机，保持设计稿的构图。
 * 所有屏幕都是 position:absolute 覆盖在这个容器里，滚动交给各自的 .scroll-y。
 */
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
