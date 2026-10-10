import type { RecurrenceEvidence as Evidence } from '../types';
import { WhiteCard } from './CoastalUI';

export function RecurrenceEvidence({ evidence }: { evidence?: Evidence | null }) {
  if (!evidence) return null;
  return (
    <WhiteCard>
      <p className="eyebrow">Litter Recurrence</p>
      <h3>{evidence.status}</h3>
      <p className="subtle">{evidence.daysSinceCleanup} {evidence.daysSinceCleanup === 1 ? 'day' : 'days'} since the recorded cleanup.</p>
      {evidence.provisional && evidence.medianDays != null && (
        // Plain words for visitors; still marked as provisional, as the evidence rule requires.
        <p className="subtle">
          Provisional estimate: litter is usually reported again{' '}
          {evidence.medianDays === 0 ? 'on the same day as' : `${evidence.medianDays} ${evidence.medianDays === 1 ? 'day' : 'days'} after`} a cleanup.
        </p>
      )}
      <p className="coastal-footnote">
        {evidence.evidenceNote || 'Based only on available Counted reports. Missing follow-up evidence does not mean the beach is clean.'}
      </p>
    </WhiteCard>
  );
}
