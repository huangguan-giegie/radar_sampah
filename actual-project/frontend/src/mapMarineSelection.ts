import content from './content/coastalContent.json';
import { marineRecordDetails } from './biodiversity';
import { beachMarineCards, beachMarineReferences, type BeachMarineCard, type BeachWildlifeSpecies } from './beachMarineLife';

export type MapMarineItem = BeachMarineCard & { kind?: 'habitat' };

export function mapMarineCards(beachId: string, wildlife: readonly BeachWildlifeSpecies[] = []): MapMarineItem[] {
  const cards: MapMarineItem[] = beachMarineCards(beachId, wildlife);
  const habitatIds = new Set(beachMarineReferences(beachId).map(record => record.habitatId));
  for (const habitat of content.habitats.filter(item => habitatIds.has(item.id))) {
    cards.push({ id: `habitat-${habitat.id}`, kind: 'habitat', name: habitat.title, image: null,
      creditsUrl: '/credits', destination: `/habitats/${habitat.id}?beach=${encodeURIComponent(beachId)}`,
      published: true, modelled: false });
  }
  return cards;
}

export function marineLayerEnabled(params: URLSearchParams) {
  return params.get('marine') === 'on' || (params.get('marine') !== 'off' && params.get('layer') === 'bio');
}

export function marineLayerParams(previous: URLSearchParams, enabled: boolean) {
  const next = new URLSearchParams(previous);
  next.set('marine', enabled ? 'on' : 'off');
  next.delete('layer');
  next.delete('beach');
  return next;
}

export function selectMapBeach(previous: URLSearchParams, beach: { id: string; region: string }) {
  const next = new URLSearchParams(previous);
  next.set('marine', 'on');
  next.set('region', beach.region);
  if (next.get('beach') === beach.id) next.delete('beach');
  else next.set('beach', beach.id);
  ['layer', 'panel', 'q', 'record'].forEach(key => next.delete(key));
  return next;
}

export function radialSpecies<T extends BeachMarineCard>(cards: readonly T[]) {
  const firstCount = cards.length > 6 ? 5 : 6;
  return { visible: cards.slice(0, firstCount), remaining: cards.slice(firstCount) };
}

export function radialPoints(count: number) {
  const angles = count === 2 ? [-150, -30] : Array.from({ length: count }, (_, i) => -90 + i * 360 / count);
  return angles.map(angle => ({ x: 140 + 112 * Math.cos(angle * Math.PI / 180), y: 140 + 112 * Math.sin(angle * Math.PI / 180) }));
}

export function regionMarineReferenceCount(regionId: string) {
  const records = content.regions.find(region => region.id === regionId)?.records ?? [];
  return new Set(records.map(record => marineRecordDetails(record).speciesId ?? record.name)).size;
}
