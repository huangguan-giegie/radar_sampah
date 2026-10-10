import { useEffect, useRef } from 'react';
import { radialPoints, radialSpecies, type MapMarineItem } from '../mapMarineSelection';
import { SpeciesPicture } from './SpeciesPicture';
import { SpeciesIcon } from './Icon';

type Props = {
  beachName: string;
  rating: string;
  color: string;
  lightText: boolean;
  cards: MapMarineItem[];
  position: { x: number; y: number; diameter: number };
  loading: boolean;
  error: boolean;
  onClose: () => void;
  onBeach: () => void;
  onSpecies: (card: MapMarineItem) => void;
  onMore: () => void;
  onRetry: () => void;
};

export function MapMarineSelection({ beachName, rating, color, lightText, cards, position,
  loading, error, onClose, onBeach, onSpecies, onMore, onRetry }: Props) {
  const { visible, remaining } = radialSpecies(cards);
  const core = useRef<HTMLButtonElement>(null);
  useEffect(() => { core.current?.focus({ preventScroll: true }); }, [beachName]);
  const points = radialPoints(visible.length + Number(remaining.length > 0));
  const modelled = cards.some(card => card.modelled);
  const published = cards.some(card => card.published);
  const evidence = modelled ? (published ? 'Published + OBIS modelled context' : 'OBIS modelled context') : 'Published coastal references';
  return <section className="map-marine-selection" aria-label={`Nearby marine life for ${beachName}`}
    style={{ left: position.x, top: position.y, width: position.diameter, height: position.diameter }}
    onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <svg className="marine-radial-lines" viewBox="0 0 280 280" aria-hidden="true">
      <circle cx="140" cy="140" r="104" />
      {points.map((point, i) => <line key={i} x1="140" y1="140" x2={point.x} y2={point.y} />)}
    </svg>
    <button className="marine-radial-close" aria-label="Close nearby marine life" onClick={onClose}>×</button>
    <button ref={core} className="marine-radial-core" style={{ background: color, color: lightText ? '#fff' : '#172b35' }}
      aria-label={`Open ${beachName} beach details`} onClick={onBeach}>
      <strong>{beachName}</strong><span>{rating}</span><small>Beach details →</small>
    </button>
    {visible.map((card, index) => <button className={'marine-radial-species' + (card.modelled ? ' is-modelled' : '')}
      key={card.id} style={{ left: `${points[index].x / 2.8}%`, top: `${points[index].y / 2.8}%` }}
      aria-label={`Open ${card.name}${card.kind === 'habitat' ? ' habitat' : ''} guide · ${card.modelled ? 'OBIS modelled context' : 'published reference'}`}
      onClick={() => onSpecies(card)}>
      {card.kind === 'habitat' ? <span className="marine-habitat-icon"><SpeciesIcon glyph="grass" size={25} /><small>Habitat</small></span>
        : <SpeciesPicture image={card.image} name={card.name} />}
    </button>)}
    {remaining.length > 0 && <button className="marine-radial-species marine-radial-more"
      style={{ left: `${points[visible.length].x / 2.8}%`, top: `${points[visible.length].y / 2.8}%` }}
      aria-label={`Show ${remaining.length} more ${remaining.some(card => card.kind === 'habitat') ? 'marine-life entries' : 'species'}`} onClick={onMore}>+{remaining.length}</button>}
    <div className="marine-radial-status" role="status">
      {loading ? <span>Loading marine-life context…</span> : error ? <span>Additional context unavailable. <button onClick={onRetry}>Retry</button></span>
        : !cards.length ? <span>No species information available for this beach.</span> : null}
      {!!cards.length && <span>{evidence} · not sightings</span>}
    </div>
  </section>;
}
