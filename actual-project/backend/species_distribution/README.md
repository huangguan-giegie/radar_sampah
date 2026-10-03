# Packaged OBIS species models

The Iteration 3 package contains 40 selected animal models from the already
trained 157-model archive. Each model is copied without retraining, with its
original validation metrics and parameters. See `training_provenance.json` and
`validation_summary.json` for the saved provenance. The registry is driven by
`models/model_manifest.json`, rather than a fixed species-count condition.

The API loads the registry, content catalog, geometry and saved grid scores once
per process. It never queries OBIS during prediction and does not persist request
coordinates or scores. The existing backend dependencies support the package;
start locally with `python app.py`, or use the existing Gunicorn entry point and
`gunicorn.conf.py` on Linux.

## Prediction contract

`POST /api/species-distribution/predict` accepts:

```json
{"latitude":2.789,"longitude":101.415,"mode":"nearby_marine","topK":5}
```

- `latitude` and `longitude` must be finite JSON numbers in their valid ranges.
- `mode` defaults to `"exact"`; this evaluates the requested point inside the
  Malaysian EEZ without moving it. A coordinate-only request remains supported.
- `"nearby_marine"` explicitly selects the nearest saved marine-grid centre,
  including when the requested point lies just outside the maritime polygon.
  The API fixes the maximum distance at 15 km; clients cannot enlarge it.
- `topK` defaults to 5 and must be a non-negative integer. `0` returns an empty
  suggested list while retaining every prediction.

The response includes `modelVersion`, `modelCount`, complete `predictions`, and
`topPredictions`. Each species retains its raw `relativeOccurrenceScore`,
`locationMatchScore`, scientific name, category, English/Chinese introductions
and sources. The suggested list contains only default-eligible animal models
with a positive raw score, ordered by location match and then scientific name.

`coordinateContext` reports `requestedLatitude`, `requestedLongitude`,
`usedLatitude`, `usedLongitude`, `method`, `moved`, `distanceKm`, `gridCellId`, and
whether the requested point is inside the EEZ. Nearby responses also include
`maxDistanceKm: 15` and an interpretation of the coordinate change.

Invalid bodies, coordinates, modes or options return
`400 {"code":"VALIDATION_FAILED","message":"..."}`. Points outside the exact
domain, or farther than 15 km from a saved cell in nearby mode, return
`422 {"code":"OUTSIDE_MODEL_AREA","message":"..."}`. There is no automatic
fallback from exact mode to nearby mode. Kelanang requires the explicit nearby
mode and reports approximately 8.42 km of movement.

`GET /api/species-distribution/catalog` returns this loaded `modelVersion`,
`modelCount`, and species content keyed by scientific name. Only the four
previously available photographs have `imageAvailable: true`; other species
need a category icon until a suitable photograph is supplied.

## Meaning of the scores

The raw model score comes from historical presence/background training using
only latitude and longitude. A background label means no accepted record in the
cell, not confirmed absence. `locationMatchScore` is the within-species empirical
percentile across the frozen 4,227 marine-grid scores, counting ties by their
midpoint. A high percentile can accompany a low raw score.

Both fields are on 0–1 scales, but neither is a calibrated real-world occurrence
probability. The ranking is a product heuristic rather than independently
validated ecological comparison between species. Nearby scores describe the
selected marine grid, not a sighting at the requested beach. These scores do not
contribute to litter severity or report status.
