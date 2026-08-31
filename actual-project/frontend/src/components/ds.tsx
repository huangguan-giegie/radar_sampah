
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


export function SeverityBadge({
  band,
  size = 'md',
  label,
  block = false,
}: {
  band: SeverityBand | null;
  size?: 'md' | 'lg';
  label?: string;

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
      {label ?? severityLabel(band)}
    </StatusBadge>
  );
}

/* ---------- InfoChip ---------- */

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
