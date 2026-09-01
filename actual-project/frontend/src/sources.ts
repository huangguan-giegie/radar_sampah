// The official credit line for each open dataset we use.
//
// The DMP (Data Management Plan) section 2 lists only these two datasets, and
// section 9 says the credit must be SHOWN to the user, and that we must keep
// the source URL and the date we downloaded it.
//
// Both are CC BY-NC: free to use, but non-commercial only, and we must name
// the source. That is why the citation is a piece of DATA that travels with
// every species card - not a comment, not a footnote we might forget to print.
//
// WARNING - these constants say "how to credit this dataset once we have
// pulled the data". They do not mean the data has been pulled. Until the
// ingestion job has actually run, species data must carry PENDING_SOURCE.

import type { SpeciesSource } from './types';

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
 * are not in those two databases, but they still need a real credit line, so
 * the caller supplies it.
 */
export const OTHER = (citation: string, url: string | null, accessedAt: string): SpeciesSource => ({
  dataset: 'other',
  citation,
  url,
  accessedAt,
});

/**
 * Used when we do not have a real source yet.
 *
 * The UI shows this as an amber PLACEHOLDER badge instead of dressing it up as
 * a real citation. We would rather look unfinished than let an invented
 * reference slip into a demo or a report - that would be made-up evidence,
 * which is much worse than a visibly empty slot.
 */
export const PENDING_SOURCE: SpeciesSource = {
  dataset: 'pending',
  citation: 'Awaiting FishBase / OBIS extract — not yet sourced',
  url: null,
  accessedAt: null,
};

/** The non-commercial notice. CC BY-NC requires it, so the user must see it. */
export const NON_COMMERCIAL_NOTICE =
  'Biodiversity reference data is used under CC BY-NC for non-commercial academic work. ' +
  'Individual images may carry separate copyright.';
