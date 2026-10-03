# Iteration 3 release checks

Local validation completed on 3 October 2026 for `iteration3-upgrade-40-species-20261003`.

| Check | Result |
| --- | --- |
| Fresh Python 3.13.7 environment, complete backend requirements | Installed successfully without changing existing pins |
| Full backend regression suite | 175 tests passed, 93.06 seconds |
| Frontend full regression suite | 141 tests passed before the final icon/type adjustment |
| Final frontend species regression checks | All six passed after excluding cuttlefish from the fish icon category and making exact-mode interpretation optional |
| Frontend type checking | Passed on the final source |
| Frontend production build | Passed again on the final source |
| Actual application factory and HTTP release check | Passed with all 40 species and the existing ONNX litter recognizer loaded and warmed |
| Frozen input Git-blob checks | All five checked input/reference files match their recorded SHA-256 fingerprints |
| Model registry integrity | Exactly 40 unique models; every model hash matches its original trained artifact |
| Standalone extracted model package | All packaged file hashes and example prediction passed |
| One-species offline retraining | Clownfish labels, partitions, fold membership, parameter-selection metrics, test scores and all 4,227 final grid scores exactly match the original run |

The HTTP check exercises health, the 40-species catalogue, nearby-mode predictions at the four captured beach coordinates, invalid input (400), and strict out-of-area handling (422). Numerical API tests independently compare every nearby raw score and location-match percentile against the frozen reference matrix. These are software checks, not ecological accuracy checks.

The local cold process took 7.337 seconds to import and create the complete application. Windows resident memory was approximately 361 MiB after startup, with a measured peak of 415 MiB. These measurements include loading and warming the existing approximately 80 MB ONNX recognizer. They are local Windows measurements, not a guarantee of Linux or Render memory consumption. Linux Gunicorn execution and the public Render deployment were not performed locally.

The frozen geography has the same parsed geometry as the original repository. Its original CRLF bytes are now preserved as a data asset because offline training verifies the original SHA-256 fingerprint. `.gitattributes` prevents checkout line-ending conversion for all checksum-protected inputs.

CI runs the full backend suite, a one-species offline retraining check, frontend type checking, tests and production build. Check the workflow for the pushed commit for its final Linux results. After switching deployment services, run [the read-only deployment check](../scripts/check_species_release.py) against the actual API origin and confirm the version and count. No public-service upgrade is inferred from a successful Git push.
