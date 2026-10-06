# Standalone package checks

Validation date: 3 October 2026. Model version: `iteration3-upgrade-40-species-20261003`.

- Exactly 40 model files, each matching the original trained model SHA-256 fingerprint.
- All five frozen input/reference fingerprints verified. Training configuration and numerical core functions are preserved.
- At a supported reference coordinate, all 40 direct model scores match the frozen reference row. Location-match percentiles are independently checked from the saved 4,227-row matrix.
- **29 standalone service tests passed**, covering the full registry, four captured coastal coordinates, score/ranking consistency, input validation, strict/nearby behaviour and one cached registry per process.
- The actual local HTTP service passed `check_service.py`, including health, all four nearby predictions and 400/422 error handling.
- The portable training entry point successfully prepared all 157 candidates from an external working directory using the new standalone paths. No website source path or original local workspace is required.

Local HTTP checks ran on Windows with Python 3.13.7 and an existing clean dependency environment (pandas 3.0.5, joblib 1.6.0, scikit-learn 1.8.0). The release requirements pin the original training versions of pandas 3.0.3 and joblib 1.5.3. CI installs these pinned requirements in a clean Linux runner, reruns package/service tests, retrains clownfish offline, and starts the actual Gunicorn entry point.

Local cold start was approximately 3.63 seconds, with 203 MiB resident memory (213 MiB measured peak). Five nearby HTTP predictions had median latency about 18 ms. These are local Windows measurements, not hosting capacity guarantees. The standalone process did not load the website application, database libraries or ONNX litter detector.

Before this layout separation, a one-species reproduction of clownfish matched the original labels, partitions, parameter-selection results, test scores and all 4,227 final-grid scores exactly. Only package paths and entry points changed here; the selected weights were not retrained. The workflow's new-path training check verifies that the standalone layout remains executable.

These are artifact and software checks, not validation of ecological probability, current sightings or cross-species ranking accuracy. Publishing the branch does not deploy a public service; use `check_service.py` against the actual deployed origin after hosting is configured.
