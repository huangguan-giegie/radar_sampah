# Iteration 3 model upgrade

**A standalone package of 40 coordinate-only species models.** This branch contains model artifacts, inference entry points, training code, processed data and documentation. It is independent of the Radar Sampah website and requires no application database, frontend, authentication system or litter detector.

本分支是独立的40物种模型交付，保留原四种。根目录就是模型包，包含推理入口、依赖、训练代码和说明；网站前后端的接入由后续集成工作处理。

Model version: `iteration3-upgrade-40-species-20261003`. Delivery branch: **`iteration3-model-upgrade`**. The 40 weights were selected from the existing 157-model training run; their learned parameters and recorded test results have not changed during packaging. The complete list is in [SPECIES.md](SPECIES.md).

## Run a prediction

Use Python 3.13.7. From the root of this branch:

```sh
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python predict.py --latitude 2.75 --longitude 101.35 --top-k 5
```

This is strict inference at the supplied coordinates. An unsupported coordinate produces an error. To explicitly request nearby marine-grid context for a coastal point:

```sh
python predict.py --latitude 2.789 --longitude 101.415 --nearby-marine --top-k 5
```

The default nearby limit is 15 km. The response discloses the original point, selected grid centre and distance moved. The grid centre is not a beach sighting location. `top-k 0` returns all 40 scores with an empty recommendation list.

For Python integration, load the registry once and reuse it:

```python
from inference import SpeciesDistributionModel

model = SpeciesDistributionModel()
result = model.predict(2.75, 101.35, top_k=5)
# Explicit coastal alternative:
nearby = model.predict_nearby_marine(2.789, 101.415, top_k=5)
```

Inference is offline. It does not contact OBIS, train models or download weights at startup.

## Optional standalone service

`serve.py` is a small model-serving entry point. It loads the same files as the Python/CLI entry points and needs no website code.

For local development, run `python serve.py` (port 5000 by default). On Linux, deploy with:

```sh
gunicorn --workers 1 --threads 4 --timeout 60 --bind 0.0.0.0:$PORT 'serve:create_app()'
```

| Endpoint | Meaning |
| --- | --- |
| `GET /health` | Loaded model version and count |
| `GET /species` | Scientific names and available descriptive metadata |
| `POST /predict` | Model scores for a coordinate |

Example prediction body:

```json
{"latitude":2.789,"longitude":101.415,"mode":"nearby_marine","topK":5}
```

`mode` defaults to `exact`. Nearby mode always selects a saved marine-grid centre within a fixed 15 km limit. `topK` defaults to five; it changes the length of `topPredictions`, while `predictions` retains all 40 species. Invalid inputs return 400. Unsupported locations return 422. There is no silent fallback from exact to nearby mode.

To deploy on Render, create a **separate Web Service** using branch `iteration3-model-upgrade`, leave Root Directory empty, build with `pip install -r requirements.txt`, and use the Gunicorn command above. [render.yaml](render.yaml) supplies these settings. Pin Python to 3.13.7; a dashboard `PYTHON_VERSION` overrides `.python-version` ([Render version selection](https://render.com/docs/python-version)). Keep the website's existing services on their current branches. This independent service exposes only model endpoints; website integration is subsequent work.

Check a running service with:

```sh
python check_service.py http://127.0.0.1:5000
# For a deployed service, replace the origin with its HTTPS address.
```

No public service has been deployed by publishing this branch. The service is stateless and does not save submitted coordinates. Keep the supplied model files, manifest, reference files and score matrix together when deploying.

## How we prepared the dataset

OBIS supplied paginated JSON occurrence records: species identities, latitude/longitude, dates where supplied, dataset identifiers, licences and quality metadata. The original download contained **69,991 records from a Malaysian regional query (`areaid=140`)**, not the entire global OBIS database.

The project built the training data by resolving species identities, filtering unusable coordinates and recorded marine-quality flags, excluding known coordinate uncertainty above 25 km, and requiring both the observation point and its 0.1-degree cell centre to lie in the frozen Malaysian EEZ. Unknown coordinate uncertainty was retained as unknown. Repeated records for the same species and cell were aggregated into one occupied cell.

Every species uses the same **4,227 marine-grid centres**. Latitude and longitude are the only features. A cell with an accepted record of that species receives label **1**; every other grid cell receives background label **0**. Background is an unrecorded cell, not a confirmed ecological absence. Observation counts and dates remain audit information rather than extra model inputs or sample weights.

For example, clownfish has 191 accepted observations occupying 39 cells, resulting in 39 positive cells and 4,188 background cells. Repeated observations in one cell do not create additional training rows.

The portable snapshot in `training/data/` contains 2,498 species-cell rows for the original 157 candidates, summarising 6,829 accepted observations. It contains processed aggregates, not the raw OBIS download. Source dataset names, identifiers and recorded licence values are preserved in [training/data/provenance.json](training/data/provenance.json).

## How the models were trained and selected

Each species goes through the same training functions with its own label vector and deterministic species-specific seed:

1. Make one fixed stratified split: 3,381 development cells and 846 held-out test cells.
2. Within the development partition, use three-fold validation to compare seven configurations: ordinary and quadratic logistic regression at `C = 0.01, 0.1, 1`, plus a 200-tree random forest (maximum depth 10, minimum leaf size 5). Logistic regression scaling stays inside each fitted pipeline.
3. Select using mean development-fold average precision (AP), then mean ROC AUC for an exact tie. The held-out test does not choose parameters or redraw the split.
4. Fit an evaluation model on development cells and evaluate the held-out cells once.
5. Refit the selected configuration on all 4,227 cells to produce the final serving model. The saved test metrics refer to the development-only evaluation model, not a separate held-out test of the final refit.

Class weighting is balanced for logistic regression and balanced per bootstrap sample for random forests. The released 40 models consist of **36 random forests, three quadratic logistic regressions and one ordinary logistic regression**. They are independent binary presence/background models, not one mutually exclusive 40-class classifier.

The original candidate scope required ten accepted presence cells and excluded the terrestrial coconut taxon. All 40 selected animals pass the existing minimal release check: finite, nonconstant final scores and held-out AP above the analytical mean AP of a uniformly random ranking with the same test size and positive count. That comparison is not a significance test. No new ROC, spatial-region, recent-year or repeated-split gate was introduced for this release.

The original four species remain: green sea turtle, ocellaris clownfish, Irrawaddy dolphin and Moorish idol. The release adds a range of marine animal groups. Forty is the requested product scope, not a validated capacity limit or claim of equal evidence quality across species. Some species have only two or three positive test cells. See [validation_summary.json](validation_summary.json) for individual counts, metrics and model fingerprints.

## What the outputs mean

- `relativeOccurrenceScore` is the original model score on a 0–1 scale. It is **not a calibrated probability of seeing an animal**.
- `locationMatchScore` is the score's midrank percentile within the same species' frozen scores over all 4,227 marine cells: `(number below + 0.5 × number equal) / 4227`.
- `topPredictions` ranks eligible, nonzero-score animals by this location-match value, then scientific name. It is an optional display heuristic; consumers can also inspect every raw score in `predictions`.

A low raw score can have a high location percentile. The scores do not sum to one. Random grid-cell holdout has not validated cross-region transfer, current beach sightings or cross-species Top-5 accuracy. Historical recording effort is uneven, and species with distant records can enter a ranking. The intended use is historical distribution context and biodiversity education.

## Reproduce and verify

The [training guide](training/README.md) explains the portable code and the frozen processed inputs. To reproduce one species from the root:

```sh
python training/train.py --species "Amphiprion ocellaris" --workers 1 --output-dir training/runs/clownfish
```

Omitting `--species` trains all original 157 candidates, including six seagrasses. This does not overwrite the released 40 weights. Every run must use a new, empty output directory. The input byte fingerprints are checked before training.

For package and service tests:

```sh
python -m pip install -r requirements-dev.txt
python verify_bundle.py
python -m pytest -q
```

The validation workflow also trains one species offline and runs an actual Linux Gunicorn service check. File-hash and runtime checks establish software consistency, not ecological validity. The recorded source training environment and hashes are in [training_provenance.json](training_provenance.json).

| Files | Purpose |
| --- | --- |
| `models/` | Exactly 40 final models and their manifest |
| `reference/`, `marine_grid_scores.npz` | Frozen grid, boundary and per-species reference scores |
| `inference.py`, `predict.py`, `serve.py` | Python, command-line and optional HTTP inference |
| `training/` | Training code and processed 157-candidate snapshot |
| `species_catalog.json`, `SPECIES.md` | Names, counts and descriptive content; no photographs are packaged |
| `requirements*.txt`, `render.yaml` | Dependencies, tests and standalone deployment configuration |
