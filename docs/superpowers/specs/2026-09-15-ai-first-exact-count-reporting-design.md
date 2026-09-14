# AI First Exact Count Reporting Design

## Goal

Make report creation start with AI recognition, then let the participant confirm or correct exact item counts. Keep the existing quantity-band score stable and improve recognition of small litter in scene-level photos without returning to the memory-heavy PyTorch runtime.

## Approved user experience

The new report flow is:

1. Add a photo.
2. Select or confirm the beach.
3. Run AI recognition and prepare editable suggestions.
4. Show **What did you find?** with exact positive whole-item counts prefilled when detections exist.
5. Let the participant add, remove, or correct categories and counts, then explicitly confirm the values.
6. Review and submit the report.

The participant is never asked to choose Small, Medium, Large, or Very Large. If AI is unavailable, fails, or returns no detections, the count screen opens empty with a clear manual-entry message. An empty result is not presented as a successful suggestion.

## Data and scoring

`itemCounts` is the authoritative participant-facing quantity for new reports. Each selected category has a positive whole-item count.

`quantities` remains an internal compatibility field because the existing score, historical records, and public method use quantity bands. The application derives bands from confirmed counts using the existing mapping:

- 1 to 5 items: Small
- 6 to 20 items: Medium
- 21 to 50 items: Large
- 51 or more items: Very Large

The category weights, report maximum, beach aggregation, freshness window, minimum evidence rule, score thresholds, and public attention bands do not change. Raw item counts do not directly multiply the score.

Legacy reports that contain bands but no `itemCounts` remain valid and scoreable. The application does not invent exact counts for them. Where `itemCounts` exists, report review, saved confirmation, report detail, and personal report summaries display exact counts instead of bands.

Cleanup actions continue to subtract exact confirmed counts from the target report. The scoring band is derived again from the remaining exact count.

## AI recognition

The production ONNX model remains fixed at 320 pixels to stay within Render's 512 MiB memory limit. For a scene-level image whose litter becomes too small after whole-image resizing, inference processes a small set of overlapping 320-sized crops sequentially. Sequential execution keeps peak model memory stable.

Crop detections are translated back to original-image coordinates and merged with class-aware non-maximum suppression so overlap does not double-count the same item. The implementation keeps the current confidence threshold unless the supplied beach photo proves that a narrowly lower threshold is required and remains acceptably precise.

The supplied `Beach_in_Sharm_el-Naga02.jpg` is a manual regression image for implementation verification and is not committed to the repository. Success requires the production-style recognizer to return at least one supported litter detection for that image. The API must still return a safe manual-entry state when no reliable detection exists.

The same recognition behavior is used by report and cleanup photo suggestions. Cleanup must not show a success toast when the returned count set is empty.

## Beach cleanup button

On the beach detail page, the button remains a navigation action and displays:

**Add a Cleanup** *(commit to cleaning it)*

The parenthetical text is visually smaller. No checkbox, acknowledgement field, or backend change is added.

## Compatibility and validation

- The frontend derives `quantities` from confirmed `itemCounts` immediately before submission.
- The backend accepts exact counts as the source and validates positive whole numbers and supported categories.
- Existing band-only API records and correction flows remain supported.
- Duplicate comparison uses exact counts when both reports have them and falls back to bands for legacy records.
- Direct URL and resume guards follow the new AI-before-count order.
- Editing an existing band-only report opens a manual exact-count form without fabricating counts; its previous band remains available only until the participant supplies confirmed counts.

## Verification

Automated checks cover:

- report route order and resume guards;
- AI suggestions reaching the exact-count form before confirmation;
- empty AI results producing manual entry rather than success;
- exact-count validation and deterministic internal band derivation;
- legacy band-only report compatibility;
- exact counts in review and report displays;
- cleanup empty-result messaging;
- the smaller cleanup commitment subtitle;
- crop coordinate translation and overlap de-duplication;
- existing backend and frontend regression suites.

Manual checks cover the supplied beach photo, a no-detection photo, mobile-sized report screens, cleanup suggestions, and the deployed frontend-to-backend flow.

## Non-goals

- Replacing the trained model or adding a paid vision provider.
- Changing category weights, score aggregation, score thresholds, or public band labels.
- Backfilling guessed exact counts for historical reports.
- Turning Add a Cleanup into a contractual acknowledgement or checkbox.
