# Marine Governance and Presentation Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Carry the useful HealthFirst document and presentation formats into the Marine Litter Observation MVP as clearly labelled, English, scope-correct project deliverables.

**Architecture:** Keep the runtime and API under `actual-project/`. Put adapted Word documents and the editable PowerPoint under `deliverables/`, while retaining unchanged HealthFirst files under `references/healthfirst-example/`. Mirror the same deliverables in the new Drive project folders and record their links in the migration manifest.

**Tech Stack:** Python/Flask, static HTML/CSS/JS, PostgreSQL/SQLite, python-docx for document authoring, `@oai/artifact-tool` for PowerPoint authoring, Render and Google Drive.

## Global Constraints

- All audience-facing project content is English.
- The Marine MVP uses synthetic/public data only and does not claim pollution-source proof, species verification or enforcement decisions.
- HealthFirst medical fields, claims and screenshots remain read-only references.
- Render configuration and runtime code remain unchanged unless a consistency check requires a documentation-only update.
- No credentials or private identifiers may enter GitHub, Drive deliverables or the deck.

## Tasks

1. Create adapted documents for team information, social contract, work plan/handover, QA/deployment evidence and Miro reflection speaking notes.
2. Create a 19-slide Marine onboarding deck using the old 19-slide deck only as a visual/narrative reference.
3. Render and inspect every DOCX page and every PPTX slide; fix overflow or scope mistakes.
4. Add deliverable links and migration decisions to project README, PM context and migration manifest.
5. Upload verified deliverables to the new Drive folders; keep the old HealthFirst folder untouched.
6. Run backend/frontend tests, diff checks and verify GitHub `main` remains the source for Render code.
