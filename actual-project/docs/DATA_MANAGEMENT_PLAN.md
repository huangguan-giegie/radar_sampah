# Radar Sampah — Data Management Plan (Iteration 1)

> **Authoritative copy:** [`RadarSampah_Data_Management_Plan_Iteration1_MVP.docx`](./RadarSampah_Data_Management_Plan_Iteration1_MVP.docx)
> — that is the file submitted for assessment. This Markdown is a faithful conversion of it, kept
> in the repo so the plan is readable and diffable on GitHub.
>
> Prepared 22 August 2026 · Owner: Radar Sampah project team (TM04)
> Related: [`../frontend/API.md`](../frontend/API.md) · [`../frontend/API.en.md`](../frontend/API.en.md) · [ERD](../frontend/docs/erd.png)

---

| Field | Details |
|---|---|
| Project | Radar Sampah — marine-litter monitoring & community cleanup for Malaysian coastal areas |
| Purpose | Define how open biodiversity data and user-generated litter reports are acquired, transformed, governed, stored and retired in the Iteration 1 (MVP) build. |
| Prepared | 22 August 2026 |
| Scope (Iteration 1) | Threatened marine species reference data (FishBase), occurrence context (OBIS), manual user litter reports (photo + location), basic verification workflow, community cleanup missions, fixed severity scoring (4 bands), basic points, biodiversity context layer. |
| Owner | Radar Sampah project team (TM04) |

## Executive summary

Radar Sampah helps coastal communities report marine litter, understand local biodiversity context, prioritise cleanups and track basic impact. In Iteration 1, the system combines FishBase threatened-species checklists and OBIS occurrence records (used as sensitivity seeds for illustrative scoring) with a local PostgreSQL database and community mission workflows. Litter reporting is manual: users supply a photo, location and category/quantity; a basic internal verification path decides what appears on the public map. Reference biodiversity data is loaded at deployment (or on an approved refresh). User reports and cleanup records are written after verification, using synthetic/public data only in the current baseline. The app treats missing or unverified data as unavailable rather than inventing low-litter conditions, and keeps personal sensory or privacy preferences on the device where possible.

MVP journey: discover a beach or cleanup activity → submit verified litter data (manual path) → view severity map and biodiversity context → join/create cleanup → submit after-cleanup evidence → see basic points and recurrence status.

## 1. Purpose, scope and data principles

This plan describes the data process for the Iteration 1 (MVP) of Radar Sampah. It is an operational document: it identifies each source, the frequency at which it changes and is consumed, transformations, storage, quality controls, governance risks and retention decisions relevant to the MVP features only.

Purpose limitation: Only use the minimum data needed to show litter conditions, biodiversity context, cleanup priority and community progress. No AI training datasets are required or stored for this iteration.

Transparency: Label results as observed (user-verified) or derived (severity score from fixed rules). Expose recency and never silently convert missing readings to “clean”.

Data minimisation: No continuous location tracking; no facial recognition; user profiles store only what is required for scoring and community membership. Photos are retained only as long as needed for verification and impact display.

Reproducibility: The database schema, ingestion logic and feature code are version-controlled. Severity scoring uses a fixed, versioned rule set so past scores remain explainable.

Manual-first reporting: The litter reporting path must function fully without any AI suggestion. AI-assisted classification is deferred to Iteration 2.

## 2. Open data sources and update schedule

The following table is the authoritative source register for Iteration 1. TACO and any other AI training datasets are excluded from this iteration.

| Open dataset / use | Access & key fields | Publisher cadence | Radar Sampah cadence | Granularity | Licence / attribution |
|---|---|---|---|---|---|
| FishBase — threatened species checklist (Malaysia). url:https://www.fishbase.se/country/CountryChecklist.php?what=list&trpp=50&c_code=458&csub_code=&cpresence=reported&vhabitat=threatened&ext_pic=on | Country checklist page/export; Species, threat_category, Picture | As publisher changes | Loaded at ingestor start/deployment. One record per species. Used as sensitivity seed for illustrative scoring only. | One record per species | CC BY-NC 4.0 (FishBase data). Cite: Froese, R. and D. Pauly. Editors. FishBase. www.fishbase.org. Non-commercial use only. Individual images may carry different copyrights — check before reuse. |
| OBIS occurrence — biodiversity context. Url:https://api.obis.org/occurrence | OBIS API JSON / export; scientificName, decimalLatitude, decimalLongitude | As publisher changes | Loaded at ingestor start/deployment. Occurrence point records. Used as sensitivity seed only. Exact coordinates not stored as precise production locations. | Occurrence point records | Treated as CC BY-NC (strictest OBIS licence). Attribution required to OBIS and original datasets. Non-commercial use only. Retain licence list from each export; pause if terms change. |

### 2.1 How are these data actually used?

FishBase & OBIS (Biodiversity Context) — FishBase and OBIS data contextualise litter reports and cleanup missions. They are not used to calculate real-time biodiversity or abundance.

FishBase supplies the threatened species list for Malaysia.

OBIS provides historical occurrence points for these species.

Usage in Iteration 1:

Ingestion & Mapping: Data is loaded into dim_species, dim_threat and fact_occurrence tables.

Scoring: Presence of threatened species in an area is used as a sensitivity seed to influence the illustrative severity/priority score (fixed rule set).

Display: Populates the Biodiversity context layer in the UI (US5.1 / US5.2), informing users of potential species in a cleanup area with cautious language and source attribution.

## 3. Data lifecycle: acquisition to presentation

Figure 1 (conceptual) shows the Iteration 1 flow. API endpoints and keys are configured as environment variables and accessed server-side; credentials are not embedded in the client application.

| Open / user data | Ingestion & validation | PostgreSQL | Scoring / API | User experience |
|---|---|---|---|---|
| FishBase threatened list; OBIS occurrences; Litter report + location (manual); Cleanup before/after; Community membership | Fetch OBIS API with filters; Validate coords & required fields; Manual category/quantity entry | dim_threat; dim_species; fact_occurrence; areas; users; communities; community_users; + litter/report tables | Fixed severity rules (4 bands); Impact (before–after); Basic points; Conditions & map APIs | Litter severity map; Biodiversity context layer; Cleanup missions; Impact & basic points; Recurrence status |

Figure 1. Radar Sampah Iteration 1 data flow and controlled transformation points.

In the current working baseline, this flow operates with synthetic/public data only. Exact litter coordinates and real personal data are not stored.

## 4. Wrangling, cleansing and transposition

### 4.1 Reference biodiversity ingestion (FishBase + OBIS)

Iteration 1 note: Biodiversity references are ingested and used as sensitivity seeds only. They provide species context and illustrative scoring but do not represent real-time abundance or exact occurrence claims. No exact coordinates from OBIS are stored as precise location data in production.

FishBase Malaysia threatened checklist is obtained from the published country checklist (c_code=458, threatened filter). Rows without a usable scientific name are discarded. Threat categories are mapped into dim_threat. Species are upserted into dim_species on scientific_name; picture_url is stored when available and permitted under the image’s own licence.

OBIS occurrence requests are filtered (scientific name list from dim_species and/or geographic bounding box for Malaysian coastal waters). Records missing coordinates or with invalid latitude/longitude are skipped. Duplicates are controlled by occurrence identity where provided, or by (species_id, rounded lat/lon) policy.

Taxonomic names are normalised (trim, case folding). Only species present in the FishBase threatened extract are retained as the primary biodiversity context for Iteration 1.

### 4.2 User litter reports (manual path)

Iteration 1 implements a fully functional manual reporting path (US2.1, US2.2). No AI model is required or invoked.

User uploads a report and selects/confirms a location (GPS assistance may suggest a beach; exact location is protected — AC2.1.3). Server-side validation rejects missing inputs, missing or out-of-range coordinates, and empty submissions.

Data minimisation: In the current baseline, only synthetic/public data is written to the database. No real user litter coordinates, personal data, or exact locations are stored.

User enters or corrects beach, litter category and quantity (manual). Required fields are validated before acceptance (AC2.2.3).

Severity is derived from confirmed type/quantity via a fixed, versioned scoring rule that maps into four severity bands (initial US4.3). Past scores remain explainable.

Verified reports update area-level aggregates (e.g. last_litter_score on areas) and feed the litter severity map. Missing or rejected reports do not invent “zero litter” (AC4.2.3).

Pending, unreliable or duplicate reports are excluded from the public map (US3.2). A basic internal verification workflow supports status updates and duplicate identification (US3.1); a full moderator dashboard is deferred to Iteration 2.

### 4.3 Cleanup missions and impact

Community missions are tied to areas. Users can view nearby activities, join, leave, create and edit their own activities (Epic 1). Self-verification of their own activity is prevented (AC1.3.3).

After-cleanup photos and activity outcomes are submitted (US6.1). Verification status and outcome summary are visible (US6.2). Impact metrics are stored with the mission and contributing users.

Basic points are awarded only for verified contributions (confirmed reports, completed cleanups with evidence) and live on users.user_score (US8.1). Badges and leaderboards are out of scope for Iteration 1.

Recurrence: days between cleanup and next verified report can be viewed; “No follow-up report yet” is displayed when applicable (US7.1, US7.2). Average/median intervals and tiers are deferred to Iteration 3.

Current baseline: Cleanup missions operate with synthetic data only. Impact calculations are illustrative and based on sensitivity-seed biodiversity context.

## 5. Storage, access, retention and archival

| Asset | Store/controls | Retention & archival rule | Recovery/owner |
|---|---|---|---|
| Operational records (areas, users, communities, reports, missions) | PostgreSQL (Docker volume or managed instance); schema constraints, PKs/FKs, server-side access only. | Keep active operational data for the project lifetime + assessment period. Soft-delete or anonymise inactive users on request. Current baseline stores only synthetic/public data; no real personal data or exact litter coordinates are persisted. | DB volume backup before releases; restore and test each iteration. Owner: Junn Keith. |
| Biodiversity reference (dim_threat, dim_species, fact_occurrence) | PostgreSQL; read-mostly after load. Reload from source on approved refresh. | Keep current snapshot while sources remain active. Archive superseded loads with access date and source version note. | Rebuild from FishBase + OBIS extracts. Owner: Junn Keith.. |
| Litter report  (litter & before/after) | Object storage or server filesystem outside public web root; references in DB only. Access controlled. | Retain while report/mission is active and for impact display; delete or anonymise on user request or after defined retention (e.g. end of FYP + exam period) unless research retention is approved. . | Backup with application data. Owner: project team. |
| Secrets & configuration | Environment variables; .env excluded from source control. DB password and any API keys server-only. | Rotate/revoke on team change or suspected exposure; do not archive real secrets. | Recreate from approved secret store/deployment config. Owner: deployment lead. |

## 6. Data model and relationships

The relational model separates stable biodiversity reference data from user, area and community operational data. Referential integrity ensures occurrences link only to known species, communities link only to known areas and users, and litter reports link only to registered contributors and reporting areas. Litter/report tables support the manual reporting and verification workflow, while severity bands provide a consistent classification of litter severity for areas.

| Tables | Primary key | Key relationships/meaning |
|---|---|---|
| dim_threat | threat_id | Stable threat category dictionary |
| dim_species | species_id | Master species record: scientific_name (unique), threat_id FK, picture_url |
| fact_occurrence | occurrence_id | Occurrence points from OBIS (or equivalent); species_id FK; latitude, longitude (context only; not precise production locations) |
| areas | area_id | Named coastal/report areas with coordinates and last_litter_score / last_updated_time |
| users | user_id | Registered contributor; user_name, user_score (basic points) |
| communities | community_id | Cleanup/mission community bound to an area (area_id FK); community_date |
| community_users | (community_id, user_id) | Membership junction; cascade delete from community or user as defined |
| litter_reports | report_id | Manual litter reports: photo ref, approx location, category, quantity, status (pending/verified/rejected), user_id FK, area_id FK, timestamps |
| verification_log | log_id | Records the verification history of litter reports. Links each verification event to a report_id and the verifying user_id; stores verification date, status and quality flag. |
| severity_bands | band_id | Stable severity classification dictionary containing band_name, min_score, max_score, and color_hex. Used by areas to classify their current litter severity. |

#### Relationships

dim_threat 1 dim_species — one threat category can apply to many species; each species references one threat category.

dim_species 1 fact_occurrence — one species can have many occurrence records; each occurrence references one known species.

areas 1 communities — one area can host multiple cleanup/mission communities.

areas 1 litter_reports — one area can have multiple litter reports.

users 1 litter_reports — one user can submit multiple litter reports.

communities M users through community_users — users can participate in multiple communities and communities can contain multiple users.

litter_reports 1 verification_log — one litter report can have multiple verification records, allowing a verification history to be retained.

users 1 verification_log — one user can perform multiple verification actions.

severity_bands 1 areas — one severity band can classify multiple areas, while each area references one severity band.

ERD Diagram

## 7. Scoring and analytical governance (Iteration 1)

### 7.1 Severity scoring design

Severity and cleanup-priority scores are produced by a fixed, deterministic rule set applied to confirmed (verified) litter type/quantity and optional area context, including biodiversity sensitivity seeds. Four severity bands are displayed on the map (US4.1, initial US4.3). Biodiversity context from OBIS/FishBase is shown as historical occurrence context, not as a real-time abundance claim. Language on the UI remains cautious (US5.2).

### 7.2 Validation, limitations and monitoring

Required fields and coordinate validity are checked at submission; invalid rows are rejected.

Unverified, pending or duplicate reports are excluded from the public severity map.

Evidence status such as “Insufficient data” and “Not recently reported” is displayed; the system never claims a beach is clean solely because of missing reports (US4.2).

The system cannot observe every beach continuously, weather, illegal dumping outside the camera view, or individual accessibility needs. Scores and maps are decision aids, not safety or legal assurances; users retain judgement.

Full calibration, sensitivity analysis and detailed limitations documentation of the scoring rules are scheduled for Iteration 2.

## 8. Ethical issues

Radar Sampah addresses marine pollution and community action in a context where incorrect “clean” or “safe” messaging could mislead. Ethical use therefore requires uncertainty, recency and limitations to be visible. The app should show when a report was last verified, distinguish verified observations from pending ones, and retain the behaviour of treating missing data as unavailable.

Current baseline caveat: The system as currently deployed uses synthetic/public data only. This privacy-preserving approach allows the team to demonstrate functionality without handling real user data, reducing ethical risks associated with personal data, location privacy, and photo sensitivity until production-readiness is confirmed.

Do not infer disability, ethnicity, income or home location from photos or coordinates.

Avoid dark-pattern alerts or pressure to over-report. Allow user-controlled notification and privacy preferences stored locally where feasible.

Provide a clear explanation of data limitations (coverage gaps, relative severity scores).

Test whether recommendations systematically under-serve rural, low-reporting or recently cleaned areas.

## 9. Legal and licensing issues

Each source must be checked at download/review time for its displayed licence and terms.

FishBase data are generally usable under CC BY-NC 4.0 for non-commercial academic/FYP use with attribution (Froese & Pauly; record-level refs where applicable). Commercial reuse is restricted. Image rights are separate and must be respected per image.

OBIS integrates many datasets under CC0, CC BY or CC BY-NC. Exports include licence lists; Radar Sampah must preserve and display required attributions and must not use CC BY-NC subsets commercially.

Radar Sampah will preserve source URLs, access dates, and transformation notes, acknowledge publishers, link to applicable licences, and indicate that data have been transformed (e.g., filtering, aggregation, scoring). It will not imply endorsement by FishBase, OBIS, IOC-UNESCO or any data provider.

If a dataset’s displayed licence changes or access terms restrict reuse, ingestion must pause until the team reviews the impact.

User-generated content is governed by the app’s terms of use (to be finalised): users grant the project a licence to store, display and analyse reports for the FYP and related non-commercial research; they retain the ability to request deletion subject to legal holds. The hosting location, access controls, and any applicable Malaysian personal data obligations (e.g., PDPA) must be confirmed before public deployment.

## 10. Privacy and security issues

Current scope: public/open biodiversity aggregates, user-chosen profile fields, voluntary litter reports with photos and approximate locations, community membership. No continuous GPS tracking; no sale of personal data.

Current implementation: The system uses synthetic/public data only. No exact litter coordinates or real personal data are stored. This minimises privacy and security risks during development and testing.

If future features introduce private messaging, exact home addresses or third-party analytics, conduct a privacy impact assessment first; define consent, minimisation, retention, deletion/export and access controls.

Use TLS for deployed API/database connections, least-privilege database accounts, secrets in deployment configuration, dependency updates, backup encryption where supported, and access/audit logging.

Do not expose raw database credentials, private keys or non-public logs through public endpoints.

## 11. Quality assurance, change control and Iteration 1 checklist

| Control | Evidence/action this iteration | Deferred / future improvement |
|---|---|---|
| Source freshness | User reports timestamped on confirmation. Biodiversity loaded at deployment/refresh. | Automated freshness dashboard for last litter score and last verified report per area (later). |
| Completeness & validity | Required fields checked; invalid coordinates/species rows skipped; DB constraints on keys and non-null critical columns. | Persist rejected-row counts and reason codes for ingestion jobs. |
| Duplicates | Species unique on scientific_name; community_users composite PK; basic report dedup and exclusion of duplicates from public map (US3.1 / US3.2). | Source-specific duplicate exception reports for OBIS; richer moderator tools (Iteration 2). |
| Severity scoring | Fixed rule set and four severity bands implemented and versioned (initial US4.3). Invalid/unverified records excluded from map. | Full calibration, sensitivity analysis and limitation documentation (Iteration 2). |
| AI/model release | Not applicable — no AI model in Iteration 1. | Manual promotion, metrics review, model cards when AI is introduced (Iteration 2). |
| Schema evolution | SQL migrations version database structure; API queries select explicit fields. | Migration rollback runbook and automated schema tests. |
| Plan review | This report is scoped to Iteration 1 only. Update at the end of the iteration and file with project governance materials. | Record approvals, source access dates and changed assumptions; produce Iteration 2 DMP when AI and full moderation are introduced. |

## 12. References and implementation evidence

FishBase Malaysia threatened checklist Dataset:

https://www.fishbase.se/country/CountryChecklist.php?what=list&trpp=50&c_code=458&csub_code=&cpresence=reported&vhabitat=threatened&ext_pic=on

OBIS API (occurrence) API:

https://api.obis.org/occurrence
