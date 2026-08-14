# Team 04 Marine Project Deliverables

This folder contains the adapted governance and presentation material for the
Marine Observation MVP. It keeps the useful structure of the HealthFirst
example while replacing the medical scope with marine-litter reporting and
OBIS context.

## Files

- `TEAM04_Marine_Project_Information.docx` — project overview, roles, links and
  scope boundaries.
- `TM04_Marine_Social_Contract.docx` — adapted team working agreement.
- `Marine_MVP_Work_Plan_and_Handover.docx` — work ownership, handover and
  integration sequence.
- `Marine_MVP_QA_and_Deployment_Checklist.docx` — acceptance, safety and
  Render verification checklist.
- `Team04_Marine_Miro_Reflection_Speaking_Notes.docx` — five-minute team and
  two-minute Huang Guan reflection notes.
- `presentation/Team04 Marine Observation Onboarding Presentation.pptx` —
  19-slide English onboarding deck for the marine MVP.

The Markdown files under `documents/` are the editable source for the DOCX
versions. `build_documents.py` regenerates them with the same simple teal/navy
style.

## Boundary

The old HealthFirst files stay under
`../references/healthfirst-example/` as read-only references. No HealthFirst
medical fields, thresholds, claims, screenshots or medical AI are copied into
this project. All examples here use synthetic/public data, OBIS/OpenStreetMap
sources and clearly labelled illustrative rules.

## Source of truth

- Code and runtime docs: `../actual-project/`
- Migration record: `../drive-migration/MIGRATION_MANIFEST.md`
- GitHub: https://github.com/huangguan-giegie/team04-marine-observation-mvp
- Render frontend: https://team04-marine-observation-frontend.onrender.com
- Render API: https://team04-marine-observation-api.onrender.com
