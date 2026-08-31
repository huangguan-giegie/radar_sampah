# Team 04 Real Project Migration

This folder holds the active Radar Sampah project. The migration audit record
is maintained locally only.

## Current project

**Radar Sampah - Marine Litter Reporting and Cleanup Demo for Malaysia** is the active scope:

`I1 Report & Classify -> I2 Find & Understand -> I3 Connect & Prepare`

The MVP uses five fixed litter categories, broad Malaysian area labels (including the Selangor central west example), synthetic/public examples and anonymous demo counts. AI suggestions need confirmation; scores, heatmap and impact are illustrative. It does not collect identity data, exact coordinates or secrets, and makes no pollution-proof, legal, enforcement, emergency-dispatch or verified safety claim.

Recognition is a labelled demo fallback by default. A private provider is only allowed when `LITTER_RECOGNITION_ENABLED=true` and an HTTPS URL has been reviewed by the team.

The frontend API base is configured with `window.RADAR_SAMPAH_API_BASE`; the
older `window.TIDETRACE_API_BASE` name remains a compatibility alias. The
currently available deployment links are the legacy-compatible
`https://team04-marine-observation-frontend.onrender.com` and
`https://team04-marine-observation-api.onrender.com`. The new
`radar-sampah-frontend` and `radar-sampah-api` hostnames are not yet enabled.

## Folder layout

- `actual-project/` - active runtime, docs and deployment configuration.
- `actual-project/ml-model/` - Sea + TACO YOLO11m litter detector, training metadata and best weights (available on the `Sea-TACO-Detection-Model` branch).
- `deliverables/` - editable Markdown sources and Drive-ready documents.
- `references/` - reserved for reviewed reference material; old sample files are
  available through the rollback tag, not in the active build.
- `drive-migration/` - governance and migration record.

PM context and the migration manifest are maintained locally only and are not
tracked in GitHub. The archived `archive/compatibility/tidetrace_catalog.json`
is historical compatibility material, not active runtime data.

## Legacy and rollback boundary

The old sample runtime and reference files are not part of the active build.
They remain recoverable from the `divesafe-last-stable` and
`radar-sampah-pre-legacy-cleanup-20260828` tags and Git history. They must not
be used as current Radar Sampah evidence.

Names such as `TIDETRACE_API_BASE`, `TIDETRACE_*`, `marine_engine` and the
legacy Render hostnames are retained only for runtime compatibility or
rollback. The archived `archive/compatibility/tidetrace_catalog.json` is
historical compatibility material, not active runtime data. These names are
not alternative product names. HealthFirst
and DiveSafe references are historical records and are not current features.

## Deliverables

The editable sources are in `deliverables/documents/`. Existing DOCX/PPTX copies are retained for Drive. Do not claim they were regenerated unless the document build and visual QA were actually run.
