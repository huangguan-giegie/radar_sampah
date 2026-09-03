/**
 * The design-system components. All the styling lives in src/styles/ds.css;
 * this file is only a thin wrapper that picks the right class and data
 * attributes.
 *
 * THE RULE: do not restyle these things inside a screen. If you need a variant
 * that does not exist yet, add it HERE and in ds.css, so it exists once and
 * everybody gets it.
 *
 * This rule was written after the fact. The same badge had been rewritten by
 * hand at five different sizes across the app, and "no data" was worded three
 * different ways - so the same state looked like three different states to a
 * user. That is what a design system prevents.
 *
 * Styles are in CSS rather than inline here for a reason: hover, focus and
 * disabled states cannot be expressed in an inline style object at all.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { ReportStatus, SeverityBand } from '../types';
import { severityLabel } from '../theme';

type Div = { children?: ReactNode; style?: CSSProperties; className?: string };

/* ---------- Surface ---------- */
export function Surface({
  children,
  pad = 'padded',
  onClick,
  style,
  className = '',
}: Div & { pad?: 'padded' | 'flush'; onClick?: () => void }) {
  const cls = `ds-surface ${className}`.trim();
  if (onClick) {
    return (
      <button type="button" className={cls} data-pad={pad} onClick={onClick} style={style}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} data-pad={pad} style={style}>
      {children}
    </div>
  );
}


/** A panel nested inside a card: smaller corners, lighter background, so two
 *  levels of grouping stay readable without adding another border. */
export function Nested({ children, style }: Div) {
  return (
    <div className="ds-nested" style={style}>
      {children}
    </div>
  );
}

/* ---------- SectionLabel ---------- */
export function SectionLabel({
  children,
  size = 'md',
  tone,
  style,
}: Div & { size?: 'sm' | 'md' | 'lg'; tone?: 'dark' | 'alert' | 'strong' }) {
  return (
    <div className="ds-label" data-size={size} data-tone={tone} style={style}>
      {children}
    </div>
  );
}

/* ---------- StatusBadge ---------- */

/**
 * The status pill.
 *
 * 'none' means "we have no conclusion yet". It has its own dashed style, used
 * nowhere else in the app, so an absence of evidence can never be mistaken for
 * a low reading. That distinction is the single most important thing this
 * component does.
 */
export type BadgeStatus = Lowercase<SeverityBand> | Lowercase<ReportStatus> | 'none';

export function StatusBadge({
  children,
  status,
  size = 'md',
  indicator = false,
  style,
  block = false,
}: Div & { status: BadgeStatus; size?: 'md' | 'lg'; indicator?: boolean; block?: boolean }) {
  return (
    <span
      className="ds-badge"
      data-status={status}
      data-size={size}
      data-indicator={indicator}
      data-block={block || undefined}
      style={style}
    >
      {children}
    </span>
  );
}


/**
 * The severity badge.
 *
 * A null band means "not enough evidence" and MUST NOT be drawn as Low. This
 * is enforced here, in one place, rather than trusted to every screen that
 * shows a band - it is the mistake that would quietly turn our own data into a
 * claim that an unmonitored beach is clean.
 */
export function SeverityBadge({
  band,
  size = 'md',
  label,
  block = false,
}: {
  band: SeverityBand | null;
  size?: 'md' | 'lg';
  label?: string;

  /** For lists: gives every badge in a column the same width, so their left
   *  edges line up instead of stepping in and out with the word length. */
  block?: boolean;
}) {
  if (!band) {
    return (
      <StatusBadge status="none" size={size} block={block}>
        {label ?? 'No data'}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge status={band.toLowerCase() as BadgeStatus} size={size} indicator block={block}>
      {/* severityLabel(), not the raw band: the data keeps 'Severe' because
          that is the word in the contract, but the user is shown "Very high".
          The translation happens here so every badge in the app gets it. */}
      {label ?? severityLabel(band)}
    </StatusBadge>
  );
}

/* ---------- InfoChip ---------- */

/** A chip that states a FACT - "12 valid reports", "reported 5 days ago" -
 *  never a judgement. It is deliberately styled unlike the severity badge, so
 *  a plain count is not read as a rating. */
export function InfoChip({
  children,
  color,
  background,
  style,
}: Div & { color?: string; background?: string }) {
  return (
    <span
      className="ds-info"
      style={{
        ...(color ? { ['--info-color' as string]: color } : null),
        ...(background ? { ['--info-bg' as string]: background } : null),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ---------- BandMeter ---------- */

/** The four-segment meter next to a severity band. level 0 lights nothing,
 *  which is the "no conclusion" case - not a zero measurement. It repeats the
 *  band as a shape, so the reading survives without colour. */
export function BandMeter({
  level,
  tone,
  size = 'md',
  style,
}: {
  level: 0 | 1 | 2 | 3 | 4;
  tone?: Lowercase<SeverityBand>;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}) {
  return (
    <span className="ds-meter" data-level={level} data-tone={tone} data-size={size} style={style}>
      <i /><i /><i /><i />
    </span>
  );
}

/* ---------- ListRow ---------- */
export function ListRow({
  lead,
  title,
  subtitle,
  trailing,
  onClick,
  disabled = false,
  style,
}: {
  lead?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const inner = (
    <>
      {lead ?? <span />}
      <span style={{ minWidth: 0 }}>
        <span className="ds-row-title" style={{ display: 'block' }}>{title}</span>
        {subtitle && <span className="ds-row-sub" style={{ display: 'block' }}>{subtitle}</span>}
      </span>
      {trailing ?? <span />}
    </>
  );

  // A row that does nothing when clicked must not take keyboard focus. A
  // focusable element that reacts to nothing tells a keyboard or screen reader
  // user that the app is broken.
  if (!onClick || disabled) {
    return (
      <div className="ds-row" aria-disabled={disabled || undefined} style={style}>
        {inner}
      </div>
    );
  }
  return (
    <button type="button" className="ds-row row-hover" onClick={onClick} style={style}>
      {inner}
    </button>
  );
}


/** A label-and-value row, used by the review and result screens. The label
 *  column is a fixed width everywhere, so the values line up in a column
 *  instead of each row starting somewhere different. */
export function KeyRow({
  label,
  value,
  action,
  onAction,
}: {
  label: ReactNode;
  value: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="ds-row" style={{ gridTemplateColumns: '96px minmax(0,1fr) auto' }}>
      <span style={{ fontSize: 13, color: 'var(--ds-muted)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ds-ink)' }}>{value}</span>
      {action && onAction ? (
        <button type="button" onClick={onAction} className="ds-alert-action" style={{ color: 'var(--ds-navy)' }}>
          {action}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

/* ---------- OverlayChip ---------- */
export function OverlayChip({
  children,
  tone = 'dark',
  onClick,
  style,
}: Div & { tone?: 'dark' | 'light'; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" className="ds-chip" data-tone={tone} onClick={onClick} style={style}>
        {children}
      </button>
    );
  }
  return (
    <span className="ds-chip" data-tone={tone} style={style}>
      {children}
    </span>
  );
}

/* ---------- GlassPanel ---------- */
export function GlassPanel({ children, style, className = '' }: Div) {
  return (
    <div className={`ds-glass ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

/* ---------- SegmentedControl ---------- */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone,
  style,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  tone?: 'glass';
  style?: CSSProperties;
}) {
  return (
    <div
      className="ds-seg"
      role="tablist"
      data-tone={tone}
      style={{ ['--segments' as string]: options.length, ...style }}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={o === value}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ---------- Callout ---------- */
export function Callout({
  children,
  title,
  tone = 'neutral',
  icon,
  trailing,
  onClick,
  style,
}: Div & {
  title?: string;
  tone?: 'neutral' | 'reassurance' | 'caution' | 'quiet';
  icon?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon ?? <span />}
      <span className="ds-copy">
        {title && <strong className="ds-callout-title">{title}</strong>}
        {children}
      </span>
      {trailing ?? <span />}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="ds-callout" data-tone={tone} onClick={onClick} style={style}>
        {inner}
      </button>
    );
  }
  return (
    <div className="ds-callout" data-tone={tone} style={style}>
      {inner}
    </div>
  );
}

/* ---------- Alert ---------- */

/** One problem, one way to recover from it. If there is nothing the user can
 *  do, no button is shown - a Retry that cannot help is worse than none. */
export function Alert({
  title,
  children,
  tone = 'error',
  icon,
  action,
  onAction,
  style,
}: Div & {
  title?: string;
  tone?: 'error' | 'caution' | 'info';
  icon?: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="ds-alert" data-tone={tone} role="status" style={style}>
      {icon ?? <span />}
      <span className="ds-copy">
        {title && <strong>{title}</strong>}
        {children}
      </span>
      {action && onAction ? (
        <button type="button" className="ds-alert-action" onClick={onAction}>
          {action}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

/* ---------- StatTile ---------- */
export function StatTile({
  value,
  caption,
  tone,
  onClick,
}: {
  value: number | null | undefined;
  caption: string;
  tone?: 'counted' | 'duplicate' | 'incomplete';
  onClick?: () => void;
}) {
  const empty = value === null || value === undefined;
  const color =
    tone === 'counted' ? 'var(--ds-success)'
    : tone === 'incomplete' ? 'var(--ds-high)'
    : tone === 'duplicate' ? 'var(--ds-muted)'
    : undefined;
  return (
    <button type="button" className="ds-stat" data-empty={empty} onClick={onClick}>
      <span className="ds-stat-number" style={empty ? undefined : { color }}>
        {empty ? '—' : value}
      </span>
      <span className="ds-stat-caption">{caption}</span>
    </button>
  );
}

/* ---------- BulletList ---------- */
export function BulletList({ items, tone }: { items: ReactNode[]; tone?: 'dark' }) {
  return (
    <ul className="ds-bullets" data-tone={tone}>
      {items.map((t, i) => (
        <li key={i}>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- EmptyState ---------- */

/** "There is nothing here yet" - and the wording has to make clear that this
 *  is not a failure by the user, and not evidence that a beach is clean. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="ds-empty">
      {icon && <div style={{ marginBottom: 10 }}>{icon}</div>}
      <div className="ds-empty-title">{title}</div>
      {body && <div className="ds-empty-body">{body}</div>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="ds-alert-action"
          style={{ color: 'var(--ds-navy)', marginTop: 6 }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
