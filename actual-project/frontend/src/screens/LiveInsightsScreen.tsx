import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { iteration3Request } from '../iteration3Api';
import { useAsyncData } from '../useAsyncData';
import { CoastalPage, DataUnavailable, LinkRow, SummaryCard, SummaryStats, WhiteCard } from '../components/CoastalUI';
import { GhostButton, Skeleton } from '../components/ui';
import { SeverityBadge } from '../components/ds';
import type { SeverityBand } from '../types';
import { formatDate } from '../theme';

type PublicCount = number | 'Fewer than 3';
type Beach = {
  id: string; name: string; area: string; severity: SeverityBand | null;
  eligibleReportCount: number; latestContributingReportAt: string | null;
  trend: { eligible: boolean; currentBand: SeverityBand | null; previousBand: SeverityBand | null; direction: string | null; previousAsOf: string; message: string | null };
  composition: { category: string; percentage: number; band: string }[];
  leadingCategories: string[];
  evidence: { sufficiency: string; freshnessLabel: string };
  needsVolunteers: { flag: boolean; reasons: string[]; nextEventJoinedCount: PublicCount; href: string; eventMessage: string | null };
};
type Recurrence = { beachId: string; intervalDays: number | null; daysSinceCleanup: number; status: string; medianDays: number | null; evidenceNote: string };
type Summary = {
  asOf: string;
  overview: { countedReports: number; recordedCleanups: number; joinedParticipants: PublicCount; sufficientBeaches: number; needsVolunteers: number };
  headlines: { text: string; href: string }[]; headlinesEmptyState: string | null;
  beaches: Beach[];
  trends: { monthlyReports: { months: string[]; beaches: { beachId: string; counts: number[] }[]; caption: string } };
  cleanup: {
    recent: { beachId: string; beachName: string; date: string; categories: { category: string; beforeBand: string; afterBand: string }[]; cleanupScore: number; handling: string; status: string }[];
    emptyState: string | null;
    hardestToClear: { eligible: boolean; categories: { category: string; percentage: number }[]; emptyState: string | null };
    handling: { eligible: boolean; statuses: { status: string; count: number; percentage: number }[]; label: string; emptyState: string | null };
    recurrence: { beaches: Recurrence[]; emptyState: string | null };
  };
  participation: { steps: { key: string; label: string; count: PublicCount; beaches: { beachId: string; count: number }[] | null }[]; conversions: { from: string; to: string; percentage: number | null; beaches?: { beachId: string; percentage: number }[] | null }[]; caption: string };
  evidence: { sufficientBeachCount: number; countedNote: string; beaches: { beachId: string; statuses: { countedActive: number; countedResolved: number; duplicate: number; incomplete: number } }[] };
  wildlife?: { beaches?: { beachId: string; beachName: string; species: { id: string; name: string; relativeOccurrenceScore: number | null; source: { label: string; url: string }; reviewDate: string; destination: string }[]; sourceStatus: string }[] };
};

function Shares({ rows }: { rows: { category: string; percentage: number }[] }) {
  return <>{rows.map(row => <div className="metric-bar" key={row.category}><div><span>{row.category}</span><strong>{row.percentage}%</strong></div><div className="metric-track"><i style={{ width: `${row.percentage}%` }} /></div></div>)}</>;
}

function volunteerReasons(reasons: string[]) {
  const labels: Record<string, string> = { no_recent_cleanup: 'No cleanup recorded in the last 30 days', low_sign_up: 'Low sign-up for the next event' };
  return reasons.map(reason => labels[reason] ?? reason).join(' · ');
}

export default function LiveInsightsScreen() {
  const { topic = '', beachId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { reportsVersion } = useApp();
  const { data, loading, error, refresh } = useAsyncData<Summary | null>(() => iteration3Request('/insights/summary'), [reportsVersion], null);
  const titles: Record<string, string> = { trends: 'Beach Trends', cleanup: 'Cleanup Results', 'cleanup-history': 'Cleanup History', participation: 'Participation', evidence: 'Evidence', wildlife: 'Wildlife Nearby', volunteers: 'Needs Volunteers' };
  const title = titles[topic] ?? 'Insights';
  const filtered = data?.beaches.filter(beach => (!beachId || beach.id === beachId) && (!params.get('q') || beach.name.toLowerCase().includes(params.get('q')!.toLowerCase())) && (!params.get('band') || beach.severity === params.get('band')) && (!params.get('needs') || beach.needsVolunteers.flag)) ?? [];
  const sections = [['trends', 'Trends'], ['cleanup', 'Cleanup'], ['participation', 'Participation'], ['evidence', 'Evidence'], ['wildlife', 'Wildlife']];
  return <CoastalPage title={title} back={topic ? '/insights' : undefined} action={<button onClick={() => nav('/method')}>About Data</button>}>
    {loading ? <><Skeleton h={180} r={22} /><Skeleton h={120} r={22} /></> : error || !data ? <DataUnavailable title="Insights could not be loaded" retry={() => { void refresh(); }}>Please try again.</DataUnavailable> : <>
      <p className="coastal-footnote">Four validated MVP beaches · as of {formatDate(data.asOf)} · recorded system data only</p>
      <div className="coastal-segments" aria-label="Insight topics">{sections.map(([id, label]) => <button key={id} aria-pressed={topic === id} onClick={() => nav('/insights/' + id)}>{label}</button>)}</div>
      {!topic && <>
        <SummaryCard eyebrow="Last 90 days · four pilot beaches" value={data.overview.countedReports} description="Counted reports">
          <SummaryStats items={[{ label: 'Cleanups', value: data.overview.recordedCleanups }, { label: 'Joined', value: data.overview.joinedParticipants }, { label: 'Need help', value: data.overview.needsVolunteers }]} />
        </SummaryCard>
        {data.headlines.map((card, i) => <WhiteCard key={i}><LinkRow title={card.text} onClick={() => nav(card.href)} /></WhiteCard>)}
        {!data.headlines.length && <DataUnavailable title={data.headlinesEmptyState ?? 'Not enough recent reports to generate insights yet.'} />}
        <WhiteCard><LinkRow title="Beaches needing volunteers" subtitle="Based on recorded beach attention and participation" onClick={() => nav('/insights/volunteers')} /></WhiteCard>
      </>}
      {topic === 'trends' && filtered.map(beach => {
        const monthly = data.trends.monthlyReports.beaches.find(row => row.beachId === beach.id);
        const recurrence = data.cleanup.recurrence.beaches.find(row => row.beachId === beach.id);
        return <WhiteCard key={beach.id}>
          <LinkRow title={beach.name} subtitle={beach.area} trailing={<SeverityBadge band={beach.severity} />} onClick={() => nav('/beach/' + beach.id)} />
          {beach.trend.eligible ? <><p className="coastal-footnote">{formatDate(beach.trend.previousAsOf)} → {formatDate(data.asOf)}</p><div className="update-bands"><SeverityBadge band={beach.trend.previousBand} /><span>→ {beach.trend.direction}</span><SeverityBadge band={beach.trend.currentBand} /></div></> : <p>{beach.trend.message ?? 'Insufficient data to compare'}</p>}
          <p className="coastal-footnote">Largest share of weighted reported composition: {beach.leadingCategories.join(' and ') || 'Insufficient data'}</p>
          <Shares rows={beach.composition} />
          {monthly && <><p className="eyebrow">Monthly reporting activity</p><div className="coastal-bars" role="img" aria-label={data.trends.monthlyReports.months.map((month, i) => `${month}: ${monthly.counts[i]} reports`).join(', ')}>{monthly.counts.map((count, i) => <div key={i}><small>{count}</small><i style={{ height: Math.min(count * 10, 100) }} /><small>{data.trends.monthlyReports.months[i].slice(5)}</small></div>)}</div><p className="coastal-footnote">{data.trends.monthlyReports.caption}</p></>}
          {recurrence && <p>{recurrence.status}{recurrence.medianDays !== null ? ` · Provisional median: ${recurrence.medianDays} days` : ''}</p>}
        </WhiteCard>;
      })}
      {(topic === 'cleanup' || topic === 'cleanup-history') && <>
        {data.cleanup.recent.filter(row => !beachId || row.beachId === beachId).map((row, i) => <WhiteCard key={i}><h3>{row.beachName}</h3><p className="coastal-footnote">{formatDate(row.date)}</p>{row.categories.map(category => <p key={category.category}>{category.category}: {category.beforeBand} → {category.afterBand}</p>)}<p>Cleanup Score: {row.cleanupScore} · {row.handling}</p><p>{row.status}</p></WhiteCard>)}
        {!data.cleanup.recent.length && <DataUnavailable title={data.cleanup.emptyState ?? 'Not enough cleanups recorded yet.'} />}
        <WhiteCard><h3>Hardest-to-clear categories</h3>{data.cleanup.hardestToClear.eligible ? <Shares rows={data.cleanup.hardestToClear.categories} /> : <p>{data.cleanup.hardestToClear.emptyState}</p>}<p className="coastal-footnote">Categories included in at least three cleanups. Remaining above Small after cleanup.</p></WhiteCard>
        <WhiteCard><h3>Handling status</h3>{data.cleanup.handling.eligible ? data.cleanup.handling.statuses.map(row => <p key={row.status}>{row.status}: {row.percentage}% ({row.count})</p>) : <p>{data.cleanup.handling.emptyState}</p>}<p className="coastal-footnote">{data.cleanup.handling.label}</p></WhiteCard>
        {data.cleanup.recurrence.beaches.map(row => <WhiteCard key={row.beachId}><h3>{data.beaches.find(beach => beach.id === row.beachId)?.name}</h3><p>{row.status} · {row.daysSinceCleanup} days since cleanup</p>{row.medianDays !== null && <p>Provisional median: {row.medianDays} days</p>}<p className="coastal-footnote">{row.evidenceNote}</p></WhiteCard>)}
      </>}
      {topic === 'participation' && <><SummaryCard eyebrow="Joining to cleanup · last 90 days">{data.participation.steps.map(step => <div key={step.key}><p>{step.label}: <strong>{step.count}</strong></p>{step.beaches?.map(row => <p key={row.beachId} className="coastal-footnote">{data.beaches.find(beach => beach.id === row.beachId)?.name}: {row.count}</p>)}</div>)}{data.participation.conversions.map((conversion, i) => <div key={i}><p>{conversion.from} → {conversion.to}: {conversion.percentage === null ? 'Insufficient data' : `${conversion.percentage}%`}</p>{conversion.beaches?.map(row => <p key={row.beachId}>{data.beaches.find(beach => beach.id === row.beachId)?.name}: {row.percentage}%</p>)}</div>)}<p className="coastal-footnote">{data.participation.caption}</p></SummaryCard><p className="coastal-footnote">Small counts are withheld. Beach breakdowns are shown only when every beach meets the minimum of three.</p></>}
      {topic === 'evidence' && <><SummaryCard eyebrow="Evidence coverage" value={data.evidence.sufficientBeachCount} description="of four beaches have sufficient data" />{data.beaches.map(beach => {
        const statuses = data.evidence.beaches.find(row => row.beachId === beach.id)?.statuses;
        return <WhiteCard key={beach.id}><h3>{beach.name}</h3><p>{beach.eligibleReportCount} active eligible reports · {beach.evidence.sufficiency}</p><p>{beach.evidence.freshnessLabel} · latest contributing report: {beach.latestContributingReportAt ? formatDate(beach.latestContributingReportAt) : 'Not recently reported'}</p>{statuses && <><p>Counted · Active: {statuses.countedActive}</p><p>Counted · Resolved: {statuses.countedResolved}</p><p>Duplicate: {statuses.duplicate}</p><p>Incomplete: {statuses.incomplete}</p></>}</WhiteCard>;
      })}<p className="coastal-footnote">{data.evidence.countedNote}</p></>}
      {topic === 'volunteers' && <>{data.beaches.filter(beach => beach.needsVolunteers.flag).map(beach => <WhiteCard key={beach.id}><LinkRow title={beach.name} subtitle={volunteerReasons(beach.needsVolunteers.reasons)} onClick={() => nav(beach.needsVolunteers.href)} /><p>Joined: {beach.needsVolunteers.nextEventJoinedCount}</p>{beach.needsVolunteers.eventMessage && <p>{beach.needsVolunteers.eventMessage}</p>}</WhiteCard>)}{!data.beaches.some(beach => beach.needsVolunteers.flag) && <DataUnavailable title="No beaches currently flagged for volunteers" />}</>}
      {topic === 'wildlife' && <>{data.beaches.map(beach => {
        const wildlife = data.wildlife?.beaches?.find(row => row.beachId === beach.id);
        return <WhiteCard key={beach.id}><h3>{beach.name}</h3><p>Beach Attention: <SeverityBadge band={beach.severity} /></p><p className="coastal-footnote">Biodiversity is separate from Beach Attention. Modelled relative scores are not probabilities or confirmed sightings.</p>
          {wildlife?.species.length ? wildlife.species.map(species => <div key={species.id}><LinkRow title={species.name} subtitle={species.relativeOccurrenceScore === null ? 'Model unavailable' : `Relative model score: ${species.relativeOccurrenceScore}`} onClick={() => nav(species.destination)} /><p className="coastal-footnote"><a href={species.source.url} target="_blank" rel="noreferrer">{species.source.label}</a> · reviewed {formatDate(species.reviewDate)}</p></div>) : <p>Biodiversity information not yet available</p>}
          <LinkRow title="View beach biodiversity" onClick={() => nav('/beach/' + beach.id)} /></WhiteCard>;
      })}</>}
      <p className="coastal-footnote">Counted reports are accepted community evidence, not expert verification. These summaries do not establish cleanliness or ecological recovery.</p>
      <GhostButton onClick={() => nav('/map')}>Open Map</GhostButton>
    </>}
  </CoastalPage>;
}
