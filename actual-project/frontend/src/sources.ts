// The official credit line for each open dataset we use.
//
// The DMP says the credit must be SHOWN to the user, along with the source URL
// and the date of the extract. Both datasets are CC BY-NC: free to use, but
// non-commercial only and only if named. So a citation travels as data on
// every species card, not as a footnote someone forgets to print.
//
// WARNING - a constant here says how to credit a dataset once the data is
// pulled. It does not mean the data has been pulled. Until the ingestion job
// has run, species data must carry PENDING_SOURCE.

import type { SpeciesKind, SpeciesSource } from './types';

/**
 * The badge text on a card that has no dataset behind it yet. Habitats and
 * groups say "TEAM DESCRIPTION" because they were never going to come from
 * FishBase or OBIS - we wrote those ourselves. Only a species is still waiting
 * on an extract, so only a species says "SOURCE PENDING".
 */
export function pendingSourceLabel(kind: SpeciesKind): string {
  if (kind === 'habitat') return 'HABITAT CONTEXT · TEAM DESCRIPTION';
  if (kind === 'group') return 'GROUP CONTEXT · TEAM DESCRIPTION';
  return 'SOURCE PENDING · NOT YET FROM FISHBASE / OBIS';
}

// accessedAt is passed in rather than generated here, because the honest date
// is the day the extract was taken - not the day the page happens to render.
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


/**
 * For anything that is not in FishBase or OBIS. Mangroves, seagrass and birds
 * are missing from those two databases but still need a real credit line, so
 * the caller supplies it.
 */
export const OTHER = (citation: string, url: string | null, accessedAt: string): SpeciesSource => ({
  dataset: 'other',
  citation,
  url,
  accessedAt,
});


/**
 * Used when we do not have a real source yet. A card with this source draws an
 * amber pendingSourceLabel badge instead of a citation line. Looking unfinished
 * is far better than an invented reference slipping into a demo or a report,
 * which would be made-up evidence.
 */
export const PENDING_SOURCE: SpeciesSource = {
  dataset: 'pending',
  citation: 'Awaiting FishBase / OBIS extract — not yet sourced',
  url: null,
  accessedAt: null,
};


/** CC BY-NC requires this notice, so the user has to be shown it. */
export const NON_COMMERCIAL_NOTICE =
  'Biodiversity reference data is used under CC BY-NC for non-commercial academic work. ' +
  'Individual images may carry separate copyright.';
