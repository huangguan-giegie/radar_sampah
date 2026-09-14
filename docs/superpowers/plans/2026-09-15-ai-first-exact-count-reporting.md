# AI First Exact Count Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run litter recognition before the findings form, record exact item counts, preserve band-based scoring internally, improve small-object recognition within Render's memory limit, and clarify the cleanup action label.

**Architecture:** Add one persisted AI-result state to the report draft so route guards can place recognition before exact-count confirmation. Keep `itemCounts` as the participant-facing source of truth and derive the existing `quantities` bands at confirmation and API validation boundaries. Improve the existing fixed-size ONNX recognizer with a bounded whole-image plus four-crop pass and class-aware de-duplication, without loading another model or increasing the model input size.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, Flask, Python, Pillow, NumPy, ONNX Runtime, pytest, Render.

## Global Constraints

- Keep the production ONNX input at 320 pixels and CPU batch size 1.
- Keep peak inference memory compatible with Render's 512 MiB service.
- Do not add a paid provider, PyTorch, Ultralytics, or a new production dependency.
- `itemCounts` is the participant-facing quantity for new reports.
- Small, Medium, Large, and Very Large remain internal scoring compatibility values only.
- Preserve category weights, score thresholds, aggregation, freshness, evidence rules, and public bands.
- Do not invent exact counts for legacy band-only reports.
- Display `Add a Cleanup` followed by the smaller text `(commit to cleaning it)`; add no checkbox or backend field.
- Do not commit the user's `Beach_in_Sharm_el-Naga02.jpg` file.

---

### Task 1: Exact-count draft rules and AI-first route order

**Files:**
- Modify: `actual-project/frontend/src/AppContext.tsx`
- Modify: `actual-project/frontend/src/flowRules.ts`
- Modify: `actual-project/frontend/src/flowRules.test.ts`

**Interfaces:**
- Produces: `ReportDraft.aiModelState: 'ready' | 'empty' | 'unavailable' | null`.
- Produces: `quantityBandForCount(count: number): QuantityBand` and `quantityBandsForCounts(counts): QuantityByCategory`.
- Produces: route order `photo -> location -> confirm -> suggestions -> details -> review`.
- Consumes later: Tasks 2 and 3 use the draft state and count-to-band helpers.

- [ ] **Step 1: Write failing count conversion and route-order tests**

Add tests that express the exact public/internal boundary:

```ts
it.each([
  [1, 'Small'], [5, 'Small'], [6, 'Medium'], [20, 'Medium'],
  [21, 'Large'], [50, 'Large'], [51, 'Very Large'],
] as const)('derives the internal band for %s exact items', (count, band) => {
  expect(quantityBandForCount(count)).toBe(band);
});

it('runs AI before exact count confirmation', () => {
  const beforeAi = draft({ quantities: {}, itemCounts: null, aiDecision: null, aiModelState: null });
  expect(reachableStep(beforeAi)).toBe('suggestions');

  const afterEmptyAi = draft({ quantities: {}, itemCounts: {}, aiDecision: null, aiModelState: 'empty' });
  expect(reachableStep(afterEmptyAi)).toBe('details');
  expect(guardStep('review', afterEmptyAi)).toBe('/report/details');
});

it('submits exact counts with derived internal bands', () => {
  const result = buildReportSubmission(draft({
    quantities: {},
    itemCounts: { Plastic: 8, Other: 2 },
    aiDecision: 'confirmed',
    aiModelState: 'ready',
  }));
  expect(result.kind).toBe('create');
  if (result.kind === 'create') {
    expect(result.payload.itemCounts).toEqual({ Plastic: 8, Other: 2 });
    expect(result.payload.quantities).toEqual({ Plastic: 'Medium', Other: 'Small' });
  }
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/flowRules.test.ts`

Expected: failures because `aiModelState`, `quantityBandForCount`, and the AI-first route order do not exist.

- [ ] **Step 3: Add the minimal draft state and pure helpers**

Add the persisted field with a null default and reset it when the report photo changes. Implement the conversion once:

```ts
export function quantityBandForCount(count: number): QuantityBand {
  if (count <= 5) return 'Small';
  if (count <= 20) return 'Medium';
  if (count <= 50) return 'Large';
  return 'Very Large';
}

export function quantityBandsForCounts(
  counts: Partial<Record<LitterCategory, number>>,
): QuantityByCategory {
  return Object.fromEntries(
    Object.entries(counts)
      .filter(([, count]) => Number.isInteger(count) && Number(count) > 0)
      .map(([category, count]) => [category, quantityBandForCount(Number(count))]),
  ) as QuantityByCategory;
}
```

Update `STEP_ORDER` and `reachableStep` so a confirmed beach reaches `suggestions`, an AI result reaches `details`, and only confirmed positive counts reach `review`. Make `buildReportSubmission` derive `quantities` from `itemCounts` instead of trusting UI-created bands.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- src/flowRules.test.ts`

Expected: all `flowRules.test.ts` tests pass after legacy fixtures receive the correct `aiModelState` defaults.

- [ ] **Step 5: Commit the route and data rules**

```bash
git add actual-project/frontend/src/AppContext.tsx actual-project/frontend/src/flowRules.ts actual-project/frontend/src/flowRules.test.ts
git commit -m "Make exact counts the report input source"
```

---

### Task 2: AI preparation screen and exact-count findings form

**Files:**
- Modify: `actual-project/frontend/src/screens/AiSuggestionScreen.tsx`
- Modify: `actual-project/frontend/src/screens/RecordScreen.tsx`
- Modify: `actual-project/frontend/src/iteration2.ts`
- Modify: `actual-project/frontend/src/iteration2.test.ts`

**Interfaces:**
- Consumes: `ReportDraft.aiModelState` and `quantityBandsForCounts` from Task 1.
- Produces: AI results stored in `draft.itemCounts` before `/report/details` opens.
- Produces: exact-count confirmation that sets `aiDecision` and derived internal bands.

- [ ] **Step 1: Write failing tests for normalized AI results**

Add a pure normalizer in `iteration2.ts` and tests for positive counts and empty results:

```ts
it('keeps only positive whole AI counts', () => {
  expect(normalizeSuggestedCounts({ Plastic: 8, Glass: 0, Metal: 2.8 }))
    .toEqual({ Plastic: 8 });
});

it('treats a ready response with no detections as empty', () => {
  expect(effectiveAiModelState('ready', {})).toBe('empty');
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/iteration2.test.ts`

Expected: failures because the normalization helpers do not exist.

- [ ] **Step 3: Implement AI result preparation**

Implement:

```ts
export function normalizeSuggestedCounts(
  counts: Partial<Record<LitterCategory, number>>,
): Partial<Record<LitterCategory, number>> {
  return Object.fromEntries(
    Object.entries(counts).filter(([, count]) => Number.isInteger(count) && Number(count) > 0),
  ) as Partial<Record<LitterCategory, number>>;
}

export function effectiveAiModelState(
  state: AiSuggestion['modelState'],
  counts: Partial<Record<LitterCategory, number>>,
): AiSuggestion['modelState'] {
  return state === 'ready' && Object.keys(normalizeSuggestedCounts(counts)).length === 0 ? 'empty' : state;
}
```

Reduce `AiSuggestionScreen` to a recognition/progress step. After the API settles, patch `itemCounts`, `aiModelState`, `aiModelVersion`, clear stale `aiDecision`, and navigate to `/report/details`. On rejection, store an unavailable state and empty counts before navigating. Do not show an editable category form on this screen.

- [ ] **Step 4: Replace quantity bands with exact count inputs**

In `RecordScreen`, select categories with the existing chips, set a newly selected category to `1`, and render a numeric input for every selected category:

```tsx
<input
  type="number"
  min={1}
  max={100000}
  step={1}
  inputMode="numeric"
  value={draft.itemCounts?.[category] ?? 1}
  onChange={(event) => setCount(category, Number(event.target.value))}
/>
```

On confirmation, reject empty or non-integer counts, derive `quantities` through `quantityBandsForCounts`, set `aiDecision` to `confirmed` for a ready AI result and `manual` otherwise, then navigate to `/report/review`. Display a short callout when `aiModelState` is empty or unavailable. The back button returns to beach confirmation without rerunning AI accidentally.

- [ ] **Step 5: Run frontend tests and build**

Run: `npm test -- src/iteration2.test.ts src/flowRules.test.ts`

Run: `npm run build`

Expected: tests and TypeScript/Vite build pass with no errors.

- [ ] **Step 6: Commit the AI-first form**

```bash
git add actual-project/frontend/src/screens/AiSuggestionScreen.tsx actual-project/frontend/src/screens/RecordScreen.tsx actual-project/frontend/src/iteration2.ts actual-project/frontend/src/iteration2.test.ts
git commit -m "Run AI before exact count confirmation"
```

---

### Task 3: Exact-count displays and cleanup wording

**Files:**
- Modify: `actual-project/frontend/src/flowRules.ts`
- Modify: `actual-project/frontend/src/flowRules.test.ts`
- Modify: `actual-project/frontend/src/screens/ReviewScreen.tsx`
- Modify: `actual-project/frontend/src/screens/SubmittedScreen.tsx`
- Modify: `actual-project/frontend/src/screens/MyReportsScreen.tsx`
- Modify: `actual-project/frontend/src/screens/ReportDetailScreen.tsx`
- Modify: `actual-project/frontend/src/screens/BeachScreen.tsx`
- Modify: `actual-project/frontend/src/screens/CleanupScreen.tsx`
- Modify: `actual-project/frontend/src/iteration2.test.ts`

**Interfaces:**
- Produces: `formatReportComposition(quantities, itemCounts?)` with exact-count-first display.
- Consumes: normalized cleanup suggestion counts from Task 2.

- [ ] **Step 1: Write failing display and empty-cleanup tests**

```ts
it('shows exact counts when they are available', () => {
  expect(formatReportComposition(
    { Plastic: 'Medium', Glass: 'Small' },
    { Plastic: 8, Glass: 2 },
  )).toBe('Plastic — 8 items · Glass — 2 items');
});

it('keeps legacy bands when exact counts are unavailable', () => {
  expect(formatReportComposition({ Plastic: 'Medium' })).toBe('Plastic — Medium');
});
```

Add an `analyseCleanupPhoto` test whose recognition response has zero counts and assert that the returned suggestion is `{}`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/flowRules.test.ts src/iteration2.test.ts`

Expected: the formatter does not accept counts yet and the cleanup empty-result behavior is not represented distinctly.

- [ ] **Step 3: Implement exact-count-first display**

Update the formatter and pass `itemCounts` from personal report, submitted, review, duplicate, and report-detail views. Use the singular label only for one item:

```ts
const label = count === 1 ? 'item' : 'items';
return `${category} — ${count} ${label}`;
```

Legacy records continue to display their stored band. Do not convert a band back into a guessed count.

- [ ] **Step 4: Fix cleanup empty-result feedback and button copy**

In `CleanupScreen.usePhotoSuggestion`, check `Object.keys(suggestion).length` before setting success state. For `{}`, keep inputs editable and show `No litter was detected. Enter the item counts manually.` instead of the success toast.

In `BeachScreen`, render the existing action as:

```tsx
<span>Add a Cleanup</span>
<small style={{ marginLeft: 6, fontSize: '0.72em', fontWeight: 500 }}>
  (commit to cleaning it)
</small>
```

Do not add an acknowledgement control or API field.

- [ ] **Step 5: Run frontend regression tests and build**

Run: `npm test`

Run: `npm run build`

Expected: all frontend tests and the production build pass.

- [ ] **Step 6: Commit display and cleanup changes**

```bash
git add actual-project/frontend/src
git commit -m "Show exact litter counts across report views"
```

---

### Task 4: Bounded tiled ONNX recognition

**Files:**
- Modify: `actual-project/backend/recognition.py`
- Modify: `actual-project/backend/tests/test_yolo_runtime.py`

**Interfaces:**
- Produces: `_inference_regions(source)` returning one full-image region and up to four overlapping crop regions.
- Produces: class-aware `_deduplicate_detections(detections, iou_threshold=0.5)`.
- Preserves: `LitterRecognizer.recognise(image_bytes)` response shape.

- [ ] **Step 1: Write failing bounded-region and de-duplication tests**

Use a fake model that records calls and returns overlapping Plastic detections from two regions:

```py
def test_scene_photo_uses_bounded_sequential_regions():
    model = RecordingModel()
    recognizer = LitterRecognizer(model, "test", inference_size=320)

    result = recognizer.recognise(jpeg_bytes((500, 635)))

    assert 2 <= len(model.sources) <= 5
    assert all(width <= 500 and height <= 635 for width, height in model.sources)
    assert result["state"] == "ready"


def test_overlapping_crop_detections_are_counted_once():
    merged = _deduplicate_detections([
        {"classId": 0, "confidence": 0.90, "box": [100, 100, 160, 160]},
        {"classId": 0, "confidence": 0.80, "box": [104, 104, 158, 158]},
    ])
    assert len(merged) == 1
```

- [ ] **Step 2: Run the backend test and verify RED**

Run: `python -m pytest tests/test_yolo_runtime.py -q`

Expected: failures because region inference and global de-duplication do not exist.

- [ ] **Step 3: Implement one whole-image pass plus four overlapping crops**

For images larger than the 320 input, create four crops using overlapping halves. Run them one at a time through the existing model:

```py
def _inference_regions(source: Image.Image, minimum_size: int):
    yield 0, 0, source
    width, height = source.size
    if max(width, height) <= minimum_size:
        return
    x_split = width // 2
    y_split = height // 2
    overlap_x = max(1, width // 20)
    overlap_y = max(1, height // 20)
    boxes = (
        (0, 0, x_split + overlap_x, y_split + overlap_y),
        (x_split - overlap_x, 0, width, y_split + overlap_y),
        (0, y_split - overlap_y, x_split + overlap_x, height),
        (x_split - overlap_x, y_split - overlap_y, width, height),
    )
    for left, top, right, bottom in boxes:
        yield left, top, source.crop((left, top, right, bottom))
```

Translate each crop box by its `(left, top)` offset. De-duplicate only boxes from the same class, highest confidence first, using NumPy/Python IoU. Close every generated crop after its prediction. Keep the existing model session, confidence threshold, response fields, and CPU thread limits.

- [ ] **Step 4: Run backend focused and full tests**

Run: `python -m pytest tests/test_yolo_runtime.py -q`

Run: `python -m pytest -q`

Expected: all backend tests pass; the fake runtime makes no more than five sequential inference calls per image plus the one startup warmup.

- [ ] **Step 5: Run the supplied image regression locally**

Run the production recognizer against `C:\Users\huangguan\Downloads\Beach_in_Sharm_el-Naga02.jpg` without copying it into the repository. Record the returned state, supported counts, elapsed time, and process peak memory.

Expected: state `ready`, at least one supported detection, and peak memory below 512 MiB. If detections remain empty, stop and report that tiling did not solve model accuracy; do not lower confidence or claim success without inspecting false positives.

- [ ] **Step 6: Commit the recognizer change**

```bash
git add actual-project/backend/recognition.py actual-project/backend/tests/test_yolo_runtime.py
git commit -m "Improve small litter recognition with bounded crops"
```

---

### Task 5: Integrated verification and Render deployment

**Files:**
- Modify only if a failing regression identifies a concrete defect in files already listed above.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a deployed frontend and backend verified through the public URLs.

- [ ] **Step 1: Run all local quality gates**

Backend:

```bash
cd actual-project/backend
python -m pytest -q
```

Frontend:

```bash
cd actual-project/frontend
npm test
npm run build
```

Expected: every test passes and the frontend production build completes without TypeScript errors.

- [ ] **Step 2: Review the final diff and repository state**

Run: `git diff origin/main...HEAD --check`

Run: `git status --short`

Expected: only planned commits plus the user's pre-existing unrelated untracked files; no photo, secret, build directory, or temporary document artifact is staged.

- [ ] **Step 3: Push and deploy the integrated main branch**

Push the completed commits to the configured upstream branch, then monitor both Render services until the backend and frontend deployments are live. Do not change service size, secrets, or unrelated environment variables.

- [ ] **Step 4: Verify the live workflow**

Check:

1. `/health` returns HTTP 200.
2. The beach page shows `Add a Cleanup (commit to cleaning it)` with smaller parenthetical text.
3. A new report runs AI before **What did you find?**.
4. The findings form contains integer counts and no band buttons.
5. AI detections prefill counts and remain editable.
6. An empty result opens manual entry and shows no false success message.
7. The user-supplied beach photo returns at least one supported detection through the live API.
8. Review and saved report views show exact counts while beach scoring remains band-compatible.

- [ ] **Step 5: Record deployment evidence**

Report deployed commit IDs, Render service states, health response, the supplied-image recognition result, and any remaining model limitation. Do not state that recognition is fixed if the deployed supplied-image test is still empty.
