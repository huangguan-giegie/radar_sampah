# Offline species-distribution baseline

These four model files and the Malaysian EEZ reference geometry were extracted from
`origin/obis-species-model` at commit `a4dd12ae318bf92238f0583984ab2ef01b6d0cd3`.
The API loads them once at startup and exposes relative occurrence/suitability context through
`POST /api/species-distribution/predict`.

The scores are based on an offline OBIS snapshot and generated background samples. They are not
calibrated probabilities, not a real-time OBIS query, and do not contribute to litter severity.
The endpoint does not persist request coordinates or prediction results.
