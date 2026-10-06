# Integrated Iteration 3 species distribution models

The website imports the standalone 40-model package from
`iteration3-model-upgrade` at commit `0397c82f557638a799c377dd6718cf8f4a420604`.
The model version is `iteration3-upgrade-40-species-20261003`.
Inference, weights, catalog, reference files, training code and processed inputs
are preserved. The website uses its existing deployment configuration.

The backend reuses one offline registry per process. Predictions do not persist
coordinates or scores, call OBIS, retrain weights or affect litter severity.

## API

`GET /api/species-distribution/species` returns all 40 identities, introductions,
sources and version. `POST /api/species-distribution/predict` requires numeric
`latitude` and `longitude`, with optional `mode` and `topK`.

- `mode: exact` (default) never moves coordinates; unsupported points return 422.
- `mode: nearby_marine` explicitly selects a frozen marine-grid centre within
  **15 km**. Requested and selected points, grid ID and distance are disclosed.
  Clients cannot expand this API limit.
- `topK` is a nonnegative integer, default five. All 40 `predictions` remain
  available, including when `topK: 0` returns no suggestions. Invalid input
  returns 400.

Beach pages explicitly request nearby mode, display Top 5 and allow inspection
of all 40 scores. Insights links only to the four approved conservation cards,
which are separate from the 40-model registry.

## Interpretation and photographs

`relativeOccurrenceScore` is a raw historical model score, not a calibrated
sighting probability. `locationMatchScore` is its midrank percentile within the
same species' 4,227 frozen grid scores. Nonzero eligible suggestions use this
percentile with scientific name as a tie breaker. Cross-species Top-5 accuracy
has not been independently validated. Neither score is abundance or a sighting.

The bundle has no photographs and its catalog reports `imageAvailable: false`.
The website separately matches its four licensed photographs by scientific name.
Other species use category icons without substituting another species' image.

## Verification, training and deployment

From this directory, using the website backend dependencies:

```sh
python verify_bundle.py
python predict.py --latitude 2.75 --longitude 101.35 --top-k 5
python predict.py --latitude 2.789 --longitude 101.415 --nearby-marine --top-k 5
python training/train.py --prepare-only --output-dir training/runs/verification
```

Training output must be a new empty directory. The frozen training inputs cover
157 candidates; the serving release selects 40 animals without retraining.

See [SPECIES.md](SPECIES.md), [training/README.md](training/README.md),
[validation_summary.json](validation_summary.json), and [VALIDATION.md](VALIDATION.md).
VALIDATION records the upstream standalone checks, distinct from integration
evidence in [the project test report](../../../docs/iteration3-test-report.md).

Deploy using the existing Render backend service, root `actual-project/backend`,
build `pip install -r requirements.txt`, start
`gunicorn --bind 0.0.0.0:$PORT 'app:create_app()'`. Keep one worker on the current
instance size. No additional service or credentials are needed.
