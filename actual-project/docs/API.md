# Marine Observation API Contract

Base URL: the local API is `http://localhost:5000`; the deployed API is the
Render API URL configured by the frontend.

## `GET /health`

Returns `200` when the API process is ready to receive requests. It is the
Render health-check endpoint.

## `GET /api/observations`

Returns `{ "observations": [...], "source", "data_version", "demo" }`.
Each stored observation includes its saved classification and illustrative
priority. This endpoint must not expose database credentials, personal data or
unmasked sensitive-species locations.

## `POST /api/observations`

Creates one confirmed demonstration observation.

```json
{
  "category": "Plastic packaging",
  "area": "Selected Malaysian coastal area",
  "latitude": 3.139,
  "longitude": 101.6869,
  "observed_at": "2026-08-14T10:00:00Z",
  "image_url": "/assets/demo-plastic.jpg",
  "note": "Synthetic demonstration record"
}
```

Required fields are `category`, `area`, `latitude`, `longitude` and
`observed_at`. `image_url` and `note` are optional.

Validation rules:

- Category must be one of `Plastic packaging`, `Fishing gear`, `Glass`,
  `Metal` or `Other`.
- Latitude must be between `-90` and `90`; longitude must be between `-180`
  and `180`.
- `observed_at` must be a valid ISO 8601 timestamp.
- `image_url` must be an approved local demo asset path or an HTTPS URL.
- Text must be non-empty after trimming and must stay within the documented
  input limits.
- Names, phone numbers, account identifiers and secrets are not accepted.

An invalid request returns `400` with an `error` string. A valid request
returns `201` with this shape:

```json
{
  "observation": {
    "id": "obs-example",
    "category": "Plastic packaging",
    "area": "Selected Malaysian coastal area",
    "latitude": 3.139,
    "longitude": 101.6869,
    "observed_at": "2026-08-14T10:00:00Z",
    "image_url": "/assets/demo-plastic.jpg",
    "note": "Synthetic demonstration record"
  },
  "classification": {
    "label": "Plastic packaging",
    "rule": "category_passthrough_v1",
    "method": "Fixed demonstration category selected by the reporter."
  },
  "priority": {
    "level": "medium",
    "reason": "Illustrative rule explanation",
    "disclaimer": "Illustrative demo priority only; this is not a pollution-source proof, scientific finding, or enforcement decision.",
    "illustrative": true
  },
  "context": {
    "id": "obis-malaysia-ambassis-interrupta-000c8b50",
    "source": "OBIS",
    "source_url": "https://api.obis.org/occurrence?geometry=POLYGON((99%203,105%203,105%207,99%207,99%203))&size=50",
    "retrieved_at": "2026-08-14",
    "license": "OBIS data policy; dataset-level attribution required",
    "approximate_location": { "latitude": 5.7, "longitude": 102.7 },
    "taxon_or_context_label": "Public Malaysia-region occurrence sample",
    "sensitivity": "aggregated"
  },
  "source": "synthetic/public demonstration data",
  "data_version": "marine-observation-v1",
  "demo": true
}
```

## `GET /api/context`

Returns `{ "context": [...], "source": "OBIS", "data_version":
"obis-malaysia-public-2026-08-14-v1", "demo": true }`. The current static
bundle contains five public Malaysia-region occurrence samples retrieved on
2026-08-14 from a bounded OBIS occurrence query. Each record includes a source
URL, retrieval date, attribution, approximate location, taxon/context label and
a sensitivity flag. Sensitive records must use masked or aggregated
coordinates; these samples use coarse coordinates and are context only.

## `GET /api/options`

Returns the source-labelled form option catalogue used by the frontend. It
keeps the five MVP categories, adds short examples from the public CEFAS/Defra
marine-litter vocabulary, and provides coarse Malaysian-region area
suggestions from the OBIS context snapshot. These are demonstration choices,
not a Malaysian litter survey or a claim about a specific beach.

## Result boundaries

Classification is a transparent category rule. Priority is illustrative and
supports discussion of possible clean-up attention only. Neither result proves
pollution sources, species identity, ecological change or regulatory action.
