# Iteration 3 species model upgrade

This release expands the packaged biodiversity model registry from four to **40 animal species**. Beach pages request up to five historical distribution suggestions, retain model scores, and provide access to the full catalogue. The original four species remain included. The packaged models run locally in the backend; serving predictions does not require OBIS access, downloading weights, or training at startup.

The release is a selected subset of 157 successfully trained candidate models. Expanding the release changes which existing models are available and which species enter the displayed Top 5. It does not change the learned parameters or make an individual model more accurate.

## What the dataset contains

OBIS supplied structured historical occurrence records, including scientific names, coordinates, dates where available, dataset identifiers, quality information and licences. We downloaded a completed **69,991-record Malaysian selection** using `areaid=140`, excluding absence and dropped records. This was a regional query, not the entire global OBIS database. The raw response format was paginated JSON.

We constructed the model-ready data:

1. Use OBIS-resolved species identities; genus-only records are not invented into species.
2. Check coordinates, marine/quality flags, known coordinate uncertainty, and the existing Malaysian EEZ boundary. Records with known uncertainty above 25 km are excluded; missing uncertainty is retained as unknown, not treated as proof of precision.
3. Map accepted records onto 0.1-degree cells. Require both the record and its cell centre to be inside the model boundary.
4. Aggregate repeated records for the same species and cell into one occupied cell, retaining observation counts and source information for auditing.
5. For each species, use the same **4,227 marine-grid centres** as latitude/longitude features. Label recorded cells `1` and all remaining grid cells background `0`.

Background means **no accepted record in this snapshot**, not a surveyed, confirmed absence. Neither observation counts nor dates are additional model inputs. Grid aggregation reduces repeated records at the same location, but does not remove survey bias or make cells independent ecological surveys.

For example, the frozen clownfish data contain 191 accepted observations in 39 cells. Its training vector therefore contains 39 ones and 4,188 background zeros. One cell has 40 observations but still contributes one positive training row.

## Training implementation

The training entry point is [species-training/train.py](../species-training/train.py). Every species goes through the same functions, with its own label vector, deterministic seed, fitted model and saved artifact. Training is parallelised across species; no shared classifier is overwritten in a loop.

Each species follows this procedure:

1. Create one fixed, stratified split: approximately 80% development cells and 20% held-out cells. The test partition contains 846 cells.
2. Within the development partition, use three-fold stratified validation to compare seven configurations: ordinary logistic regression with three `C` values, quadratic logistic regression with the same three values, and a 200-tree random forest with maximum depth 10 and minimum leaf size 5. Logistic regression scaling is fitted inside its pipeline for each training fold.
3. Select the configuration using mean development-fold average precision (AP), with mean ROC AUC breaking an exact AP tie. The test data do not select hyperparameters or redraw the split.
4. Fit an evaluation model on the development partition and evaluate the held-out cells once.
5. Refit the selected configuration on all 4,227 cells to create the final serving model. Reported test metrics belong to the held-out evaluation model, not to a separate test of this final all-cell refit.

Logistic regression uses balanced class weights; the forest uses balanced weights per bootstrap sample. The selected 40-model release contains 36 random forests, three quadratic logistic regressions and one ordinary logistic regression. The training procedure is shared, while each species selects and fits its own model.

The original candidate preparation required at least ten distinct accepted presence cells and excluded the terrestrial coconut taxon. All 40 selected animals passed the existing basic release check: held-out AP above the analytic mean AP of a uniformly random ranking for the same test size and positive count, plus finite, nonconstant final scores. This comparison is **not a statistical significance test**. No new ROC threshold, regional-block threshold, data-year veto or repeated-split acceptance rule was added to reach 40.

The selection preserves existing species and adds different animal groups and independently supported fish representatives. It is a product scope decision, not a claim that 40 is the statistical capacity limit. Some species have only two or three held-out positive cells. Per-species parameters, counts and metrics are in [validation_summary.json](../backend/species_distribution/validation_summary.json).

## Scores and recommendations

The system fits independent presence/background models, so several species can receive a high score at the same location. It is not a mutually exclusive 40-class classifier, and its outputs must not be normalised to sum to one.

- `relativeOccurrenceScore`: the model's original 0–1 score. It is not a calibrated probability of seeing an animal.
- `locationMatchScore`: the position of that score among the same species' frozen scores across all 4,227 reference cells, using the midrank empirical percentile. The frontend displays it as **Location match / 100**, without a probability percent sign.
- `topPredictions`: eligible selected animals with nonzero raw scores, sorted by location match and then scientific name, truncated to the requested count. The default count is five. `predictions` preserves every selected species' score.

The location-match transformation provides a common display scale; it does not validate ecological comparisons between species. A small raw score can still have a high percentile. Species with remote historical records may appear in the ranking, and adding candidates can change the displayed Top 5. The results support historical biodiversity context, not current sightings, population abundance, animal safety advice or litter-severity calculations.

## API and coastal coordinates

`GET /api/species-distribution/catalog` provides the model version, count and scientific-name-keyed catalogue.

The existing prediction route remains `POST /api/species-distribution/predict`. A request containing only latitude and longitude uses strict point prediction:

```json
{"latitude":2.75,"longitude":101.35}
```

Beach pages explicitly request nearby historical marine-grid context:

```json
{"latitude":2.789,"longitude":101.415,"mode":"nearby_marine","topK":5}
```

This mode selects the nearest saved marine-grid centre within a fixed 15 km limit and returns the requested point, used point, cell ID and displacement distance in `coordinateContext`. It never silently falls back from a failed exact request. Invalid input returns 400; an unsupported location returns 422. `topK: 0` keeps all species scores and returns no recommendation cards.

Kelanang and Morib select the same nearby grid cell, so their nearby-grid outputs are the same. That is the actual resolution of the model, not a separate beach-specific ecological finding. Only the four captured live API beach coordinates have been used in the local beach-output checks; the prototype's 101 beach entries have not all been validated.

## Deploy this branch

Use branch **`iteration3-species-upgrade`** for both services, or merge its reviewed changes into the deployment branch. The repository's existing `render.yaml` continues to define the runtime:

| Service | Root directory | Build | Start/output |
| --- | --- | --- | --- |
| API | `actual-project/backend` | `pip install -r requirements.txt` | `gunicorn --bind 0.0.0.0:$PORT 'app:create_app()'` |
| Frontend | `actual-project/frontend` | `npm ci && npm run build` | static output `dist` |

Use Python 3.13.7 for the API to match the training interpreter; `.python-version` and the blueprint pin it. A pre-existing dashboard `PYTHON_VERSION` setting takes precedence, so keep that setting consistent with this release ([Render version selection](https://render.com/docs/python-version)). Model compatibility depends especially on the pinned scikit-learn version in the backend requirements. Keep the existing database, authentication and frontend-origin settings. The species upgrade needs no new external credentials or database migration. Backend and frontend should be deployed together because the frontend uses the new explicit nearby mode and recommendation fields.

After deployment:

1. Check `/health` and `GET /api/species-distribution/catalog`; the catalogue must report 40 models and version `iteration3-upgrade-40-species-20261003`.
2. Send the nearby-mode example above; expect 40 entries in `predictions`, at most five in `topPredictions`, `calibratedProbability: false`, and disclosed coordinate displacement.
3. Open a beach page. Confirm loading/retry behaviour, the location-match label and nearby-grid explanation, correct names, and the full catalogue control.

The read-only automated check covers the catalogue, four captured beach coordinates and invalid/outside inputs. From the repository root, run:

```sh
python actual-project/scripts/check_species_release.py https://YOUR-API-SERVICE.onrender.com
```

All 40 `.joblib` model files, the reference CSV/geometry, frozen score matrix and catalogue are committed alongside the API. They are small enough to be ordinary Git files; they are separate from the existing litter detector's Git LFS assets. Do not replace just the model files: the loader, matrix, catalogue and manifest must be deployed together.

## Reproducing and auditing the release

[species-training/README.md](../species-training/README.md) explains offline retraining from the frozen processed dataset. The raw regional API download is not required for serving or for reconstructing these training labels. A fresh OBIS download can differ from this snapshot, so new training should be published as a new version.

[training_provenance.json](../backend/species_distribution/training_provenance.json) records the original training version, source file hashes and environment. The frozen snapshot includes dataset and licence attribution; occurrence licences must not be reused as image licences.

The four original species retain their existing photographs and attribution. Additional species use category icons when an exact, licensed image is not installed. Each catalogue entry has an introduction and supporting source links; a species account is not evidence of its occurrence at a particular beach.

This branch is prepared for deployment. Pushing it does not by itself prove that the existing public Render services are running the upgrade. Record the actual deployment version when the services are switched.

See [release validation](ITERATION3_VALIDATION.md) for the completed local tests, real application startup check and verification limits.

## 中文说明

本次提供40种动物的可运行模型包，保留原四种，按经纬度返回完整分数，并在海滩页最多推荐5种。原始记录来自OBIS；清洗、0.1度格子聚合、背景标签和训练数据由项目代码构建。每种物种调用同一训练流程，独立选参数、评估、保存模型。当前40种从已经训练完成的157个模型中选择，未通过更换划分或降低标准凑数量。

前端显示的是“地点匹配分”，不能解读为真实出现概率。附近海域模式明确记录使用格子与移动距离。部署时应同时更新后端代码、40个模型、参考数据、目录和前端，依照上面的启动命令及接口检查即可验证接入版本。
