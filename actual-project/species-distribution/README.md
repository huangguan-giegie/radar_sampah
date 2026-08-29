# TideTrace MY Species Distribution Model — Iteration 1

This module is a reproducible coordinate-only species distribution baseline for Malaysian waters. Given a latitude and longitude, it returns a relative occurrence/suitability score for four selected marine species:

| Slug | Scientific name | English name | 中文名 |
|---|---|---|---|
| `green_sea_turtle` | *Chelonia mydas* | Green sea turtle | 绿海龟 |
| `ocellaris_clownfish` | *Amphiprion ocellaris* | Ocellaris clownfish | 公子小丑鱼 |
| `irrawaddy_dolphin` | *Orcaella brevirostris* | Irrawaddy dolphin | 伊洛瓦底海豚 |
| `moorish_idol` | *Zanclus cornutus* | Moorish idol | 镰鳍角蝶鱼 |

## Important interpretation

The output is **not a calibrated probability that an animal is physically present at that moment**. OBIS primarily provides presence observations, not systematic confirmed absences. This project generates background points, so the model score depends on:

- where OBIS contributors sampled;
- which records passed quality filters;
- the 0.1° grid;
- the chosen 3:1 background-to-presence ratio;
- the fact that Iteration 1 uses only latitude and longitude.

The UI should label the output **relative occurrence score** or **predicted suitability**, even though the classifier internally uses `predict_proba`.

## Data construction

Sources:

- [OBIS API v3](https://api.obis.org/) occurrence records, filtered with OBIS area ID `140` (Malaysia), absence excluded and dropped records excluded.
- [Marine Regions Malaysian EEZ](https://www.marineregions.org/gazetteer.php?id=8483&p=details), MRGID `8483`, used to create the marine grid and re-check occurrence coordinates.

### How the four species were selected

Species were not chosen only because they are familiar. The Iteration 1 screening criteria were:

1. The accepted taxon can be queried at species rank in OBIS/WoRMS.
2. OBIS returns enough Malaysian-area occurrence rows for a classroom baseline.
3. Records occupy more than one location or coarse spatial block.
4. The set represents more than one ecological/taxonomic group.
5. The species is understandable in a public-facing TideTrace MY demonstration.

The selected set covers a marine reptile, reef fishes and a marine mammal. Initial OBIS Malaysia counts were 667 for *Chelonia mydas*, 405 for *Amphiprion ocellaris*, 146 for *Orcaella brevirostris* and 112 for *Zanclus cornutus*. These are screening counts, not final training counts: quality filtering and grid deduplication substantially reduce them.

Several candidates were rejected during screening. *Dugong dugon* returned no Malaysia-area records in the query used here; *Tursiops aduncus* and *Sousa chinensis* returned only 11 and 9; *Rhincodon typus* returned 32 and was considered too sparse for the main four. Horseshoe crabs had more records but were not retained after the project chose *Zanclus cornutus* as the fourth demonstration species.

This selection is therefore a project-design decision, not a claim that these are Malaysia's four most important marine species. The exact species list is versioned in `config.json`.

The reproducible pipeline is:

```text
OBIS occurrence rows
  -> reject invalid/absent/dropped/non-marine/low-quality points
  -> reject uncertainty > 25 km
  -> retain points inside the current Malaysian EEZ geometry
  -> collapse observations into 0.1° presence cells
  -> retain only cells whose centre is also inside the EEZ
  -> sample three EEZ background cells per presence cell
  -> train with latitude and longitude only
```

The background label `0` means **sampled background**, not verified absence. The exact label source is retained in every training CSV.

### Current dataset

Generated on 2026-08-29 from the source queries preserved in `data/download_manifest.json`:

| Species | Raw OBIS rows | Accepted observations before grid merge | Presence cells | Background cells | Training rows |
|---|---:|---:|---:|---:|---:|
| *Chelonia mydas* | 667 | 155 | 113 | 339 | 452 |
| *Amphiprion ocellaris* | 405 | 191 | 39 | 117 | 156 |
| *Orcaella brevirostris* | 146 | 43 | 11 | 33 | 44 |
| *Zanclus cornutus* | 112 | 63 | 17 | 51 | 68 |

`Orcaella brevirostris` and `Zanclus cornutus` are small-sample demonstration models. Their apparent validation scores are uncertain and should not be used for operational or conservation decisions.

## Models and evaluation

Three coordinate-only candidates are trained for each species:

1. Logistic Regression — the most interpretable linear baseline.
2. Quadratic Logistic Regression — adds latitude², longitude² and an interaction.
3. Random Forest — captures nonlinear and disconnected spatial patterns.

Evaluation uses 1° spatial blocks with stratified grouped cross-validation. A maximum of five folds is used; the dolphin model uses three because its 15 presence cells occupy only three 1° blocks. This is stricter than a random row split and reduces leakage from nearby cells.

The selected model is the candidate with the highest spatial cross-validation PR-AUC, with ROC-AUC used as a tie-breaker. Because the training prevalence is fixed at 25%, the no-skill PR-AUC reference is 0.25.

### Why the selected algorithms differ by species

The four species are four separate binary prediction tasks. No single estimator combines Logistic Regression and Random Forest internally. The current model registry independently selects the best evaluated candidate for each species, which is why the selected algorithms differ.

This is technically valid for serving species-specific predictions, but the scores must not be compared as if they were calibrated probabilities on one common scale. Separate background samples already limit cross-species comparability, and different estimator families add another difference. For a course presentation that requires one consistent named baseline, use the four saved `__logistic_regression.joblib` models and present Random Forest as the comparison experiment. The committed `model_manifest.json` currently records the best-per-species selection rule so that the deployed choice is explicit rather than hidden.

| Species | Selected model | Spatial CV folds | ROC-AUC | PR-AUC | Brier score |
|---|---|---:|---:|---:|---:|
| *Chelonia mydas* | Random Forest | 5 | 0.752 | 0.441 | 0.171 |
| *Amphiprion ocellaris* | Random Forest | 5 | 0.686 | 0.420 | 0.180 |
| *Orcaella brevirostris* | Logistic Regression | 3 | 0.755 | 0.429 | 0.216 |
| *Zanclus cornutus* | Random Forest | 5 | 0.801 | 0.517 | 0.161 |

All candidate results are in `artifacts/model_metrics.csv`; fold composition is in `artifacts/spatial_cv_folds.json`. High scores for a small dataset do not remove sampling-bias or pseudo-absence limitations.

## Repository contents

```text
species-distribution/
├── config.json                       # species and experiment settings
├── build_dataset.py                  # download, clean, grid and sample backgrounds
├── train.py                          # train, spatially evaluate and create heatmaps
├── predict.py                        # command-line inference
├── tidetrace_sdm.py                  # geometry/grid helpers
├── requirements.txt
├── data/
│   ├── raw/                          # selected OBIS fields, one CSV per species
│   ├── reference/                    # Marine Regions Malaysia EEZ GeoJSON
│   ├── processed/                    # presence grids and final training CSVs
│   └── download_manifest.json        # source URLs, timestamps and licences
├── models/
│   ├── model_manifest.json
│   ├── <species>.joblib              # selected model
│   └── <species>__<candidate>.joblib # every evaluated candidate
├── artifacts/
│   ├── model_metrics.csv
│   ├── spatial_cv_folds.json
│   └── heatmaps/                     # probability-grid CSV and SVG per species
└── tests/
    └── test_core.py
```

## Run locally

From this directory:

```powershell
python -m venv .venv
& .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Re-download and rebuild the dataset:

```powershell
python build_dataset.py --force
```

Rebuild from already downloaded raw files without network access:

```powershell
python build_dataset.py
```

Train and evaluate all candidates:

```powershell
python train.py
```

Predict all four species at one coordinate:

```powershell
python predict.py --latitude 3.05 --longitude 103.55
```

Predict one species:

```powershell
python predict.py --latitude 3.05 --longitude 103.55 --species green_sea_turtle
```

The output includes `inside_malaysian_eez`. Predictions outside the study area are returned with a warning and should not be displayed as valid model results.

Run the unit tests:

```powershell
python -m unittest discover -s tests -v
```

## Backend integration and deployment

Training and serving are deliberately separate:

```text
Developer machine / training job        Backend service
--------------------------------        ---------------
download OBIS                           load selected .joblib files once
clean and grid records                  validate latitude/longitude
generate background cells               call predict_proba
train and evaluate candidates           return JSON
write versioned model artifacts
```

Do not run `build_dataset.py` or `train.py` during a web-service deployment. Deployment should be deterministic and must not depend on OBIS being reachable.

### Runtime files to package with the backend

Only these files are required for prediction:

```text
models/model_manifest.json
models/<species>.joblib
data/reference/malaysia_eez_marineregions_v12.geojson
tidetrace_sdm.py (or an equivalent small geometry helper)
a backend inference service module
```

Candidate `__<algorithm>.joblib` files, raw CSVs, training CSVs and heatmaps are useful for audit and reproduction but do not need to be loaded by the API.

The present repository's Render service uses `actual-project/backend` as its root directory. For robust deployment, copy the runtime subset into a versioned directory such as `backend/species_distribution/` or change the service packaging so the sibling module is guaranteed to be available. Do not rely on an undocumented parent-directory path at runtime.

### Load once, not once per request

The backend should load the four model bundles during application startup and keep them in memory. Loading Joblib files inside every request adds latency and unnecessary disk access.

A framework-neutral inference function has this shape:

```python
def predict_all(latitude: float, longitude: float) -> list[dict]:
    features = pandas.DataFrame(
        [{"latitude": latitude, "longitude": longitude}]
    )
    return [
        {
            "species_slug": slug,
            "relative_occurrence_score": float(
                bundle["model"].predict_proba(features)[0, 1]
            ),
            "selected_model": bundle["model_name"],
        }
        for slug, bundle in loaded_models.items()
    ]
```

Validate that latitude is between -90 and 90, longitude is between -180 and 180, and the point is inside the supported Malaysian EEZ. A location outside the study geometry should return a clear validation error rather than an apparently valid score.

### Suggested API contract

```http
POST /api/species-distribution/predict
Content-Type: application/json
```

Request:

```json
{
  "latitude": 3.05,
  "longitude": 103.55
}
```

Response:

```json
{
  "latitude": 3.05,
  "longitude": 103.55,
  "inside_malaysian_eez": true,
  "score_type": "relative_occurrence",
  "calibrated_probability": false,
  "predictions": [
    {
      "species_slug": "green_sea_turtle",
      "scientific_name": "Chelonia mydas",
      "relative_occurrence_score": 0.808614,
      "selected_model": "random_forest"
    }
  ]
}
```

The endpoint should be stateless. It does not need to store the submitted coordinate or prediction in the database unless a separate product requirement explicitly asks for that.

### Flask and FastAPI

The model layer is independent of the web framework:

- Flask: load the model registry when creating the Flask application, then call the inference function from an `@application.post(...)` route.
- FastAPI: load the same registry in the application lifespan handler, validate the request with a Pydantic model, then call the same inference function from `@app.post(...)`.

The current repository backend is Flask, so changing frameworks is unnecessary for this model.

### Python runtime dependencies

Add the model runtime packages to the backend deployment requirements:

```text
joblib
numpy
pandas
scikit-learn
```

Use compatible versions with `requirements.txt`. Scikit-learn model persistence is not guaranteed across arbitrary library versions, so deployment should pin the versions used for training and retrain the artifacts when intentionally upgrading scikit-learn.

### Render deployment sequence

1. Package the selected models, manifest, EEZ geometry and inference module under the backend service root.
2. Add the runtime dependencies to `backend/requirements.txt`.
3. Add the prediction route and automated API tests.
4. Keep the existing Flask/Gunicorn start command; no separate model server is needed for this small baseline.
5. Push the deployment branch and allow Render to rebuild.
6. Check `/health`, then test one valid Malaysian EEZ coordinate, an invalid latitude, a missing field and an out-of-area coordinate.
7. Confirm that the response says `relative_occurrence` and `calibrated_probability: false`.

The current branch contains the complete model artifact and documentation but intentionally does not modify the existing application API. Integration should be a separate reviewed change because it affects the backend contract and frontend behavior.

## Data dictionary

The final `<species>_training.csv` files contain:

| Column | Meaning |
|---|---|
| `cell_id` | Stable 0.1° grid identifier |
| `latitude`, `longitude` | Grid-centre WGS84 coordinates used by the model |
| `scientific_name`, `species_slug` | Target species identifiers |
| `label` | `1` for gridded OBIS presence; `0` for generated background |
| `label_source` | Explicit presence/background provenance |
| `observation_count` | Raw accepted OBIS observations merged into a presence cell |
| `source_dataset_count` | Number of OBIS source datasets represented in that cell |
| `example_*` | One traceable example occurrence, dataset and date |

## Limitations and next iteration

- OBIS sampling is uneven and clustered around accessible or studied sites.
- Different source datasets use different protocols and observation effort.
- Background cells are not confirmed absences.
- The 3:1 case-control sampling ratio changes the numeric classifier probability.
- Latitude and longitude describe location, not the ecological processes causing distribution.
- Current results do not model season, migration, temporal change or observation effort.
- Probability calibration is not scientifically identifiable from this presence-background dataset alone.

Iteration 2 should add bathymetry, sea-surface temperature, salinity, chlorophyll, distance to coast and season. It should also test target-group background sampling or sampling-bias weights and use external survey data containing verified absences for calibration.

## Licensing and attribution

OBIS aggregates datasets with different licences. The raw CSV files preserve each row's `license`, `dataset_id` and `datasetName`; the complete licence list and exact query URL for each species are in `data/download_manifest.json`. Some included records are CC BY-NC, so review attribution and non-commercial restrictions before redistributing the dataset or using it outside the course project.

Marine boundary data are from Flanders Marine Institute (2023), Maritime Boundaries Geodatabase, version 12, DOI [10.14284/632](https://doi.org/10.14284/632).
