# Team 04 Real Project Migration

This folder holds the active TideTrace MY student project and preserved reference/rollback material.

## Current project

**TideTrace MY - Marine Litter Reporting and Cleanup Demo for Malaysia** is the active scope:

`Report -> Recognize -> Heatmap -> Join mission -> Evidence -> Progress`

The MVP uses five fixed litter categories, broad Malaysian area labels, synthetic/public examples and anonymous demo counts. It does not collect identity data, exact coordinates or secrets. It does not prove litter source, cleanup completion, environmental impact, legal status or enforcement action.

Recognition is a labelled demo fallback by default. A private provider is only allowed when `LITTER_RECOGNITION_ENABLED=true` and an HTTPS URL has been reviewed by the team.

## Folder layout

- `actual-project/` - active runtime, docs and deployment configuration.
- `deliverables/` - editable Markdown sources and Drive-ready documents.
- `references/healthfirst-example/` - read-only historical examples.
- `drive-migration/` - governance and migration record.

## Legacy and rollback boundary

DiveSafe MY and the earlier marine-observation/litter paths are retained as rollback history. They are not the active TideTrace product flow. HealthFirst material is reference-only and must not be used as TideTrace evidence.

## Deliverables

The editable sources are in `deliverables/documents/`. Existing DOCX/PPTX copies are retained for Drive. Do not claim they were regenerated unless the document build and visual QA were actually run.
