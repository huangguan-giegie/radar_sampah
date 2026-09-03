

// The small pieces used again and again: primary button, secondary button,
// back button, step badge, card, skeleton, error panel.
//
// WHY THEY LIVE HERE. Every one of these appears on five or more screens. Kept
// in one file, a button is 56px tall everywhere and a change lands everywhere
// at once. Copied into each screen, they drift within a week, and the app
// starts to look like several apps.
//
// They are plain div and button elements with inline styles. No CSS framework:
// nothing to install, nothing extra to download, and no class names to learn
// before you can read a screen. The shared design tokens are in theme.ts.
//
// Everything here is a real <button> when it is clickable. That is what gives
// us keyboard focus, Enter and Space, and the right announcement to a screen
// reader - all of which a clickable <div> silently throws away.
import type { CSSProperties, ReactNode } from 'react';
import { C, MONO } from '../theme';
import { ArrowRight, ChevronLeft } from './Icon';

/**
 * The main action on a screen. There is at most one per screen, so the answer
 * to "what do I do here?" is never ambiguous.
 *
 * The disabled state is a real `disabled` attribute, not just grey styling, so
 * the button cannot be triggered by keyboard or by a double tap either.
 */
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

/** A secondary action. Same size and shape as the primary button, but
 *  outlined instead of filled - equally reachable, visibly not the default. */
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

/** The quietest action: text only. For "Choose Another Beach" or "Back to
 *  details" - things a user may want, but which must not compete with the main
 *  button. Still a real button, so it is still reachable by keyboard. */
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


/**
 * The round back button.
 *
 * `dark` is for screens where it sits over a photo or a map: it adds a
 * translucent dark disc behind the arrow. Without it the arrow can vanish
 * completely over bright sand, and the user has no visible way back.
 *
 * 44px square. That is the smallest target a thumb hits reliably on a phone,
 * and this is the control a user reaches for when they are lost.
 *
 * aria-label="Back" because there is no text inside - a screen reader would
 * otherwise announce it as just "button".
 */
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
        width: 44,
        height: 44,
        borderRadius: 22,
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


/** The "STEP 1 OF 3 · PHOTO" badge. It is on every screen of the report flow
 *  so the user always knows how far in they are and how much is left - the
 *  main reason people abandon a form is not knowing how long it goes on. */
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

/** A small monospaced section heading. Used for every section title in the
 *  app, so the visual rhythm of the pages comes from one definition. */
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
  // A div when it does nothing, a button when it does. This is the point of
  // the component: a card that reacts to a click must be reachable by keyboard,
  // and a card that does not must not take focus and pretend it is actionable.
  if (!onClick) return <div className={className} style={base}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={className} style={{ ...base, width: '100%', cursor: 'pointer' }}>
      {children}
    </button>
  );
}


/** A grey placeholder bar shown while data loads.
 *
 *  Why not a spinner: a skeleton takes up the same room the real content will,
 *  so the page does not jump when the data arrives - and the user can already
 *  see the shape of what is coming. */
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

/**
 * The red panel used for every recoverable error in the app.
 *
 * Three parts, and the shape is the point: a title saying what failed, a body
 * saying what it means for the user, and a Retry button so there is something
 * to DO about it. An error with no way forward just tells somebody they are
 * stuck.
 *
 * The body text on each screen is written to answer the user's real question -
 * on the beach list it is "your photo is safe", because that is what they are
 * actually worried about.
 *
 * role="alert" makes a screen reader announce the panel the moment it appears.
 * Colour alone reaches nobody who cannot see it. tabIndex={-1} is not for
 * tabbing - it lets a screen move focus onto the panel in code, so the next
 * thing the user hears is what went wrong.
 */
export function ErrorNote({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      tabIndex={-1}
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
