# Species model training

This directory replays the original Iteration 3 coordinate-only training design from frozen **processed** OBIS snapshots. It does not download OBIS records, reconstruct the raw-data audit, or install models into the application. The adjacent application uses a curated 40-animal subset; this training snapshot retains the original 157 candidates: 151 animals and six marine seagrasses.

## Setup and entry point

Run these commands from `actual-project/species-training`. The original environment was Python 3.13.7; dependency versions are pinned in `requirements.txt`.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python train.py --help
```

On macOS/Linux, activate with `source .venv/bin/activate`. Installing dependencies may require internet access or a local wheel cache. Once dependencies and the repository reference files are available, training itself runs offline.

Train all 157 frozen candidates:

```powershell
python train.py --workers 4
```

The default output is `species-training/runs/current`, resolved relative to the script, independently of the shell's working directory. Outputs must go into a new, empty directory; the script rejects application/backend and input directories and never replaces an existing run.

Train one species, or repeat `--species` for a selected subset:

```powershell
python train.py --species "Amphiprion ocellaris" --workers 1 --output-dir runs/clownfish
python train.py --species "Chelonia mydas" --species "Orcaella brevirostris" --workers 2 --output-dir runs/turtle-dolphin
```

Names must match the frozen scientific names in `config.json`. Omitting `--species` trains all 157, not only the application's 40. A repeated scientific name is trained once. Workers run species in parallel; each numerical model uses one thread. On Windows, the process pool needs permission to create local worker processes.

Validate inputs and save the configuration without fitting models:

```powershell
python train.py --prepare-only --output-dir runs/prepared
```

The default shared references are:

- `../backend/species_distribution/reference/marine_grid.csv`
- `../backend/species_distribution/reference/malaysia_eez_marineregions_v12.geojson`

For another checkout layout, use `--reference-dir path/to/reference`. Both files must match the original SHA-256 fingerprints recorded in `data/provenance.json`. The script also checks the frozen processed-data and name-configuration fingerprints. This protects the original cell ordering as well as the geography; changing inputs requires a separately reviewed training design.

## Frozen inputs and provenance

`data/presence_cells.json` contains 2,498 unique species-cell rows for the 157 candidates. `data/species_audit_table.json` contains their 157 audit rows, with the obsolete `tier` column removed. These cells summarize 6,829 accepted observations; observation counts are metadata, not duplicated training samples or model weights. The original regional download contained 69,991 records across 5,458 named taxa before preprocessing, not 69,991 independent training examples for these models.

The original audit resolved species from OBIS species fields, filtered absent/dropped/invalid or flagged non-marine records, excluded known coordinate uncertainty above 25 km, and required occurrence points and their 0.1-degree cell centres to fall within the frozen Malaysia EEZ. Unknown uncertainty remained unknown. Each retained candidate had at least ten distinct positive cells. No additional one-degree block or recent-year gate is applied in this replay.

`data/provenance.json` records the original source-code and input-file hashes, original environment and training configuration hash, processed-file/reference fingerprints, 44 contributing dataset identifiers and names, per-species source counts and years, and the license values supplied with occurrence metadata. Some observations carry CC-BY-NC terms or no supplied license. These metadata do not grant additional reuse rights or cover photographs. No occurrence photographs or raw OBIS records are included here.

`config.json` preserves the original 157 scientific names and file identifiers. If present, `../backend/species_distribution/models/model_manifest.json` supplies only updated display names and slugs for matching candidates. Its model parameters, evaluation results, recommendation flags, and ranking settings never affect fitting. The original four slug aliases always remain:

| Scientific name | Frozen slug |
| --- | --- |
| *Chelonia mydas* | `green_sea_turtle` |
| *Amphiprion ocellaris* | `ocellaris_clownfish` |
| *Orcaella brevirostris* | `irrawaddy_dolphin` |
| *Zanclus cornutus* | `moorish_idol` |

The per-run provenance stores the checksum of any display-name manifest used. A checkout without that manifest still trains using the frozen names. Scientific-name placeholders in the full 157-name configuration are not independently verified English common names.

## Training and evaluation

Only latitude and longitude are model inputs. Every species has the same 4,227 marine grid cells. A label of **1** means at least one accepted historical occurrence was recorded in that species-cell. **0** means unrecorded background, not confirmed absence. Species are fitted independently; the many background cells are retained, with balanced class weights.

The unchanged seed is `20261003`; the species-specific seed is derived from a stable scientific-name SHA-256 hash. The numerical training configuration retains the original hash:

```text
91312f941d59f29ffe1d17e13c741efa16537eb870e14b0ebc6470c2e325c136
```

For each species, training follows these steps:

1. Create one fixed stratified cell split: 3,381 development cells and 846 held-out test cells. No redraw or repeated outer evaluation is performed.
2. Compare seven fixed model candidates using three stratified folds within the development partition: ordinary logistic regression and quadratic logistic regression at `C = 0.01, 0.1, 1.0`, plus a 200-tree random forest with maximum depth 10 and minimum leaf size 5.
3. Select by mean development-fold average precision (AP), then mean ROC AUC for exact AP ties; fixed candidate order resolves any remaining exact tie. The held-out test does not select parameters.
4. Fit an evaluation model on development cells only and compute the held-out ROC AUC, AP, AP baselines/lifts, and top-10-percent positive recall.
5. Fit the chosen model again on all 4,227 cells to produce the final exported model and its full-grid scores. The final full-data model is different from the development-only evaluation model; its full-grid scores are not held-out predictions.

Every successfully fitted model is saved. Its separate `default_recommendation` flag requires finite, nonconstant final scores and held-out AP above the analytical mean AP of a uniform random ranking with the same test row and positive counts. This baseline comparison is a minimal project screening rule, not a significance test or an accuracy certification. Weak-evidence models remain exported with the flag false.

This is a cell interpolation check in the existing marine domain. Adjacent cells may cross the split. It does not validate transfer to a new one-degree region, current beach sightings, true ecological absence, calibrated presence probabilities, or cross-species ranking accuracy. Small positive test counts make many per-species estimates uncertain. Old validation results using other splits or background sampling are not directly comparable.

The script saves raw `predict_proba`-derived relative historical occurrence scores. Application ranking uses the separately implemented within-species empirical percentile against the saved 4,227-cell reference scores. Such a location-match score is a display heuristic, not a probability or evidence that one species is biologically more likely than another. This directory does not run application prediction, choose the product's 40-species catalog, or deploy a run.

## Outputs

Each run contains:

- `training_config.json`, `input_provenance.json`, candidate/exclusion lists, progress, `validation_results.json`, and `training_summary.json`.
- `models/*.joblib` and `models/model_manifest.json`: final models fitted on all marine cells.
- `evaluation_models/*.joblib`: development-only evaluation models and saved development indices.
- `validation_predictions/*.npz`: labels, development/test indices, held-out scores, final full-grid scores, and development fold membership (`-1` marks test cells).
- `parameter_selection/*.json`: all candidate development-fold metrics and the selected parameters.
- `marine_grid_scores.npz`: final score matrix with scientific names, cell identifiers and coordinates, for a separately reviewed inference integration.
- `reference/`: the frozen marine grid and EEZ copied for the run.

`runs/`, local virtual environments, and Python caches are ignored by Git. This repository includes the processed replay inputs; reproducing the original raw-data collection and filtering would require the original OBIS download snapshots and preprocessing workflow, which are not bundled here.

## Reproduction check performed

The portable entry point was run for *Amphiprion ocellaris* using the adjacent repository's default reference files: 39 positive cells and eight held-out positive cells. The chosen parameters, all development-fold selection metrics, and test metrics matched the original run exactly. Labels, development/test indices, inner-fold membership, all 846 held-out scores, and all 4,227 final grid scores were element-for-element equal, with maximum absolute difference zero. The 16 original core helper/training functions also retained identical abstract syntax trees; portability changes affect input loading, worker initialization and run/output handling.

This is a one-species software/numerical reproduction check, not a new full-157 run or an ecological ranking validation. Its local check record is `runs/reproducibility-check-final/reproduction_verification.json` and is intentionally not a committed model artifact. Use the pinned environment for the closest reproducibility; another numerical-library version or platform has not been verified to reproduce exact floating-point results.
