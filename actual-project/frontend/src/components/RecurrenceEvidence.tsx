import type { RecurrenceEvidence as Evidence } from '../types';
import { WhiteCard } from './CoastalUI';

export function RecurrenceEvidence({ evidence }: { evidence?: Evidence | null }) {
  if (!evidence) return null;
  // The API status is an evidence label, not human-friendly same-day grammar.
  const status = typeof evidence.intervalDays === 'number'
    ? evidence.intervalDays === 0 ? 'Next Counted report on the same day'
      : `${evidence.intervalDays} ${evidence.intervalDays === 1 ? 'day' : 'days'} until next Counted report`
    : evidence.status;
  return (
    <WhiteCard>
      <p className="eyebrow">Litter Recurrence</p>
      <h3>{status}</h3>
      <p className="subtle">{evidence.daysSinceCleanup} {evidence.daysSinceCleanup === 1 ? 'day' : 'days'} since the recorded cleanup.</p>
      {evidence.provisional && evidence.medianDays != null && (
        // Plain words for visitors; still marked as provisional, as the evidence rule requires.
        <p className="subtle">
          Provisional estimate: the next Counted beach report typically follows{' '}
          {evidence.medianDays === 0 ? 'on the same day as' : `${evidence.medianDays} ${evidence.medianDays === 1 ? 'day' : 'days'} after`} a cleanup.
        </p>
      )}
      <p className="coastal-footnote">
        {evidence.evidenceNote || 'Based only on available Counted reports. Missing follow-up evidence does not mean the beach is clean.'}
      </p>
    </WhiteCard>
  );
}
