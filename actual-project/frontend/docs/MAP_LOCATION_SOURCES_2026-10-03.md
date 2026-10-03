# Preview map locations — 3 October 2026

The frontend now has map display locations for all **101 catalogue entries**: 97 sourced reference locations plus the four existing pilot beach positions. This restores the prototype's region-to-beach map navigation across all nine regions.

| Source file | Records |
| --- | ---: |
| [mapLocationsBase.json](../src/content/mapLocationsBase.json) | 44 |
| [mapLocationsNorth.json](../src/content/mapLocationsNorth.json) | 16 |
| [mapLocationsWest.json](../src/content/mapLocationsWest.json) | 14 |
| [mapLocationsEast.json](../src/content/mapLocationsEast.json) | 23 |
| Total sourced reference locations | 97 |

Each record retains `lat`, `lng`, `sourceUrl` and `sourceName`. The west file includes Pantai Sungai Burung. These locations were matched to the existing catalogue IDs and their regions; similarly named places on other islands or in other states were excluded.

## Provenance and precision

Sources include [MyGeoName / JUPEM's Kedah gazetteer](https://mygeoname.mygeoportal.gov.my/pdf/02.pdf), the [Langkawi Development Authority nature guide](https://naturallylangkawi.my/wp-content/uploads/2023/07/Nature_New.pdf), [NAHRIM MyCoast beach surveys](https://mycoast.nahrim.gov.my/portal-main/metadata-directory?search_type=TBEACHPROFILE), council location pages such as [Pantai Pandan](https://lundudc.sarawak.gov.my/web/subpage/webpage_view/133) and [Tanjung Bidara](https://www.mpag.gov.my/pantai-tanjung-bidara/), and OpenStreetMap / GeoNames references surfaced through [Beach World Map](https://www.beachworldmap.org/en/malaysia) and [Mapcarta](https://mapcarta.com/15900984). Individual records also cite research, geotagged photographs and travel directories.

Precision varies. Named beach points, island reference points, photographed viewpoints and coastal sampling sites are not interchangeable. For example, several island entries use an island reference location, while Teluk Mahkota, Batu Layar and Tanjung Leman use named coastal sampling sites in [Engineering Letters, volume 34, issue 5, Table I](https://www.engineeringletters.com/issues_v34/issue_5/EL_34_5_12.pdf). Their `sourceName` values identify these distinctions. Coverage means each catalogue entry can appear on the preview map; it does not establish an exact beach entrance, beach boundary or operational location accuracy.

## Integration boundary and backend handoff

[mapCatalogue.ts](../src/mapCatalogue.ts) preserves existing valid beach coordinates. It adds a copied display location only when preview mode is enabled and the entry is `previewOnly`. It does not mutate `coastalData`, register beaches with a live API, or enable reports, geolocation, cleanup eligibility or check-in for catalogue-only beaches.

Before operational backend integration, reconcile canonical backend beach IDs, validate coordinates and beach boundaries, and confirm how island-wide entries map to individual beaches. This **101-entry prototype catalogue is separate from AC4.4.4's 82-beach export**; the files do not claim those datasets have been reconciled or that all 101 entries are live backend beaches.
