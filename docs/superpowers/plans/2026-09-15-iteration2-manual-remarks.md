# Iteration 2 Manual Remarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the final Iteration 2 Manual Remarks contract: band-based report/cleanup semantics, 10 m duplicate behavior, Attention-gated events, AI explanation, litter gallery, and background-story link.

**Architecture:** Keep legacy exact-count fields readable only at compatibility boundaries while making category-to-quantity-band maps canonical for all new report and cleanup writes. Preserve PR #46 active-unresolved composition, private photo storage, tokenized mutations, and audit history; extend those systems rather than replacing them.

**Tech Stack:** React + TypeScript + Vitest frontend; Flask + SQLAlchemy + pytest backend; SQLite test databases; PostgreSQL/Neon-compatible startup migrations; GitHub Actions integration workflow.

**Spec:** `docs/superpowers/specs/2026-09-15-iteration2-manual-remarks-design.md`

## Global Constraints

- New participant-facing reporting and cleanup must never require exact item counts.
- Allowed bands are exactly `Small`, `Medium`, `Large`, `Very Large`.
- Small-only new reports must not become active Counted evidence.
- Linked all-Small cleanup logically resolves a target without deleting the historical report/photo/action.
- New cleanup photos remain ephemeral.
- Public APIs/UI never expose exact GPS or raw private photo keys.
- Do not force-push, reset, rewrite history, rename the project, or add Iteration 3 features.
- Verify RED before implementation and GREEN after each task using the PR-triggered GitHub Actions workflow.

---

### Task 1: Point 10 report contract — bands are canonical

**Files:**
- Modify: `actual-project/frontend/src/flowRules.test.ts`
- Modify: `actual-project/frontend/src/flowRules.ts`
- Modify: `actual-project/frontend/src/AppContext.tsx`
- Modify: `actual-project/frontend/src/types.ts`
- Modify: `actual-project/frontend/src/screens/AiSuggestionScreen.tsx`
- Modify: `actual-project/frontend/src/screens/RecordScreen.tsx`
- Modify: `actual-project/frontend/src/screens/ReviewScreen.tsx`
- Modify: `actual-project/backend/tests/test_api.py`
- Modify: `actual-project/backend/app_core.py`
- Modify: `actual-project/backend/app.py`

**Interfaces:**
- Canonical draft/report write state: `quantities: QuantityByCategory`.
- Legacy `itemCounts` remains optional on deserialized historical reports only.
- Recognition returns category-to-band `suggestions` for the UI.

- [ ] **Step 1: Write failing frontend tests**

Replace exact-count expectations with tests equivalent to:

```ts
it('submits confirmed quantity bands without itemCounts', () => {
  const result = buildReportSubmission(draft({
    quantities: { Plastic: 'Medium', Other: 'Small' },
    itemCounts: null,
    aiDecision: 'confirmed',
    aiModelState: 'ready',
  }));
  expect(result.kind).toBe('create');
  if (result.kind === 'create') {
    expect(result.payload.quantities).toEqual({ Plastic: 'Medium', Other: 'Small' });
    expect(result.payload).not.toHaveProperty('itemCounts');
  }
});

it('formats bands even when a legacy count map exists', () => {
  expect(formatReportComposition(
    { Plastic: 'Medium', Glass: 'Small' },
    { Plastic: 8, Glass: 2 },
  )).toBe('Plastic — Medium · Glass — Small');
});
```

Also change the report-flow test name/expectation from “runs AI before exact count confirmation” to category+band confirmation.

- [ ] **Step 2: Write failing backend report tests**

Add tests equivalent to:

```py
def test_new_report_uses_bands_without_item_counts(api):
    _app, client = api
    _session, headers = signup(client)
    photo = upload(client, headers)
    response = client.post('/reports', headers=headers, json={
        'beachId': 'morib',
        'photoKey': photo['photoKey'],
        'locationSource': 'manual',
        'quantities': {'Plastic': 'Medium', 'Glass': 'Large'},
    })
    assert response.status_code == 201
    body = response.get_json()
    assert body['quantities'] == {'Plastic': 'Medium', 'Glass': 'Large'}
    assert not body.get('itemCounts')


def test_small_only_new_report_is_not_recorded_as_counted(api):
    _app, client = api
    _session, headers = signup(client)
    photo = upload(client, headers)
    response = client.post('/reports', headers=headers, json={
        'beachId': 'morib',
        'photoKey': photo['photoKey'],
        'locationSource': 'manual',
        'quantities': {'Plastic': 'Small'},
    })
    assert response.status_code == 422
    assert response.get_json()['code'] == 'SMALL_ONLY_REPORT'
    assert client.get('/reports/mine', headers=headers).get_json() == []
```

- [ ] **Step 3: Verify RED in draft PR CI**

Open a draft PR to `main`. Expected frontend/backend jobs fail because the existing code still emits/submits exact counts and accepts Small-only Counted reports.

- [ ] **Step 4: Implement minimal frontend band contract**

`RecordScreen` must use `draft.quantities` as state, toggle categories with a default band (use `Small` only as an editable starting value, not as an automatic submission), render `<select>` controls with the four band values, and remove every numeric input/copy. `AiSuggestionScreen` stores `result.suggestions` into `quantities`, not detector counts. `buildReportSubmission` omits `itemCounts` for new writes. `formatReportComposition` always renders bands.

- [ ] **Step 5: Implement minimal backend band contract**

Report validation accepts `quantities` as canonical. If legacy `itemCounts` is present on an old/read path, normalize it only through a compatibility helper; do not require it for a new create. Reject new Small-only input with `422 SMALL_ONLY_REPORT` before insert. Scoring/serialization use the confirmed band map.

- [ ] **Step 6: Verify GREEN**

PR CI must pass the modified report tests plus existing frontend typecheck/tests/build and backend suite.

- [ ] **Step 7: Commit**

Commit message: `feat: migrate reporting to quantity bands`.

---

### Task 2: Point 10 cleanup contract — linked remaining bands and standalone removed bands

**Files:**
- Modify: `actual-project/backend/schema.sql`
- Modify: `actual-project/backend/migrations/002_add_iteration2.sql`
- Modify: `actual-project/backend/app.py`
- Modify: `actual-project/backend/app_core.py`
- Modify: `actual-project/backend/standalone_cleanup.py`
- Modify: `actual-project/backend/tests/test_active_composition.py`
- Modify: `actual-project/backend/tests/test_standalone_cleanup.py`
- Modify: `actual-project/frontend/src/iteration2.test.ts`
- Modify: `actual-project/frontend/src/iteration2.ts`
- Modify: `actual-project/frontend/src/screens/CleanupScreen.tsx`
- Modify: `actual-project/frontend/src/types.ts`

**Interfaces:**
- Linked request: `remainingQuantities: QuantityByCategory`.
- Standalone request: `removedQuantities: QuantityByCategory`.
- Persist new nullable `remaining_quantities`, `removed_quantities`, and `cleanup_score` fields.
- Legacy `removed_counts` / `total_removed` remain readable for old rows only.

- [ ] **Step 1: Write failing cleanup tests**

Backend linked test:

```py
cleanup = client.post('/cleanup-actions', headers=headers, json={
    'targetReportId': report['id'],
    'remainingQuantities': {'Plastic': 'Small'},
    'handling': 'Collected for disposal',
    'idempotencyKey': 'bands-linked-cleanup',
})
assert cleanup.status_code == 201
assert cleanup.get_json()['resolved'] is True
assert client.get('/reports/mine', headers=headers).get_json()[0]['id'] == report['id']
```

Standalone test:

```py
response = client.post('/cleanup-actions', headers=headers, json={
    'beachId': 'kelanang',
    'removedQuantities': {'Plastic': 'Large', 'Glass': 'Small'},
    'handling': 'Collected for disposal',
    'idempotencyKey': 'standalone-bands',
})
assert response.status_code == 201
assert response.get_json()['score'] == 4
```

Frontend test changes `completeCleanup` input/output from numeric maps to bands and checks no negative/underflow arithmetic exists.

- [ ] **Step 2: Verify RED**

Expected failures: API rejects new fields; existing frontend `completeCleanup` expects numeric `removed`.

- [ ] **Step 3: Add idempotent schema migration**

Add nullable text/JSON-compatible columns `remaining_quantities`, `removed_quantities`, `cleanup_score`; make legacy numeric cleanup columns nullable/conditionally populated for new rows. Startup migration must inspect before altering, matching the existing Neon-safe single-connection pattern.

- [ ] **Step 4: Implement linked cleanup active state**

For a target report, normalize the current active band state, validate submitted remaining bands, persist them, compute per-category band-unit reductions, set `resolved=true` when no non-Small category remains, and leave original report quantities/photo untouched.

- [ ] **Step 5: Implement standalone cleanup bands**

Persist `removedQuantities`, derive `score = sum(Small=1, Medium=2, Large=3, Very Large=4)`, and do not alter any report.

- [ ] **Step 6: Update frontend cleanup UI**

Replace numeric inputs, “items removed”, exact totals, and “removed all” numeric behavior with category + band selectors for post-cleanup remaining state. For standalone cleanup, use band selectors for removed litter. AI suggestions populate bands and remain editable; photo bytes are never persisted.

- [ ] **Step 7: Verify GREEN**

Ensure active composition excludes an all-Small resolved target while historical report retrieval remains intact.

- [ ] **Step 8: Commit**

Commit message: `feat: migrate cleanup actions to quantity bands`.

---

### Task 3: Point 14 — 10 metre duplicate semantics

**Files:**
- Modify: `actual-project/backend/tests/test_api.py`
- Modify: `actual-project/backend/app_core.py`
- Modify: `actual-project/backend/API_ITERATION2.md`
- Modify: `actual-project/frontend/openapi.yaml`

**Interfaces:**
- Compare normalized non-Small active category-to-band maps.
- Within 10 m + equal map => Duplicate.
- Within 10 m + changed category/band => Counted and refresh active target proximity reference.
- >10 m => independent report.

- [ ] **Step 1: Write failing matrix tests**

Add cases for `<10m same`, `<10m different category`, `<10m different band`, `>10m same`, resolved target, and boundary points. Replace the old prior-day `ACTIVE_CLEANUP_TARGET_NEARBY` expectation with acceptance when content differs.

- [ ] **Step 2: Verify RED**

Expected: old blanket nearby-target rejection and broad same-day duplicate logic fail the new matrix.

- [ ] **Step 3: Implement target-aware duplicate matching**

Use request coordinates only during proximity matching. Remove the blanket earlier-day conflict. When a nearby active target differs, accept and update only that target's privacy-preserving `proximity_ref`; never update a >10 m target.

- [ ] **Step 4: Verify GREEN and docs**

CI passes boundary matrix; API docs no longer advertise `ACTIVE_CLEANUP_TARGET_NEARBY` as a normal product rule.

- [ ] **Step 5: Commit**

Commit message: `fix: align 10m duplicate matching with category and band`.

---

### Task 4: Point 26 — gate scheduled events by Beach Attention

**Files:**
- Modify: `actual-project/backend/tests/test_api.py`
- Modify: `actual-project/backend/app_core.py`
- Modify: `actual-project/backend/API_ITERATION2.md`
- Modify: `actual-project/frontend/src/iteration2.test.ts`
- Modify: `actual-project/frontend/src/iteration2.ts`

**Interfaces:**
- Auto-create only for `Moderate`, `High`, `Severe`.
- No creation for `Low` or insufficient data.
- Existing event uniqueness and Malaysia timezone remain unchanged.

- [ ] **Step 1: Write failing tests**

Seed/report data producing each attention state and assert scheduled event presence/absence; run generation twice and assert uniqueness.

- [ ] **Step 2: Verify RED**

Expected old behavior creates Saturday events for every beach.

- [ ] **Step 3: Implement creation gate**

Before each scheduled insert, compute/read the current beach summary and skip Low/insufficient beaches. Do not delete existing events.

- [ ] **Step 4: Verify GREEN**

CI confirms Moderate/High/Severe create; Low/insufficient do not; duplicate scheduler run remains idempotent.

- [ ] **Step 5: Commit**

Commit message: `feat: gate auto events by beach attention`.

---

### Task 5: Point 24 — explain AI suggestions without verification language

**Files:**
- Modify/create focused frontend tests near report/cleanup screens.
- Modify: `actual-project/frontend/src/screens/RecordScreen.tsx`
- Modify: `actual-project/frontend/src/screens/CleanupScreen.tsx`
- Modify shared UI component if one already fits.

**Interfaces:**
- Visible `?` control next to AI-generated band suggestions.
- Explanation must mention suggestion/editability and must not claim verification or cleanup proof.

- [ ] **Step 1: Write failing render/copy tests**

Assert the help trigger is present after AI suggestions and explanation contains `suggestion`, `confirm or edit`, `does not determine Beach Attention`, and `does not prove cleanup success`; assert prohibited certainty phrases are absent.

- [ ] **Step 2: Verify RED**

Expected old screens have no help control.

- [ ] **Step 3: Implement minimal accessible help UI**

Use an existing Callout/dialog pattern; keep wording plain and shared between report and cleanup where practical.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `feat: add AI suggestion explanation`.

---

### Task 6: Point 27 — beach litter gallery

**Files:**
- Modify: `actual-project/backend/tests/test_api.py`
- Modify: `actual-project/backend/app_core.py`
- Modify: `actual-project/backend/app.py`
- Modify: `actual-project/frontend/openapi.yaml`
- Modify: `actual-project/frontend/src/types.ts`
- Modify: `actual-project/frontend/src/api.ts` / `apiCore.ts` as established by current adapter split
- Modify beach detail routing/screen.
- Create: `actual-project/frontend/src/screens/LitterGalleryScreen.tsx`
- Add frontend tests.

**Interfaces:**
- `GET /beaches/{beachId}/litter-gallery` returns beach-scoped ordinary report gallery entries with short-lived gallery URL, report date/id, and no raw key/GPS/reporter data.
- Reuse `reports.photo_key`; no duplicate photo-reference column.

- [ ] **Step 1: Write failing backend access tests**

Create reports on two beaches and assert the requested beach returns only its ordinary report photos, response has no `photoKey`, `lat`, `lng`, `proximityRef`, or reporter identity, and cleanup images cannot appear.

- [ ] **Step 2: Verify RED**

Expected endpoint 404.

- [ ] **Step 3: Implement scoped gallery endpoint and signed gallery access**

Reuse private storage; mint a short-lived token scoped to report/photo/beach. Keep existing owner preview endpoint unchanged.

- [ ] **Step 4: Write failing frontend route/empty-state tests**

Assert Beach Information exposes `Litter Gallery`, gallery page handles entries and zero-photo beaches.

- [ ] **Step 5: Implement frontend gallery**

Show beach-level context and photos only; no precise location data.

- [ ] **Step 6: Verify GREEN and commit**

Commit message: `feat: add beach litter gallery`.

---

### Task 7: Point 39 + documentation retirement + full regression

**Files:**
- Modify beach ecological-relevance screen/component.
- Modify frontend test covering external link.
- Modify: `actual-project/backend/API_ITERATION2.md`
- Modify: `actual-project/frontend/openapi.yaml`
- Modify active Iteration 2 docs as needed.
- Modify: `docs/superpowers/specs/2026-09-15-ai-first-exact-count-reporting-design.md`
- Modify: `docs/superpowers/plans/2026-09-15-ai-first-exact-count-reporting.md`

**Interfaces:**
- Exact external URL: `https://ourworldindata.org/grapher/share-of-global-plastic-waste-emitted-to-the-ocean?country=PAK`.

- [ ] **Step 1: Write failing link test**

Assert `Learn more` uses the exact approved URL plus `target="_blank"` and `rel` containing `noopener` and `noreferrer`.

- [ ] **Step 2: Verify RED**

Expected link absent.

- [ ] **Step 3: Implement link**

Add only the button/link under ecological relevance; add no new ecological claim.

- [ ] **Step 4: Retire stale exact-count docs**

Add a prominent superseded notice at the top of both same-day exact-count documents pointing to the Manual Remarks design/plan. Update active API/OpenAPI docs to band semantics.

- [ ] **Step 5: Repository stale-phrase scan**

Search active product code for: `enter the exact number`, `exact item counts`, `items removed` numeric-input wording, participant-facing `type="number"` litter quantity controls, and exact-count-first copy. Internal legacy adapters may remain only when clearly compatibility-scoped.

- [ ] **Step 6: Full verification**

Draft PR GitHub Actions must pass both jobs: backend pytest suite and frontend `npm ci`, typecheck, tests, build. Inspect PR diff for accidental project rename, exact GPS exposure, persisted cleanup photo, duplicate report photo column, or unrelated teammate changes.

- [ ] **Step 7: Commit**

Commit message: `docs: retire superseded exact-count contract` (or split Point 39 feature and docs into two commits if the diff is clearer).
