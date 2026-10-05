import type { RecurrenceEvidence as Evidence } from '../types';
import { WhiteCard } from './CoastalUI';

export function RecurrenceEvidence({ evidence }: { evidence?: Evidence | null }) {
  if (!evidence) return null;
  return (
    <WhiteCard>
      <p className="eyebrow">Litter Recurrence</p>
      <h3>{evidence.status}</h3>
      <p className="subtle">{evidence.daysSinceCleanup} days since the recorded cleanup.</p>
      {evidence.provisional && evidence.medianDays != null && (
        <p className="subtle">Provisional median recurrence interval: {evidence.medianDays} days.</p>
      )}
      <p className="coastal-footnote">
        {evidence.evidenceNote || 'Based only on available Counted reports. Missing follow-up evidence does not mean the beach is clean.'}
      </p>
    </WhiteCard>
  );
}
