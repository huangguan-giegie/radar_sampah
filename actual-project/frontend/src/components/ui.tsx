// 反复用到的小组件：主按钮、次按钮、返回键、步骤标签、卡片等等。
// 都是最普通的 div/button + 内联样式，没有用 CSS 框架。
import type { CSSProperties, ReactNode } from 'react';
import { C, MONO } from '../theme';
import { ArrowRight, ChevronLeft } from './Icon';

export function PrimaryButton({
  children,
  onClick,
  disabled,
  height = 56,
  trailingArrow = false,
  type = 'button',
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  height?: number;
  trailingArrow?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={disabled ? 'press' : 'btn-primary press'}
      style={{
        height,
        borderRadius: 18,
        background: disabled ? '#8794AD' : C.navy,
        color: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        fontSize: 15.5,
        fontWeight: 650,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 16px 32px -14px rgba(11,33,97,.55)',
        width: '100%',
        ...style,
      }}
    >
      {children}
      {trailingArrow && <ArrowRight />}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  height = 54,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-ghost press"
      style={{
        height,
        borderRadius: 18,
        background: C.white,
        border: `1.5px solid ${C.line2}`,
        color: C.navy,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        fontWeight: 620,
        width: '100%',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function TextButton({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="link-hover"
      style={{
        textAlign: 'center',
        fontSize: 13.5,
        color: C.muted,
        padding: 8,
        fontWeight: 600,
        width: '100%',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** 圆形返回键。dark 用在图片/地图背景上。 */
export function BackButton({
  onClick,
  dark = false,
  style,
}: {
  onClick: () => void;
  dark?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="press"
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        flex: 'none',
        background: dark ? 'rgba(12,24,52,.5)' : C.white,
        backdropFilter: dark ? 'blur(10px)' : undefined,
        border: dark ? '1px solid rgba(255,255,255,.2)' : `1px solid ${C.line}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        ...style,
      }}
    >
      <ChevronLeft color={dark ? C.bg : C.ink2} />
    </button>
  );
}

/** 「STEP 1 OF 3 · PHOTO」这类等宽小标签 */
export function StepBadge({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: '.14em',
        color: dark ? C.cloud : C.slate,
        background: dark ? 'rgba(12,24,52,.5)' : C.white,
        backdropFilter: dark ? 'blur(10px)' : undefined,
        border: dark ? 'none' : `1px solid ${C.line}`,
        minHeight: 28,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 13px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: '.16em',
        color: C.dim,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  style,
  onClick,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  className?: string;
}) {
  const base: CSSProperties = {
    background: C.white,
    border: `1px solid ${C.line}`,
    borderRadius: 24,
    ...style,
  };
  if (!onClick) return <div className={className} style={base}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={className} style={{ ...base, width: '100%', cursor: 'pointer' }}>
      {children}
    </button>
  );
}

/** 加载中占位 —— 骨架条 */
export function Skeleton({ h = 16, w = '100%', r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: r,
        background: 'rgba(11,33,97,.06)',
        animation: 'fadeIn .3s ease',
      }}
    />
  );
}

export function ErrorNote({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        background: 'rgba(196,87,74,.09)',
        border: '1px solid rgba(196,87,74,.25)',
        borderRadius: 18,
        padding: '14px 15px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: C.red }}>{title}</div>
        {body && (
          <div style={{ fontSize: 12, color: '#8A5049', marginTop: 3, lineHeight: 1.5 }}>{body}</div>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{ fontSize: 12, fontWeight: 700, color: C.red, whiteSpace: 'nowrap' }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
