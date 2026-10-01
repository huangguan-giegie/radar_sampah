import type { CleanupTarget } from '../iteration2';
import { C } from '../theme';
import { GhostButton, Label, PrimaryButton } from './ui';

/** Cleanup availability comes from an active report, independently of the
 * number of reports needed for the beach's public rating. */
export function BeachCleanupCard({ target, loading, error, onCleanup, onReport, onRetry }: {
  target: CleanupTarget | null;
  loading: boolean;
  error: string | null;
  onCleanup: () => void;
  onReport: () => void;
  onRetry: () => void;
}) {
  const headingStyle = { fontSize: 17, fontWeight: 680, color: C.ink2 };
  const bodyStyle = { marginTop: 5, fontSize: 12.5, lineHeight: 1.5, color: C.muted };

  return (
    <div className="i2-card" style={{ minHeight: 140 }}>
      {loading ? (
        <div role="status" aria-live="polite">
          <Label style={{ marginBottom: 8 }}>CLEANUP CHECK</Label>
          <div style={headingStyle}>Checking cleanup availability…</div>
          <div style={bodyStyle}>Looking for an active report at this beach.</div>
        </div>
      ) : error ? (
        <div role="alert">
          <Label style={{ marginBottom: 8 }}>CLEANUP CHECK</Label>
          <div style={headingStyle}>Could not check cleanup availability</div>
          <div style={bodyStyle}>Please try again to check for an active report.</div>
          <GhostButton onClick={onRetry} style={{ marginTop: 13 }}>Try again</GhostButton>
        </div>
      ) : target ? (
        <>
          <div style={headingStyle}>Cleaned up here?</div>
          <PrimaryButton
            onClick={onCleanup}
            height={44}
            trailingArrow
            style={{ marginTop: 13, width: 'fit-content', borderRadius: 999, fontSize: 14 }}
          >
            Add a Cleanup
          </PrimaryButton>
        </>
      ) : (
        <>
          <Label style={{ marginBottom: 8 }}>CLEANUP CHECK</Label>
          <div style={headingStyle}>No active cleanup report</div>
          <div style={bodyStyle}>If you see litter, add a report before recording a cleanup.</div>
          <GhostButton onClick={onReport} style={{ marginTop: 13 }}>Report litter here</GhostButton>
        </>
      )}
    </div>
  );
}
