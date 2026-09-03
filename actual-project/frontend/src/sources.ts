
//


//



import type { SpeciesKind, SpeciesSource } from './types';

export function pendingSourceLabel(kind: SpeciesKind): string {
  if (kind === 'habitat') return 'HABITAT CONTEXT · TEAM DESCRIPTION';
  if (kind === 'group') return 'GROUP CONTEXT · TEAM DESCRIPTION';
  return 'SOURCE PENDING · NOT YET FROM FISHBASE / OBIS';
}

export const FISHBASE = (accessedAt: string): SpeciesSource => ({
  dataset: 'FishBase',
  citation: 'Froese, R. and D. Pauly, Editors. FishBase. www.fishbase.org — CC BY-NC 4.0',
  url: 'https://www.fishbase.se/country/CountryChecklist.php?c_code=458&vhabitat=threatened',
  accessedAt,
});

export const OBIS = (accessedAt: string): SpeciesSource => ({
  dataset: 'OBIS',
  citation:
    'OBIS — Ocean Biodiversity Information System. Intergovernmental Oceanographic ' +
    'Commission of UNESCO. www.obis.org — CC BY-NC (strictest applicable licence)',
  url: 'https://api.obis.org/occurrence',
  accessedAt,
});


export const OTHER = (citation: string, url: string | null, accessedAt: string): SpeciesSource => ({
  dataset: 'other',
  citation,
  url,
  accessedAt,
});


export const PENDING_SOURCE: SpeciesSource = {
  dataset: 'pending',
  citation: 'Awaiting FishBase / OBIS extract — not yet sourced',
  url: null,
  accessedAt: null,
};


export const NON_COMMERCIAL_NOTICE =
  'Biodiversity reference data is used under CC BY-NC for non-commercial academic work. ' +
  'Individual images may carry separate copyright.';
