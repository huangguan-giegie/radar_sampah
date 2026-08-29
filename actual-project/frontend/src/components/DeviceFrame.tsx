import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { C } from '../theme';

/**
 * Web app 外壳。
 * 每个宽度都铺满窗口；页面自己用 .measure 限宽，见 global.css。
 *
 * 网址上加 ?frame=phone 会把它收成一台 402×874 的手机 —— 给 slide 截图用，
 * 任意页面都能加。除此之外没有任何地方按宽度分叉。
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
