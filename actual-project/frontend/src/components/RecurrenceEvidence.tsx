import type { RecurrenceEvidence as Evidence } from '../types';
import { WhiteCard } from './CoastalUI';
import { daysLabel, recurrenceEstimate, recurrenceStatus } from '../recurrenceCopy';

export function RecurrenceEvidence({ evidence }: { evidence?: Evidence | null }) {
  if (!evidence) return null;
  return (
    <WhiteCard>
      <p className="eyebrow">Litter Recurrence</p>
      <h3>{recurrenceStatus(evidence.status, evidence.intervalDays)}</h3>
      <p className="subtle">{daysLabel(evidence.daysSinceCleanup)} since the recorded cleanup.</p>
      {evidence.provisional && evidence.medianDays != null && (
        <p className="subtle">{recurrenceEstimate(evidence.medianDays)}</p>
      )}
      <p className="coastal-footnote">
        {evidence.evidenceNote || 'Based only on available Counted reports. Missing follow-up evidence does not mean the beach is clean.'}
      </p>
    </WhiteCard>
  );
}
