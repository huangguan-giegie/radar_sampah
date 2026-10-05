import { useNavigate } from 'react-router-dom';
import { iteration3Request } from '../iteration3Api';
import type { ConservationCard } from '../iteration3Personal';
import { useAsyncData } from '../useAsyncData';
import { DataUnavailable, SectionHeading } from './CoastalUI';
import { SpeciesPicture } from './SpeciesPicture';
import { Skeleton } from './ui';

export function ConservationCards({ beachId }: { beachId: string }) {
  const nav = useNavigate();
  const { data: cards, loading, error, refresh } = useAsyncData(
    () => iteration3Request<ConservationCard[]>('/species-cards?beachId=' + encodeURIComponent(beachId)),
    [beachId], [],
  );
  if (loading) return <Skeleton h={160} />;
  if (error) return <DataUnavailable title="Conservation cards could not be loaded" retry={() => void refresh()} />;
  if (!cards.length) return null;
  return <section>
    <SectionHeading>Conservation Species Cards</SectionHeading>
    <p className="coastal-footnote">Approved information about modelled species · not confirmed sightings.</p>
    <div className="coastal-grid-two">
      {cards.map(card => <button key={card.id} onClick={() => nav('/species/' + card.id)}>
        <SpeciesPicture image={card.image} name={card.name} />
        <strong>{card.name}</strong>
        <small>{card.scientificName}</small>
        <small>Reviewed {card.reviewDate} · {card.photoPermission.label}</small>
      </button>)}
    </div>
  </section>;
}
