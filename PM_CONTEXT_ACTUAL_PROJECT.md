# Team 04 Actual Project PM Context

## Radar Sampah document brand cleanup — 30 August 2026

The active GitHub deliverables were aligned to the Radar Sampah brand. Marine-
labelled document filenames and the onboarding presentation filename were
renamed to Radar Sampah equivalents; their content remains the current
marine-litter MVP content. DOCX files were regenerated from the active
Markdown sources. The current Render endpoints retain their legacy
`team04-marine-observation-*` hostnames for compatibility because the proposed
`radar-sampah-*.onrender.com` services are not provisioned. Historical
TideTrace, DiveSafe and HealthFirst references remain only in migration/audit
records, rollback material or compatibility identifiers. No code, deployment,
Drive file or unmerged branch was changed.

Verification for this cleanup: the backend suite passed 34 tests; the frontend
passed 25 tests, TypeScript typecheck and production build. The renamed
19-slide onboarding deck passed `slides_test.py` with no overflow and was
rendered with the bundled presentation renderer. The five DOCX files were
checked structurally (including tables, links and visible text) and contain no
old product names; local DOCX-to-PDF rendering was unavailable because this
environment does not provide LibreOffice/soffice. Rollback tag
`radar-sampah-pre-legacy-cleanup` points to the pre-cleanup `main` commit
`9af4bef`.

## Current product - 19 August 2026

The active product is **Radar Sampah - Marine Litter Reporting and Cleanup Demo for Malaysia**. Use short, natural student English in code, documents, slides and team messages. Older TideTrace MY filenames and environment variables stay only for compatibility.

`Report -> Recognize -> Heatmap -> Join mission -> Evidence -> Progress`

Use synthetic/public data, broad area labels and source notes. Do not collect identity data, secrets or exact coordinates.

## Brand and access update - 25 August 2026

- The active GitHub repository is now **radar_sampah**: https://github.com/huangguan-giegie/radar_sampah
- The repository remains private, uses `main`, and the old repository URL is kept only as a redirect/rollback reference.
- The target Render names are `radar-sampah-api` and `radar-sampah-frontend`. The old services stay available until the new links are checked.
- Team Information and the ePortfolio governance block must use the Radar Sampah links. No password, API key or database credential is stored in either place.
- The ePortfolio team page keeps the existing team roles and adds only evidence-backed Radar Sampah sections. Features not built yet remain Planned/Future/TBD.
- The attached Citacita screenshots were used only for page structure and visual density; no Citacita text, image or data was copied.

## Implementation boundary

- Backend: Flask/Gunicorn, PostgreSQL on Render and SQLite fallback.
- Frontend: plain HTML/CSS/JavaScript with an accessible list fallback.
- Visual layer: a small WebGL fragment shader adds a decorative liquid effect; it is hidden when WebGL is unavailable and stays still for reduced-motion users.
- Active API: litter options/reports/recognition/heatmap, cleanup missions and evidence, plus community progress.
- Recognition: deterministic fallback by default. A provider needs `LITTER_RECOGNITION_ENABLED=true`, a private HTTPS URL and team review.
- Database: reports, missions, anonymous joins and evidence are separate from legacy tables.
- DiveSafe MY and older routes remain rollback paths only.

## Design Thinking sync — 19 August 2026

- The active requirements tab now uses Radar Sampah and the confirmed 19-story split: 11 Must, 6 Should and 2 Could. MVP means all Must stories plus GR1–GR9.
- Iteration 1 is Report & Classify; Iteration 2 is Find & Understand; Iteration 3 is Connect & Prepare and stays Future/TBD unless the build proves it.
- The end-to-end discussion sent to Darli uses one-time GPS area suggestion, photo/category/quantity confirmation, deterministic illustrative scoring, moderator verification, collected reports, broad-area severity bands, cleanup follow-up and verified-work points.
- Local acceptance criteria were backed up at `backups/TideTrace_MY_ACCEPTANCE_CRITERIA-20260819.md`. The active Google Doc revision was updated with the same baseline and all eight tabs received a current-baseline or superseded note.
- The independent Swiss/IKB deck is in `radar-sampah-design-thinking/`; it is not uploaded or used to overwrite Darli's deck.
- Darli received the confirmed Radar Sampah end-to-end flow in WhatsApp on 19 August 2026; the message was sent successfully and is awaiting delivery/read status in WhatsApp.
- Design Thinking Google Doc revision after the sync: `AIroW34UkoTwe2ECGafaCkiF30JBPBWHn826cTy-qf0DVAL7FWzdsXL51MrpBPLcUjMKEZdrI8U0w2K0kJhIPgmmGLpMgActmtbDskHLvS8`.

The Radar Sampah implementation is on `main` at commit `7826641`. Local checks on
15 August passed: backend `25 passed`, frontend `9 passed`, Python compileall,
JavaScript syntax checks and shader contract checks. Render was rebuilt from
`7826641` for both the API and static frontend. A synthetic smoke check returned
200 for health/options/context, 200 for demo recognition, 201 for a report,
mission join and before/after evidence, and the report was readable after a
fresh GET. Render reported `database: configured`; no recognition provider was
contacted.

## Rollback record

Commit `d75264e` is the preserved DiveSafe MY rollback point. Keep it available
before TideTrace deployment. It is a recovery record, not the active product
claim or demo path.

## Iterations

1. Report & Classify: Epic 1–2, photo report, quick inputs, suggestion and confirmation.
2. Find & Understand: Epic 3–5, activities, area conditions and reported follow-up.
3. Connect & Prepare: Epic 6–8, community, biodiversity and organiser-supplied preparation; Future/TBD.

## PM release checks

- Run backend and frontend tests from their documented folders.
- Run one local synthetic report, fallback recognition, heatmap, mission join, evidence and progress read-back.
- Before demo, confirm Render uses the intended `main` commit and PostgreSQL can read saved demo data.
- Record commit, test time, URLs, screenshots, response status and limits.
- Keep provider keys private and disabled unless the data flow is agreed.

## Evidence boundary

Passing a checklist supports a course demo only. It does not prove a real detection, pollution source, safety risk, dispatch, legal duty, cleanup result or ecological impact. HealthFirst stays read-only reference material; the Sample Project PGIE is not changed.

## Repository rename record

On 15 August 2026 the active GitHub repository was renamed from
`team04-marine-observation-mvp` to `tidetrace-my-mvp` to match the TideTrace MY
scope. The local `origin` and active project links were updated, and the
documentation-link commit is `ca801b0`. Render service names and deployment
URLs are now `https://radar-sampah-api.onrender.com` and
`https://radar-sampah-frontend.onrender.com`; check the next deployment source
before the next demo. GitHub: `https://github.com/huangguan-giegie/radar-sampah-mvp`.

## Requirements documents - 17 August 2026

Darli's latest private message asked for Epics, User Stories, Acceptance
Criteria and a Security Plan. No teammate had claimed these items in the latest
group chat; Keith's work remains the Data Management/schema task, while
Persona and Problem Statement were already updated by Darli and Jiang.

Four TideTrace MY Google Docs were created in the actual project's Design
Thinking folder. They contain eight Epics, eighteen User Stories and
Given/When/Then criteria. Their structure follows the sample project, but all
HealthFirst facts and old ownership details were replaced with current
TideTrace scope, routes and safety limits:

- TideTrace MY - Epics
- TideTrace MY - User Stories
- TideTrace MY - Acceptance Criteria
- TideTrace MY - Security Plan

Local Markdown source copies are kept under `actual-project/docs/`. The files
use short student-style English, synthetic/public data wording, broad-area
limits, demo fallback wording and clear implemented/future/TBD labels. The
Sample Project PGIE was not changed.

## LeanKit refresh from Darli's latest Design Thinking update — 18 August 2026

Source checked: [Team 04 Design Thinking](https://docs.google.com/document/d/1GuVQunTtGfwmbHVXSh1ybBSLHtDxwRirWvdV1Fnp9LQ/edit), modified 17 August 2026. The current detailed section now has 8 Epics, 18 User Stories and 98 Acceptance Criteria. The earlier compact 8-Epic/16-Story section remains in the document as history; the detailed section is the working source for LeanKit.

LeanKit board: https://monashie.leankit.com/board/2494590220

- Updated the TideTrace MY Epics and User Stories to the latest wording, including the new US1.3 session-totals story and US3.3 save/reminder story.
- Added the 33 criteria that were not on the earlier board version, so all 98 current AC IDs are represented.
- Refreshed the criteria descriptions with the latest Given/When/Then wording and MoSCoW priorities where the existing card could be found.
- Kept the technical cards and ownership mapping: Keith owns Epics/US/AC; Hanxia owns tech/API/database and licence/storage; Darli owns data/sources/visualisation; Jiang owns frontend/accessibility; Su owns architecture/recognition references; Huang owns PM integration and evidence.
- Planned dates remain I1 17–18 Aug, I2 19–21 Aug and I3 22–28 Aug 2026. New work stays in To Do or Epic Backlog; no new card was marked Done.
- The five Future Backlog SMART reflection cards were checked and remain in `FUTURE BACKLOG -Document/Other` without edits: Darli, Su, Keith, Huang and Jiang.
- Test cards and the searched sample cards were moved to or confirmed in `ARCHIVED`; no card was permanently deleted. Sample Project PGIE files were not touched.

Verification notes: representative Epic, User Story, Acceptance Criteria and technical cards were searched after the update and showed the expected owner, card type, lane and priority. The board search confirmed the five protected Future Backlog cards remained unchanged. A few UI searches may need a refresh if LeanKit displays a stale board view; the card-level search is the source of truth.

## Local documentation sync — Design Thinking Tab 11 — 18 August 2026

The local Markdown copies now follow the latest detailed Tab 11 source: 8
Epics, 18 stories (US1.1–US8.2, including US3.3) and 98 acceptance criteria. The iteration
labels are **I1 Report & Classify (E1–E2)**, **I2 Find & Understand (E3–E5)**
and **I3 Connect & Prepare (E6–E8)**.

The working persona is Amirah and the example area is Selangor central west.
Area values stay broad and never expose exact coordinates. AI suggestions need
user confirmation. Scores, heatmap and impact values are illustrative. Any
organiser safety text is explicitly unverified. The documents make no legal,
enforcement, emergency-dispatch or pollution-proof claims.

Stories not supported by the current code are marked Future/TBD; no feature is
described as implemented merely because a similar screen exists. Old HealthFirst
and DiveSafe wording is retained only in the protected historical references or
as clearly labelled rollback context.

## Final Design Thinking sync — 18 August 2026

Design Thinking Tab 11 (revision checked 17 August 2026) is the current source:
8 Epics, 18 stories (US1.1–US8.2) and 98 Given/When/Then criteria. The older
16-story tab is history. Unsupported activity filters, reminders, recurrence,
biodiversity learning and full preparation remain Future/TBD in the current
runtime.

Drive files updated in place; local backup is
`realwork/.backup_design_thinking_sync_20260818`:

- Epics `1FHAREKsiwuJGBYBnM1a-92JhvSXfWQq5CwtmjFX4AAk`
- User Stories `19IYH4zz2faeTyS8yFB5lilzWXn693GJUILKK3JX3yp4`
- Acceptance Criteria `1oDHIvUh9r_DZd67obguPgpEaGR3X9YU_lmhEeW4Vedc`
- Security Plan `1VsL_ZxKCirMxQYiOV46MXb35rlBV7J6ud0hFpsIlijs`
- Data Management Plan `1YXWiFnHCLmaPlKB5uflM0fvMfqcgKNj77x46CMbb2mk`
- Articles and Sources `1MEG45YyJsjqDfLFyfOsREWh9yQq78LnJim4JBuRuLL0`
- Persona `1BjMHyyzrwB7jqSZrYm7EF_OEV5jIxoao`
- Team Info `1lpXD7Yw9fJQ7xt8A5QyQe6UsGQmUcTsi`
- Social Contract `122H3bxvLLXvAlW3ZI9sW5GZs0SE8hJ3e`
- 19-slide deck `1aU_HQoaEwIZ-__RMElYfMce7wdPLfnX4`

The local deck passed a 19-slide XML check and LibreOffice render. The Sample
Project PGIE, history and Future Features folders were not edited.

## Jiang workshop minutes check and latest LeanKit sync — 19 August 2026

I checked Jiang's latest `WORKSHOP MINUTES` document and the Team 04 chat. The
working decisions now use 19 stories, with GR5 promoted to Must and GR9 limited
to the AI-assisted path. The notes also define one-time GPS assistance (area
name only), four severity bands, area sensitivity 1.0/1.25/1.5, moderator
verification, collected reports, and points of 5 for a verified session and 1
for a verified report. The score no longer uses the old confidence term and the
display cap is `102+`, not `100+`.

The 19-slide onboarding deck was updated and synced to Drive. Its audience
copy now uses `Radar Sampah`, while the Drive filename still keeps the older
Marine Observation wording for link stability. The deck marks organiser text,
recurrence, and other unsupported work as future or limited.

LeanKit representative cards were refreshed: Epics 2–8, US1.3, US2.1, US2.2
and US3.3 now carry the latest owner, iteration, confirmation, moderation and
scoring notes. The Future Backlog lane was not changed. US5.3 moderator
verification is still a follow-up card to add if the team confirms the board
should grow beyond the current visible cards.

Document audit found a naming mismatch: several formal files still say
`TideTrace MY` or contain older 18-story wording. Before rewriting those files,
the team should confirm whether `Radar Sampah` is the final public name. The
candidate sync list is recorded in the PM handoff and the group update draft.

## Design Thinking deck enrichment — 19 August 2026

The 10-slide `TideTrace_MY_Design_Thinking.pptx` was used as the main visual
reference and updated in place. It now carries the latest workshop details:
Radar Sampah naming, 19-story scope, Amirah's needs, user-confirmed AI
suggestions, one-time GPS assist, severity bands and sensitivity factors,
moderator verification, collected-report handling, and the Future/TBD boundary
for organiser and community features. The deck keeps synthetic/public data and
no-exact-location wording visible.

Backup: `realwork/.tmp_design_thinking_update/TideTrace_MY_Design_Thinking-before-enrich.pptx`.
Drive file `1uBnx3ECzzNrL8u14qTcikuazzkjdHcDc` was updated in place on 19 August
2026; the link was preserved. Local render QA covered all 10 slides, and the
overflow test passed with no detected clipping.

## Design Thinking deck expansion — 19 August 2026

The deck was expanded from 10 to 19 slides using the latest Design Thinking
content as the source. It now follows the story from problem and Amirah's
persona, through reporting, suggestion, confirmation, area reasoning and
future iterations, then closes with the system, data boundary and roadmap.

The visual direction is a blue, Swiss-inspired layout with large headings,
simple cards and clear section labels. The final deck uses the public name
`TideTrace MY`; the earlier `Radar Sampah` wording was removed from the
audience-facing slides. Future/TBD work remains labelled rather than shown as
completed. The current runtime boundary is still explicit: synthetic/public
data, broad areas, user-confirmed suggestions and no legal, scientific or
enforcement claims.

Local backup: `realwork/.tmp_ppt_expand/TideTrace_MY_Design_Thinking-before-expand.pptx`

Final local deck: `realwork/deliverables/presentation/TideTrace_MY_Design_Thinking.pptx`

Drive file: `1uBnx3ECzzNrL8u14qTcikuazzkjdHcDc`
(`https://docs.google.com/presentation/d/1uBnx3ECzzNrL8u14qTcikuazzkjdHcDc/edit`).

Verification completed: 19 slide XML files, 19 speaker-note `[Sources]`
blocks, no HealthFirst/DiveSafe/Radar Sampah text, all slides rendered to PNG,
and `slides_test.py` reported no overflow. The deck is ready for the team to
review; it does not claim that the partially implemented future workflows are
available in the current demo.

## Closing slide revision — 19 August 2026

The final slide was changed from a standalone `Questions?` ending to a clear
close: `Thank you`, the TideTrace MY value statement, a short `What we built`
summary, the next test step, and a small invitation for discussion. This keeps
the Q&A option without making the deck look unfinished. The updated Drive file
keeps the same ID and link; the local rendered slide 19 and the overflow test
were checked again after the change.

## Contents slide sync — 19 August 2026

Darli added a three-part contents list to slide 2 in the shared deck:
`Overall flow`, `Overall features`, and `Iteration 1 feature with prototype
(if applicable)`. I added this as a dedicated TideTrace MY contents slide,
kept the wording short, and moved the existing story to slide 3 onward. The
deck now has 20 slides, with page numbers and source notes aligned.

The new slide was rendered and inspected, the final slide is still the clear
`Thank you` close, and `slides_test.py` again reported no overflow. The Drive
file ID and link remain `1uBnx3ECzzNrL8u14qTcikuazzkjdHcDc`.

## Visual asset update — 19 August 2026

The deck now includes eight small, text-free illustrative visuals: a coastal
cleanup cover image, a phone/report scene, a fictional Amirah avatar, a
broad-area coast map, a before/after beach comparison, a litter-category
arrangement, a user-confirmation scene and an area-level data-flow graphic.
The Design Thinking
document was checked first; it contains visual references but no clean
standalone image files, so these assets were generated as synthetic support
art rather than copied screenshots. Prompts and dates are kept in
`realwork/.tmp_ppt_images/prompts.txt`.

The assets do not show exact sensitive locations, real people, product
screenshots or measured environmental evidence. Source notes were added to
the eight affected slides. The deck remains 20 slides, keeps Darli's contents
slide, and is backed up at
`realwork/.tmp_ppt_image_edit/TideTrace_MY_Design_Thinking_before_visuals.pptx`.

## Current active alignment — 19 August 2026

This handoff supersedes older 18-story and TideTrace scope notes above. The
public working name is Radar Sampah. The plan has 19 stories: 11 Must, 6
Should and 2 Could. GR5 is Must.

- GR7 hides a reported photo showing a person or private property from public
  views immediately while it waits for review.
- GR9 measures the AI-assisted path; manual entry remains a complete fallback.
- GPS is optional and one-off. It helps select an area name only; no exact GPS
  value is stored or returned.
- US5.3 adds moderator verification before a report can be marked collected.
- D1-D7 cover naming, priorities, GR5, AI, GPS, severity and report states.
  Severity uses a deterministic versioned formula, four bands and area
  sensitivity factors 1.0, 1.25 and 1.5. The open display is `102+`.
- Current code is partial. Unsupported stories remain Future/TBD.
`slides_test.py` passed with no overflow; the package contains 20 slide XML
files, 20 note files and eight embedded images. The Drive file ID and link stay
unchanged.

## Radar Sampah flow and independent lightweight deck — 19 August 2026

The confirmed end-to-end flow was sent to Darli in WhatsApp. It covers one-time
GPS area suggestion, photo and category confirmation, AI suggestion plus
deterministic illustrative scoring, moderator review, collected reports,
broad-area severity, follow-up wording and verified-work points. Exact litter
coordinates are not stored or shown.

The active Design Thinking tab was updated to the current Radar Sampah baseline:
19 stories (11 Must, 6 Should, 2 Could), GR5 Must, GR7 immediate photo hiding,
GR9 AI-assisted interaction target, US5.3 moderator verification and D1-D7.
The latest Drive revision is recorded in the earlier sync entry; the original
active-tab content is backed up in `realwork/backups/`.

An independent lightweight Swiss/IKB deck was created without overwriting
Darli's shared deck: `realwork/radar-sampah-design-thinking/index.html` and
`Radar_Sampah_Design_Thinking.pptx`. It has 12 slides, speaker notes, a
Thank-you close and labels for Current/Planned/Future items.

Quality checks: backend tests 25 passed; frontend workflow tests 9 passed;
Python/JavaScript syntax checks passed; `git diff --check` passed; Swiss deck
validation passed; presenter validation reported 0 errors and 0 warnings. Six
governance DOCX files were regenerated and rendered with LibreOffice: five have
two pages and the compact persona has one page. All rendered pages were checked
for clipping, overlap and stale audience-facing brand names.

## Project recording rule and latest chat review — 20 August 2026

### Rule: record every actual-project decision here

This file is the working PM log for the actual Team 04 project. Any change to
the project scope, product name, requirements, end-to-end flow, feature status,
roles or task allocation, code, database, deployment, Drive documents, slides,
GitHub, Render or LeanKit must be recorded here before or at the time the team
adopts the change.

Each new entry should include:

- local date/time;
- source (Team 04 chat, Darli message, Design Thinking, GitHub, Render, Drive
  or LeanKit);
- decision or change, written in plain language;
- owner and current status (`Current`, `Planned`, `Future`, `TBD` or
  `Superseded`);
- affected files, links or cards;
- next action and evidence to check.

The log is append-only. Do not remove earlier decisions. If a requirement or
name changes, mark the old entry `Superseded` and add the new decision with its
source. The active requirements source is the latest Design Thinking
`Confirmed Flow` / current requirements tab. Older TideTrace, DiveSafe,
Marine Observation and compact 16-story material is historical or rollback
context until it is explicitly reconciled here. The Sample Project PGIE and
its protected folder (`1RfEiGPd5_v2Ka5TieeeLSh4-YB0mUjvk`) remain outside the
actual-project scope and must not be changed by this rule.

### Latest Team 04 chat details checked

Chat review time: **2026-08-20 16:54 (+09:00)**. The latest visible group
messages were around 16:31–16:35, with earlier flow messages from the same day.

- Darli asked whether the presentation should cover the entire solution or only
  Iteration 1, then shared an IM Showcase slide plan and said the slides were
  due today.
- The current presentation order requested in the group is: elevator pitch and
  project introduction; problem/challenge; evidence and research; target
  audience/persona; proposed solution and user value; high-level system and
  open data; epics and roadmap; Iteration 1 must-have features and prototype;
  then risks, sponsors, next steps and a clear feedback request.
- Darli's earlier flow message remains the product reference: stabilise the
  confirmed flow first, then revise Epics, User Stories and Acceptance Criteria
  and plan iterations/tasks from it. A second persona may be added in Iteration
  2 if moderator access introduces a small future feature.
- Keith's severity-score question is still an open design check: species
  weighting must not create misleading priorities. Scores and maps remain
  illustrative until the method is agreed.
- Jiang said her drawing was not finished and would be added when complete.
- Su shared a Drive reference link in the group at 09:31:
  `https://drive.google.com/file/d/1KNBhn2YMJIZC7giTuHhh6QcnwZLNe_8M/view?usp=drive_link`.

Darli's latest private message reviewed at **16:39** gives the same nine-slide
presentation structure in more detail. The slide guidance is a presentation
scope update, not a claim that every future product feature is implemented:

1. Elevator pitch, project name, problem, audience, solution and relevant
   UNSDG (about 45 seconds).
2. WHO → WHERE → WHAT → WHY problem statement; do not introduce features yet.
3. About three strong evidence items, including research/statistics, an
   Australian news example and a limitation of the current process.
4. A specific target audience and one primary persona, shown as goal, pain
   points and needs.
5. Proposed solution shown as problem → feature → user benefit, with three or
   four major capabilities.
6. A simple non-technical system overview (users → web application → core
   functions → data/AI/external sources → database) plus Iteration 1 open data.
7. The Iterations 1–3 roadmap and about six to eight epics, with Iteration 1
   Must-Haves highlighted.
8. Iteration 1 prototype and user-facing Must-Have features, rather than API,
   database or other project-management tasks.
9. Risks, possible sponsors and next steps, ending with feedback on problem
   focus, Iteration 1 scope and features/risks to reconsider.

No WhatsApp message was sent during this review. The next PM check is to align
the working deck and any linked documents with this order while keeping the
confirmed product flow, broad-area privacy boundary, moderator verification,
AI-suggestion wording and Current/Planned/Future labels unchanged.

## Presentation task allocation suggestion — 20 August 2026

Source: Team 04 group chat, Darli's IM Showcase brief, reviewed at
**2026-08-20 16:56 (+09:00)**. Status: `Planned`, pending team confirmation.

The group message confirms that the slides are due today. A practical split
that follows the existing team roles is:

- **Darli** — Slide 3 evidence/research and Slide 9 risks/sponsors; check that
  statistics, Australian news and source links are clear.
- **Jiang** — Slide 4 target audience/persona and the supporting empathy-map
  visual; finish and upload the drawing she said was still in progress.
- **Keith** — Slide 7 epics and roadmap; confirm the Iteration 1 Must-Haves
  match the current Design Thinking requirements.
- **LiHanXia** — Slide 6 high-level system overview and Iteration 1 open-data /
  feasibility notes; keep the explanation understandable to a non-technical
  mentor.
- **Su** — Slide 8 Iteration 1 prototype and the technical/reference check;
  keep AI, recognition and risk wording within the current demo boundary.
- **Huang Guan (PM)** — Slides 1, 2 and 5, then integrate the deck, check all
  links and sources, remove duplicated wording, run the final visual proofread
  and submit the final version.

Suggested group message (not sent):

> Quick task split based on Darli's IM Showcase guide (slides due today):
> Darli — Slides 3 and 9 (evidence, risks and sponsors); Jiang — Slide 4 and
> the empathy-map visual; Keith — Slide 7 (epics and roadmap); LiHanXia — Slide
> 6 (high-level system and Iteration 1 open data); Su — Slide 8 (Iteration 1
> prototype and technical check); Huang — Slides 1, 2 and 5, then final deck
> integration, link/source check and submission. Please add your updates or
> links today and flag any overlap. We will keep the main story focused on the
> Iteration 1 MVP and label later work as planned.

This is a coordination proposal rather than a confirmed reassignment. No
WhatsApp message was sent while preparing it.

## Correction after full 24-hour chat review — 20 August 2026

Review time: **2026-08-20 17:03 (+09:00)**. The earlier presentation split
above is now marked `Superseded` as a task-allocation suggestion; it was not a
direct instruction from Darli and should not be treated as a reassignment of
the PPT work.

The direct evidence in the latest group chat is different:

- At 16:09 Huang said he would renew the deck in an editable format and use
  more content from the project documents.
- At 16:12 Darli said she had added information to some slides and that the
  team should focus on the important parts for the eight-minute presentation.
- At 16:15 Darli said that after the slides, the team could prepare the script
  and practise for Friday's studio.
- At 16:23 she asked everyone to read the IM Showcase PDF.
- At 16:29 she wrote: “For this session, I will revisit our Epics for this.
  @1838217031 Please allocate task for this.” This is the clear request to the
  PM to allocate work, and its immediate context is revisiting the Epics for
  the session, not assigning someone else's PPT section.
- At 16:30 Jiang said she had redrawn the prototype. Darli then asked whether
  the scope was the entire solution or only Iteration 1, followed by the slide
  outline and the reminder that slides were due today.

Working interpretation (`Current`): Huang remains responsible for renewing and
integrating the PPT. Darli is revisiting the Epics; the PM should allocate the
session's requirements/design tasks around that work and confirm ownership,
rather than split the PPT into new slide owners. The slide outline is guidance
for content and timing, not evidence that Darli reassigned the presentation to
the team.

No WhatsApp message was sent during this correction.

## Darli private-chat check: presentation QA interpretation — 20 August 2026

Review time: **2026-08-20 17:06 (+09:00)**. Darli's latest private messages
were about the **presentation script flow**, not a QA allocation. She described
the order as elevator pitch → problem → evidence → affected people → solution
value → high-level system/data → Iterations 1–3 → first delivery → risks,
sponsors and feedback questions. Her detailed follow-up gives the same slide
content and speaking-time guidance.

No direct private message was found asking Huang to assign presentation QA
pages, review particular slides or distribute QA owners. The group message at
16:29 asking the PM to “allocate task for this” is still best read in its
immediate context: Darli was revisiting the Epics for the session. Huang's
previous statement that he owns the PPT remains the current assignment.

Status: `Current` — Huang continues to own PPT editing and final integration.
If the team later wants a QA pass, it should be proposed as a separate review
step after the editable deck is ready, with owners and page ranges confirmed in
the group first. No WhatsApp message was sent during this check.

## Design Thinking content check for presentation preparation — 20 August 2026

Source: latest Google Drive Design Thinking document, read at
**2026-08-20 17:10 (+09:00)**. The document does contain the main content needed
for Darli's presentation structure, spread across its tabs:

- problem statement with WHO → WHERE → WHAT → WHY;
- research basis, Malaysian cleanup evidence and source links;
- primary audience and Amirah persona with goals, pain points and needs;
- empathy map and design interpretation notes;
- Radar Sampah solution, overall flow and user value;
- high-level system/data explanation and open-data references;
- 19-story scope, 11 Must / 6 Should / 2 Could, GR1–GR9 and Iterations 1–3;
- Iteration 1 Must-Have stories and acceptance criteria;
- data, privacy, AI-suggestion, broad-area and non-enforcement boundaries;
- future/TBD items, including moderator workflow, recurrence and later
  community features.

Conclusion: the Design Thinking document is sufficiently complete as the
content source. It does not mean the presentation itself has passed final QA or
that every Future/TBD feature is implemented. The remaining work for Huang is
to select the strongest points, place them in the agreed slide order, check
links/source labels and remove duplicated or outdated wording. A new page-level
PPT reassignment is not required from this document alone.

## What the PM task allocation refers to — 20 August 2026

Darli's 16:29 request to allocate tasks refers to the current session's Epic,
requirements and design review, not to splitting PPT pages or assigning
presentation QA owners. A practical allocation using the existing roles is:

- Darli: revisit the Epic framing, evidence and source alignment;
- Keith: check Epics, User Stories and Acceptance Criteria against the latest
  Design Thinking baseline;
- Jiang: finish the redrawn prototype and keep the UX/empathy content aligned;
- LiHanXia: check the tech stack, open-data licence, storage and feasibility
  notes;
- Su: review the high-level architecture, recognition/reference wording and
  technical risks;
- Huang: coordinate these updates, record decisions, integrate the PPT and
  keep the final source links consistent.

Status: `Planned` until the group confirms the split. Presentation editing and
final deck QA remain Huang's responsibility unless the team explicitly agrees
otherwise.

## Group allocation message sent — 20 August 2026

At **17:26 (+09:00)** Huang sent the Team 04 group a collaborative task note
with `@all`. It clarified that the allocation is for the current Epics,
requirements and design-review session, **not a new PPT page split**. The note
assigned Darli to Epic/evidence alignment, Keith to Epics/User Stories/
Acceptance Criteria, Jiang to the redrawn prototype and UX/empathy alignment,
LiHanXia to tech/data/licence/storage feasibility, Su to architecture/
recognition/reference/risk review, and Huang to coordination, decision records,
PPT integration and final links. The message asked members to share updates or
blockers and flag any role adjustment.

## Jiang–Darli discussion review — 20 August 2026

The latest group-chat exchange reviewed at **2026-08-20 17:14 (+09:00)** is
mainly about preparing the IM Showcase, not a new product requirement:

- Huang is renewing the deck as an editable file using the project documents.
- Darli added content to several slides and asked the team to keep the story
  focused because the presentation is limited to eight minutes.
- Darli shared the official proposal PDF and asked everyone to read it.
- Jiang said she had redrawn the prototype and then labelled it “Interaction
  1”. Darli asked whether the deck should cover the whole solution or only the
  first iteration, so they are aligning the prototype scope with the showcase
  requirements.
- Darli then shared the nine-part slide plan and said the slides were due
  today. The script and Friday practice come after the slides.

Working interpretation: they are aligning the showcase narrative, prototype
scope and submission timing. This exchange does not assign a new QA split or
change Huang's existing PPT ownership.

Clarification at **2026-08-20 17:24 (+09:00)**: Jiang's prototype ownership is
already evidenced by her group message, “I have re-drawn the prototype.” The
earlier allocation suggestion did not create a new Jiang task; it restated her
existing prototype work. The added wording about keeping UX/empathy aligned is
coordination guidance based on her existing UI/UX role, not a new confirmed
assignment.

## IM Proposal deck review and update — 20 August 2026

Source: Google Slides `Radar Sampah — IM Proposal (Editable)`
(`1DBadsZJZ-GbkpK6Q_ki9PlJAp9vXTBXGMPJknbaEn1A`). The deck remains 9 slides
and follows the agreed IM order. The team selected a 9-minute rehearsal target;
the cover now says `IM PROPOSAL` rather than showing the timing label.

Visible updates:

- Slide 3 now names the Reef Check Malaysia 2024 report, the 19 July 2018 ABC
  Australia comparison and the 2018 Ocean Conservancy report, with source
  domains and clear limits.
- Slides 5 and 8 now show volunteer confirmation before the deterministic
  illustrative score, plus photo, category, quantity and broad-area inputs.
- Slide 5 labels moderator verification, collected reports, recurrence and
  partner workflows as Future/TBD.
- Slide 6 now states the draft → validate → suggest → confirm → save hand-off,
  the suggestion/manual fallback and the broad-area source check.
- Slide 9 now includes data quality, suggestion reliability, uneven user
  records and scope risks, potential sponsor context and three focused feedback
  questions.

Verification:

- Fresh Google Slides text readback confirms the new cover label and all updated
  flow/source/risk wording; the file revision is `ELIBkecMIFjAXg`.
- All 9 slide thumbnails were fetched after the main update. A final p9 render
  was checked after fixing two text overlaps; no visible overlap remains on the
  sponsor or feedback cards.
- The deck still uses synthetic/public examples, broad areas and non-scientific,
  non-legal, non-enforcement wording. No Drive message was sent during this
  edit.

## Darli private-chat alignment check — 20 August 2026

At **16:38–16:39 (+09:00)**, Darli restated the showcase order in private chat:
elevator pitch, problem, evidence, specific people affected, solution and user
value, high-level system/data, Iterations 1–3, the first deliverable, then
risks, potential sponsors and feedback questions. Her longer note also asked
for WHO–WHERE–WHAT–WHY, three strong evidence examples including an Australian
news example, a focused persona, problem → feature → benefit framing, and a
simple system diagram rather than a technical deep dive.

Read-only comparison with revision `ELIBkecMIFjAXg`:

- **Aligned:** the deck starts with the elevator pitch; Slide 2 uses WHO / WHERE
  / WHAT / WHY; Slide 4 focuses on the volunteer persona Amirah; Slide 7 covers
  Iterations 1–3; Slide 8 states the I1 must-have deliverable; and Slide 9 has
  risks, potential sponsors and focused feedback questions.
- **Mostly aligned:** Slide 3 has three source examples, including ABC
  Australia, plus source limits. It shows organisation, date and domain, but
  the full article/report titles are still shortened.
- **Needs a small follow-up:** Slide 1 has the project name and elevator pitch,
  while the problem, audience, solution and UNSDG are introduced on Slides 2–4
  rather than briefly repeated on the cover. Slide 5 gives the main report →
  suggestion/review → hand-off value chain, but map, severity and monitoring
  examples are represented later as roadmap items rather than separate
  problem–feature–benefit rows.
- **Scope note:** Slide 6 is understandable, but it is still a compact stack
  view (Frontend, Flask API, Recognition, Data layer, Open context). It should
  be kept high-level when presenting, following Darli's advice not to begin
  with architecture. Future/TBD moderator, collected-report and recurrence
  work is clearly labelled and must not be presented as current functionality.

Conclusion: the current deck follows Darli's requested narrative and is usable
for rehearsal. The remaining items are presentation refinements, not blockers:
read the source cards aloud with their full titles, briefly connect the cover
to the problem/audience/solution, and explain Slide 6 in user terms before any
technical detail. No PPT or message was changed in this check.

## IM Proposal deck alignment update — 20 August 2026

Following Darli's latest private-chat guidance, the editable Google Slides deck
`Radar Sampah — IM Proposal (Editable)` (`1DBadsZJZ-GbkpK6Q_ki9PlJAp9vXTBXGMPJknbaEn1A`)
was updated in place. Fresh readback revision: `N-PHG5a8W1cQew`.

Changes made:

- Slide 1 now repeats the audience, the scattered-record problem, the report /
  review / follow-up solution and UNSDG 14 in short cover lines. The synthetic,
  broad-area and non-scientific boundary remains visible.
- Slide 3 now uses fuller source labels: Reef Check Malaysia's International
  Coastal Cleanup 2024, ABC News Australia's 19 July 2018 article and Ocean
  Conservancy's 2018 International Coastal Cleanup report. The footer points
  to source titles, dates, URLs and claim limits in `source-notes.md`.
- Slide 5 now maps four user needs to four hand-offs: structured report, area
  view, suggestion + illustrative score, and follow-up. AI suggestion,
  volunteer confirmation and deterministic scoring remain explicit; moderator,
  collected-report, recurrence and partner work stay Future/TBD.
- Slide 6 now explains the high-level user flow as users → web app → checks →
  data, with short cards for report, validation/confirmation, rule score,
  PostgreSQL/SQLite and source context. It remains a user-facing overview, not
  an architecture deep dive.

Verification:

- Fresh text readback confirmed all four changed slides and the deck remains 9
  slides.
- Fresh thumbnails for Slides 1, 3, 5 and 6 were checked. Slide 3's long Ocean
  Conservancy source was shortened after visual review so it stays inside the
  card; no visible overlap remains in the checked slides.
- No code, runtime API or deployment setting was changed. No WhatsApp message
  was sent by this edit.

## Darli requirements and workflow sync — 20 August 2026

Darli asked Huang to allocate the Iterations from the newest Epics and User
Stories, sync Jiang's prototype, and identify the practical MVP. The current
Design Thinking document was read at revision
`AIroW37r7lCWMObrfUTkSbZGjzj4NTjCfTYZLeadjhE8FVYFoHHZKI2aKLtOuSe7H2mDyRNVFeYochbSFweoXwzIPkD-nJr3jxwDB-ZCDE`
and its detailed requirements tab is `t.omld9s7348k4`. It contains 25 stories:
15 Must, 6 Should and 4 Could.

The separate Confirmed Workflow document was read at revision
`AIroW37C87P8pJnjOBtCc5ViyIJ9BrPi5L5jce7t7XTMQ6QEJ_fUT14I-SRHJLYSo16MDFdEomXFA6VNo9MsfICfj_vgSlBgqxsZHJNXeM0`.
It is the flow reference for map-first or cleanup-first entry, organiser
permission, moderator review, pending visibility, cleanup outcomes and
recurrence wording.

The detailed Epic titles are now the authority for the corrected map:
I1 Prepare & Report (E1–E2), I2 Find & Understand (E3–E5), and I3 Connect &
Prepare (E6–E8). I1–I2 are the practical MVP direction; the current runtime is
only partial and unsupported moderator, organiser, cleanup follow-up,
biodiversity learning and recognition features remain Future/TBD.

Local requirement, DMP, scope, team and integration documents were backed up
under `.backup_sync_20260820` and rewritten to this 25-story baseline. The
active Google Slides deck remains a 9-slide IM Proposal and will be updated on
Slides 5–9 to match the same map and workflow. No runtime code or deployment
setting changes are included in this sync. Sample Project PGIE, history and
Future Features remain outside the edit scope.

## Latest Darli requirements sync — 20 August 2026 (authoritative current state)

The latest detailed Design Thinking tab is `t.omld9s7348k4` in document
`1GuVQunTtGfwmbHVXSh1ybBSLHtDxwRirWvdV1Fnp9LQ`. The current count is **25
stories: 15 Must, 6 Should and 4 Could**. The practical MVP direction is
Iteration 1 (Epics 1–2) plus Iteration 2 (Epics 3–5). Iteration 3 (Epics 6–8)
and unsupported organiser, moderator, cleanup-outcome, recurrence,
biodiversity-learning and points features are `Future/TBD`.

The confirmed workflow document is
`1Nw_yOmg_YNBCfM6viIUeUrIWpktDRcjl8Z_CSyudr3Q`. Its active flow is
map-first or cleanup-first entry → photo/category/quantity → optional one-time
GPS area suggestion → AI suggestion or manual entry → volunteer confirmation
→ pending review → broad-area public view. A moderator cannot verify their own
record. Exact litter coordinates are not public; synthetic/public data,
illustrative scores and non-enforcement/non-scientific limits remain explicit.

Local files updated and backed up in `realwork/.backup_sync_20260820/`:
Epics, User Stories, Acceptance Criteria, API, Decisions, DMP, Project Scope,
Team Information and Integration Checklist. The native Drive Epics, User
Stories and Acceptance Criteria files were updated in place with revision
guarding. The shared 9-slide IM Proposal
(`1DBadsZJZ-GbkpK6Q_ki9PlJAp9vXTBXGMPJknbaEn1A`) was updated in place to show
the two entry points, role/review path, 25-story map, I1–I2 MVP direction,
Future/TBD boundaries and current risks. Latest deck revision after the write:
`yTJw8MptTHOq5A` (then a small label correction produced `Vg0Gpsy9oYTYSw`).
The resulting native requirement revisions are Epics
`AIroW34g-gnQNI4UG1Na78KPnl3UdCb6CPWTSOIzK9np-EJXFTGPwBE5DvDaNid1itfoZj4edc6vS1sd147_DLuyc1FQOqDRz5VAbKGBZvI`, User Stories
`AIroW37rJJYfrm2zputMvHf_30-CUUcKLGAKqCXxoVawtxh1dWiWoyh6YaDSGNg-8AmB5vkhi_sQ14jLvhkxJ13wXGKBpiu1TlpgTeBIKC8`, and Acceptance Criteria
`AIroW37FzpDfWjV8MT9j2UpeJoj6M1KtaeSB5Zq5ZEWUX3vFHuSM5efMo3xDM4d6gAuj9shUEOmVfcLfQZnpPCcp3rDgsJKFheL7cjm6Wcg`.

The Drive draft DMP (`1YXWiFnHCLmaPLKB5uflM0fvMfqcgKNj77x46CMbb2mk`) is visible
in Drive search but is not readable through the Docs API (404), so its old
content was not overwritten. `TM04 Team Info.docx` is an Office file and is
not writable through the native Docs batch API. Local copies are the current
source for both; Drive-native replacement requires a separate file upload or
owner permission. Sample Project PGIE, history, archive and Future Features
were not changed.

Verification after sync: native Docs readback shows 25 story references in
Epics, User Stories and Acceptance Criteria, with no old `19 stories` or
`11 Must` text. The presentation still has 9 slides; readback confirms the
new two-entry flow, 25-story/15-6-4 map, I1–I2 MVP wording and Future/TBD
labels. Fresh thumbnails for Slides 5–9 are retained in
`realwork/.tmp_ppt_verify/`; a PDF export completed successfully (453,368
bytes). No runtime code or deployment was changed.

## Presentation rehearsal materials — 20 August 2026

Created two bilingual rehearsal files for the current 9-slide Radar Sampah IM
Proposal:

- `deliverables/documents/Radar_Sampah_Presentation_Review_Bilingual.md` and
  `.docx` — English-first review notes with Chinese reference, current facts,
  end-to-end flow, 25-story iteration map, safe current/Future wording, roles,
  risks, Q&A and source links.
- `deliverables/documents/Radar_Sampah_Presentation_Script_Bilingual.md` and
  `.docx` — English speaking script with Chinese practice notes for a roughly
  nine-minute presentation.

Both files use the current Design Thinking tab `t.omld9s7348k4`, Confirmed
Workflow `1Nw_yOmg_YNBCfM6viIUeUrIWpktDRcjl8Z_CSyudr3Q` and the 9-slide IM
Proposal as sources. They keep I1–I2 as the practical direction, label
unsupported moderator/organiser/cleanup outcome/recurrence/biodiversity and
points work as Future/TBD, and repeat the broad-area, synthetic/public,
non-scientific and non-enforcement boundaries. The DOCX files were rebuilt
with the project document builder and rendered through LibreOffice: review
notes 5 pages and script 7 pages. Every rendered page was visually checked;
no clipping, blank pages or broken list markers were found.

## WhatsApp team status check — 20 August 2026

Latest visible Team 04 group messages show that the current focus is stabilising
the IM Proposal slides rather than adding new runtime features:

- Keith asked whether the current deck was all that the team would present.
- Darli replied that more content should be added and reposted the showcase
  slide plan: problem, evidence, persona, solution, system/data, epics/roadmap,
  Iteration 1 prototype, risks and feedback.
- Keith accepted Slide 6 (System + Data: high-level diagram, core components
  and open datasets for Iteration 1).
- Darli said she was working on Slide 7 (Epics / Roadmap), covering Iterations
  1–3 and highlighting Iteration 1 Must-Haves.
- The team briefly checked the area wording: Selangor beaches can be described
  as the West Coast of Malaysia; “Strait of Malacca” was also considered and
  both were said to be acceptable. This wording still needs one final choice in
  the deck for consistency.

Darli's latest private-chat messages say the team should stabilise the slides
first so the speaking points are clear. She also said the iteration planning in
Design Thinking was created for slide purposes and that only the Epics are
needed for the current slide focus. My current PM follow-up is therefore to
keep the deck wording and links consistent, wait for Darli and Keith's slide
updates, then do a final slide-by-slide check before rehearsal. No new feature
implementation was requested in these messages.

## Latest group update — 21 August 2026

The latest Team 04 messages show a presentation/data refinement, not a change
of the Radar Sampah product direction:

- The team agreed the deck only needs up to 10 slides. Darli asked not to
  delete the extra material yet while the slide structure is being settled.
- Keith completed the Data Management Plan updates and is keeping the open
  dataset content to one slide for now.
- Keith shared `https://habitats.oceanplus.org/` as a possible open-data/source
  reference. The group noted that it does not contain the specific species
  needed, so it is a candidate source rather than confirmed project evidence.
- Darli asked whether coral and mangrove datasets should be added. No final
  decision is visible yet; do not present them as confirmed datasets until the
  group agrees on the source, scope and wording.
- Darli also asked for potential project sponsors. Keith shared
  `https://www.mrf-asia.org/` (Marine Reef Conservation / MRF Asia) as a
  possible sponsor reference. This remains potential, not confirmed support.
- The current practical action is to stabilise the shorter deck, keep one
  dataset slide, record the selected sources and sponsor wording, then run a
  final consistency check against Design Thinking and the confirmed workflow.

## Latest MVP direction from Team 04 chat — 21 August 2026, 00:29–00:36

Darli proposed a narrower Iteration 1 MVP because the earlier scope looked too
large for one week. The current direction is one complete journey from finding
or joining a cleanup activity, through reporting and confirmation, to viewing
the resulting area information. The message lists these Iteration 1 areas:

- Epic 1: cleanup activities — view nearby activities, join one, and create or
  manage one;
- Epic 2: litter reporting — standardised photo/category/quantity input with
  one-time GPS assistance, plus correction of the suggested beach, category or
  quantity;
- manual reporting must still work without AI;
- Epic 3: report reliability — show report status and keep pending, unreliable
  or duplicate reports out of the public map, with a basic internal review
  workflow;
- Epic 4: beach attention — four MVP beaches, evidence labels such as
  “Insufficient data” and “Not recently reported”, and the fixed scoring rule
  with four severity bands;
- Epic 5: marine biodiversity context — biodiversity map layer and ecological
  explanation for each beach, treated as central to the MVP rather than an
  optional add-on;
- cleanup feedback, recurrence monitoring and contribution points remain in the
  discussion as later work unless the team explicitly confirms a smaller demo
  slice. A basic points system without a leaderboard was suggested as possible.

Keith noted that some work can start in Iteration 1 and finish in a later
iteration. Darli agreed that Iteration 1 is the MVP but is concerned that the
team should not appear to have delivered every feature in one week. Therefore
the deck should show a clear MVP boundary and move unfinished work to
Iteration 2/3 or Future/TBD instead of implying it is complete.

The latest group direction for the deck is therefore: stabilise the scope,
keep the shorter deck, show the core reporting/monitoring path, and make the
status of unfinished organiser, moderator, cleanup-outcome, recurrence and
points features explicit. This entry is a chat-based decision record; the
Design Thinking document remains the source of exact story and acceptance
criteria wording.

## Bilingual presentation rehearsal materials - 21 August 2026

Created local review and speaking materials from the latest 10-slide IM
Proposal, Design Thinking, Confirmed Workflow and the 21 August group update:

- `deliverables/documents/Radar_Sampah_Presentation_Review_Bilingual.md/.docx`
- `deliverables/documents/Radar_Sampah_Presentation_Script_Bilingual.md/.docx`
- The speaking copy targets about 9 minutes and includes English first with
  Chinese practice notes.
- The materials use the current flow: map or cleanup-activity entry, photo /
  category / quantity, one-time broad-area GPS suggestion, AI suggestion or
  manual input, volunteer confirmation, pending review and verified-only
  broad-area sharing.
- Cleanup outcome, recurrence, biodiversity learning, points, complete
  organiser tools and detailed moderator tooling are marked Future/TBD unless
  current evidence is available.
- A known deck inconsistency is recorded: the current Slides deck has 10
  slides but still displays an older `18 USER STORIES` label; latest Design
  Thinking remains 25 stories (15 Must / 6 Should / 4 Could). The rehearsal
  script does not repeat the outdated 18-story count.

Verification completed: both DOCX files were regenerated and rendered with
LibreOffice to PNG/PDF. The review document rendered to 7 pages and the
speaking script rendered to 8 pages. Representative first, middle and final
pages were visually checked for clipping, overlap, broken tables and missing
glyphs. No PPT, Drive file, code or deployment was changed in this task.

## Work allocation update — 21 August 2026

Source: PM request and the actual-project Drive inventory checked on 21 August
2026. The user specifically assigned **User Acceptance Criteria to Hnin
Darli**.

This supersedes the earlier shorthand that listed Keith as the sole owner of
Epics, User Stories and Acceptance Criteria. The work is now split rather than
duplicated:

- **Hnin Darli** — User Acceptance Criteria review: check each criterion from
  Amirah's user perspective, confirm evidence/source traceability, and mark
  Current, Planned or Future/TBD.
- **Keith Junn Chong** — requirements baseline: maintain Epics, User Stories
  and the technical Given/When/Then acceptance-criteria mapping.
- **Qian Jiang** — prototype, UX, accessibility and empathy-map consistency.
- **LiHanXia** — tech stack, API/database feasibility, dataset licence and
  storage checks.
- **Benshuai Su** — system architecture, recognition/reference support and
  technical risks.
- **Huang Guan** — PM coordination, decision log, link consistency and final
  cross-file check.

The working plan is recorded in
`actual-project/docs/WORK_ALLOCATION_PLAN.md`. The formal project information,
handover and acceptance-criteria sources were updated locally. A Drive backup
of the previous Team Information Office file was created before replacement:
`TM04 Team Info - before allocation 20260821.docx` (copy ID
`1GntAcAnnO9QhbIFgNGJ0q_UDkTj52HLM`). The original Sample Project PGIE and
Future Features folder were not changed.

Drive inventory checked:

- actual project root: `18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx`;
- Design Thinking: `1GuVQunTtGfwmbHVXSh1ybBSLHtDxwRirWvdV1Fnp9LQ`;
- Confirmed Workflow: `1Nw_yOmg_YNBCfM6viIUeUrIWpktDRcjl8Z_CSyudr3Q`;
- Team Information folder: `1ZhtqRPMHVbObRhna9fAJoaia9R8HWdUm`;
- Team Info Office file: `1lpXD7Yw9fJQ7xt8A5QyQe6UsGQmUcTsi`.

The allocation plan is also available in the actual-project Team Information
folder as Markdown (`1BErKy4-lGgD4hAULGh9ieHfNCiqIcMNR`,
https://drive.google.com/file/d/1BErKy4-lGgD4hAULGh9ieHfNCiqIcMNR/view) and as
an editable DOCX (`1dknwhHNEG-ndhQY-mAKnBeXA_zpWuV4E`,
https://docs.google.com/document/d/1dknwhHNEG-ndhQY-mAKnBeXA_zpWuV4E/edit).
The replaced Team Information file remains at its original ID and was backed up
before the write.

Status: `Current` for the allocation split; Darli's review is `Planned` until
the checked Acceptance Criteria list is returned. Next action: Darli reviews
the criteria, Keith keeps the technical baseline aligned, and Huang records
the final cross-file result.

## Persona allocation update — 21 August 2026

The user clarified that **Qian Jiang owns the Amirah persona**. This is added
to her existing prototype/UX responsibility. Jiang keeps the persona, empathy
map, prototype and user-facing flow consistent, and flags assumptions when the
target user or MVP scope changes. Darli remains responsible for User Acceptance
Criteria review; Keith remains responsible for the requirements baseline.

## Mentor artefact check and latest allocation — 22 August 2026

This entry records the latest read-only Drive audit and the latest Team 04
WhatsApp messages. The mentor is expected to check the PGP folder and project
progress, rather than relying on the presentation alone. Darli listed these
seven priority artefacts:

1. User Journey (Overall)
2. LeanKit: Iteration Planning
3. Iteration 1: Data Management Plan
4. Iteration 1: System Architecture (written document, with diagrams where
   needed)
5. Iteration 1: Security Plan
6. AI Design Plan
7. Iteration 1: User Journey

### Drive status confirmed

The actual-project root checked was
`https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx`.
The following project files or source records were found:

- [Design Thinking](https://docs.google.com/document/d/1GuVQunTtGfwmbHVXSh1ybBSLHtDxwRirWvdV1Fnp9LQ/edit)
- [Radar Sampah Confirmed Workflow](https://docs.google.com/document/d/1Nw_yOmg_YNBCfM6viIUeUrIWpktDRcjl8Z_CSyudr3Q/edit?usp=drivesdk)
- [RadarSampah Data Management Plan](https://docs.google.com/document/d/1YXWiFnHCLmaPlKB5uflM0fvMfqcgKNj77x46CMbb2mk/edit?usp=drivesdk)
- [Radar Sampah Work Allocation Plan (editable)](https://docs.google.com/document/d/1dknwhHNEG-ndhQY-mAKnBeXA_zpWuV4E/edit)
- [Radar Sampah Work Allocation Plan (Markdown)](https://drive.google.com/file/d/1BErKy4-lGgD4hAULGh9ieHfNCiqIcMNR/view)
- [Team Information](https://docs.google.com/document/d/1lpXD7Yw9fJQ7xt8A5QyQe6UsGQmUcTsi/edit)
- [IM Proposal](https://docs.google.com/presentation/d/1DBadsZJZ-GbkpK6Q_ki9PlJAp9vXTBXGMPJknbaEn1A/edit?usp=drivesdk)

No standalone actual-project Drive file was found for the following requested
artefacts in the targeted searches:

- User Journey (Overall)
- Iteration 1: User Journey
- Iteration 1: System Architecture
- Iteration 1: Security Plan
- AI Design Plan
- a standalone E-portfolio evidence record
- a separate actual-project LeanKit board (the existing sample board remains
  unchanged; a new board is deferred)

Per Huang's instruction, missing files are **not being created in this turn**.
They are recorded as gaps for allocation and evidence collection only. The
protected Sample Project PGIE (`1RfEiGPd5_v2Ka5TieeeLSh4-YB0mUjvk`) and its
contents were not edited.

### Latest group messages and mentor feedback

Darli shared the Acceptance Criteria link and asked everyone to review it from
their discipline, discuss changes in the group first, and add evidence or
links. The latest draft deadline in the group message is **1:00 PM on 22
August 2026**, so teammates can review the drafts before the Monday mentor
meeting. Acceptance Criteria link:
`https://docs.google.com/document/d/1bSkgHObjo2YgDuQL5svDMHlCOzlYP9s3/edit`.

The latest feedback recorded in the group is:

- explain the journey as **Find litter -> Upload a photo -> AI classifies it
  -> Calculate severity -> Identify priority areas -> Create or join a
  cleanup event -> Record the outcome**;
- make the roles clear: regular user, organiser and moderator, including who
  can create events, join events and verify reports;
- make the community-cleanup feature visible;
- consider showing volunteers interested in cleaning a particular beach and
  clarify how event creation would work; these points remain open and should be
  marked Planned/Future/TBD unless the team confirms them;
- keep more energy in the presentation and improve the order from Persona,
  user problem and use case to solution and feature screens;
- add a User Journey task because the project has grown and mentors will need
  the journey when reviewing the PGP.

### Latest allocation recorded from the group

- **Huang Guan:** PGP document organisation, E-portfolio evidence and LeanKit
  Iteration Planning.
- **Hnin Darli:** User Journey (Overall), including the cross-feature flow and
  evidence links.
- **LiHanXia:** Iteration 1 Security Plan, with data handling and storage
  checks.
- **Benshuai Su:** Iteration 1 System Architecture and AI Design Plan,
  including diagrams and technical boundaries.
- **Qian Jiang:** Iteration 1 User Journey, keeping it consistent with the
  prototype, persona and UX flow.
- **Keith Junn Chong:** Iteration 1 Data Management Plan.

This is the latest allocation message visible in Team 04. It does not mean the
missing documents already exist; each owner still needs to produce or update
their draft and attach evidence/links. A previous review draft placed
requirements traceability with Keith, but the latest group message assigns him
the Iteration 1 Data Management Plan instead.

### Evidence rule for the next review

Each artefact should identify its owner, current/planned/future status,
evidence or source links, and its relationship to the current project flow.
All files must keep the same boundaries: synthetic/public data only, broad-area
location display, AI as suggestion rather than a final decision, no exact litter
coordinates, and no legal, scientific-validation or enforcement claim.

## LeanKit update blocked by Acceptance Criteria link mismatch — 22 August 2026

Darli's latest Team 04 message shared this Acceptance Criteria link:
`https://docs.google.com/document/d/1bSkgHObjo2YgDuQL5svDMHlCOzlYP9s3/edit`.
The Drive metadata identifies it as `Epics, User Stories.docx`, an Office file
last modified on 10 August 2026. A read-only fetch shows HealthFirst content
(health screening fields, clinical thresholds, Malaysian health statistics and
medical risk claims), not Radar Sampah requirements.

The Drive search also found a file titled `TideTrace MY - Acceptance Criteria`
(`1xPuDXHzfFoLs_g4uBrNU0wKvzYO0kvUOXd1WnwXJGts`), but its current native
document body contains only an empty paragraph. It is not usable as a source
for LeanKit cards.

Because applying either file would mix HealthFirst requirements into the Radar
Sampah board, the LeanKit board
`https://monashie.leankit.com/board/2494590220` was **not modified** in this
check. No card, lane or Future Backlog item was moved or deleted. The next
action is for Darli/the team to confirm the correct current Radar Sampah
Acceptance Criteria link (or update the empty TideTrace file); only then can
the board be updated safely.

## Latest Design Thinking and group check — 23 August 2026

The current [Design Thinking](https://docs.google.com/document/d/1GuVQunTtGfwmbHVXSh1ybBSLHtDxwRirWvdV1Fnp9LQ/edit)
file exists and was modified on 22 August 2026. It has 10 tabs. The latest
content now describes:

- the main audience as Malaysian coastal-cleanup volunteers, with organisers
  and moderators as secondary roles;
- Amirah as the primary persona and four selected central-west Selangor
  beaches for Iteration 1;
- an MVP journey beginning with discovering a beach or cleanup activity,
  joining or creating an activity, manually reporting litter with one-time GPS
  area assistance, correcting the details, submitting for verification,
  viewing severity and biodiversity context, recording cleanup outcomes, and
  viewing points/follow-up;
- manual reporting as the current MVP path. AI category suggestions are listed
  for Iteration 2 and must remain assistive only;
- Iteration 2 for data validation, moderation, scoring analysis and richer
  context; Iteration 3 for recurrence patterns, species cards and an optional
  community leaderboard;
- a seven-phase, 22-step user journey with open decisions about points for
  team cleanups, approval of newly created activities, offline submission,
  post-cleanup severity, account timing and who verifies in the MVP.

The latest Team 04 group messages are consistent with the core flow:

`Discover a beach or activity -> view, join or create a cleanup -> report
litter manually -> correct the information -> submit for verification -> view
beach severity and biodiversity context -> complete the cleanup -> submit
outcomes -> receive points -> monitor follow-up reports.`

The team is still discussing whether verification is performed by everyone or
by named/profiled volunteers in the relevant area. Darli also suggested showing
the number of volunteers interested in a beach or cleanup event and asked that
these details be added as Acceptance Criteria. Event creation, profile timing,
and verifier permissions are therefore still open decisions rather than settled
implementation facts.

The Acceptance Criteria link Darli shared in the same chat remains the earlier
HealthFirst Office document recorded above, so it is not safe to use it as the
current Radar Sampah source. No LeanKit or Drive content was changed during
this check.

## LeanKit Radar Sampah rebuild — 23 August 2026

The LeanKit board was updated from the latest Design Thinking flow and the
team's agreed ownership split:

`https://monashie.leankit.com/board/2494590220`

The active Radar Sampah set now has unique cards for **8 Epics, 25 User
Stories and 76 Acceptance Criteria**. The story priorities are **15 Must, 6
Should and 4 Could**. Card titles include the owner, priority and iteration so
that the allocation is visible even in the compact board list:

- Jiang: Epic 1-2 reporting/activity work and related UI cards;
- Darli: US1.3, US3.3, Epic 4, data freshness and severity map work;
- Su: US2.3, Epic 5, AI suggestion, biodiversity/source and technical-risk
  work;
- LiHanXia: Epic 3, US3.1-3.2, Epic 7, review status and recurrence work;
- Huang: Epic 6, cleanup evidence/outcomes, PGP and integration checks;
- Keith: Epic 8, contribution history, points/badge/leaderboard and DMP /
  traceability checks.

The flow represented on the cards is:

`Discover beach/activity -> join or create cleanup -> manual litter report ->
correct information -> submit for verification -> view severity and
biodiversity -> complete cleanup -> submit outcomes -> receive points ->
monitor follow-up.`

All new cards remain work items rather than completion claims. The new cards
were created in the existing backlog lane; the intended iteration and
Must/Should/Could status are carried in each title. No card was moved to DONE
or ACCEPTED based only on this rebuild. The board search returned 119 cards,
including a small number of earlier duplicate/test cards, while the required
Radar Sampah IDs are all present uniquely (8/25/76). Test cards that were
identifiable were moved to `ARCHIVED`. The old HealthFirst cards still need a
separate, deliberate archive pass because the current LeanKit search/list UI
does not provide a safe bulk archive action; they were not deleted.

`FUTURE BACKLOG - Document/Other` was not opened, moved, edited or deleted.
No Sample Project PGIE or local HealthFirst reference files were changed.

Evidence note: this update was verified through the board's search results on
23 August 2026. The counts and ownership are planning evidence, not evidence
that the underlying features are already implemented in code.

## Confirmed removal of old HealthFirst cards — 23 August 2026

After the PM confirmed the exact deletion scope, the 39 cards returned by the
LeanKit search term `health` were permanently deleted. These were the old
Health/HealthFirst sample cards in the `ARCHIVED` lane. This was a deliberate
irreversible cleanup, not a move or a bulk change to active work.

Verification after deletion:

- Search term `health`: **0 cards returned**.
- Radar Sampah cards remain searchable; for example, the `E1 | ... | Owner:
  Jiang | Must | I1` cards are still present in `EPIC BACKLOG`.
- `FUTURE BACKLOG - Document/Other` was not edited, moved or deleted.
- No Sample Project PGIE or local HealthFirst reference files were changed.

The cleanup report covers the confirmed 39-card Health/HealthFirst set only;
it is not a claim that every unrelated historical sample card on the board has
been removed.

## LeanKit owner balance check — 23 August 2026

A fresh LeanKit search of the current board used the owner markers in the
Radar Sampah card titles. The results were: Keith 15, Jiang 21, Darli 22, Su
25, LiHanXia 26 and Huang 20. These are search matches and include the small
set of duplicate planning cards already noted in the board evidence, so they
are not a clean unique-card total.

Keith therefore is **not** responsible for most of the current cards; his
visible allocation is the smallest of the six owner groups. No reassignment
was made in this check.

## Correction: LeanKit assignee field versus title owner — 23 August 2026

The previous owner-balance check searched the text `Owner: ...` in card titles.
That is only planning metadata, not LeanKit's real Assigned Members field.
The current Board List view shows a different situation: many cards such as
`US3.1-AC1`, `US3.2-AC1` to `US3.2-AC5`, and `US3.3-AC1` onward display
**Junn Keith Chong** in the Assigned Members column, while some newer cards
only show an `Owner: ...` marker in the title and have no matching assignee
pill.

In the currently rendered list snapshot, 30 of 36 visible row entries showed
Junn Keith Chong. This is not a full-board total because the list is virtualised,
but it confirms the user's manual observation: the actual LeanKit assignment
fields were not updated to match the title-based allocation. The earlier
15/21/22/25/26/20 search counts must therefore not be used as actual assignee
counts. A separate reassignment pass is required; no reassignment was made in
this read-only check.

## LeanKit Assigned Members correction — 23 August 2026

The PM then started the authorised Assigned Members correction in the Board List
view. The target mapping used for active Radar Sampah owner-marked cards is:

- Jiang -> Qian Jiang (reporting and first-step activity flow)
- Darli -> Hnin Darli Myint Myat (data sufficiency, freshness and area context)
- Su -> Benshuai Su (AI suggestion, biodiversity and reference support)
- LiHanXia -> Hanxia Li (review status, duplicate/data quality and recurrence)
- Huang -> Guan Huang (cleanup evidence, outcomes, integration and PM checks)
- Keith -> Junn Keith Chong (contribution history, points and badges)

The reachable owner-marked AC and User Story cards were synchronised to the
matching team member, including I1 reporting/review cards, I2 area and
biodiversity cards, and I3 recurrence/contribution cards. The list is virtualised
and contains duplicate planning cards. Several duplicate top-level Epic rows
still have a blank Assigned Members cell because their action menu did not stay
open reliably; those rows need a short manual follow-up in the card detail
editor. This entry therefore does not claim that every card has been replaced.
Cards without an explicit current `Owner:` marker, old sample/legacy cards, and
the `FUTURE BACKLOG - Document/Other` lane were not automatically reassigned.

No Sample Project PGIE or local reference files were changed. This assignment
pass changes ownership metadata only; it does not mark any feature as built or
tested.

## Follow-up: duplicate top-level Epics — 23 August 2026

The remaining visible duplicate active Epic rows with blank Assigned Members
were filled in the LeanKit list view:

- E3 — Uncertainty About Whether Community Reports Are Reliable and Comparable
  -> Hanxia Li;
- E4 — Difficulty Knowing Which Beaches Need Attention -> Hnin Darli Myint
  Myat;
- E5 — Difficulty Understanding How Litter Relates to Marine Biodiversity
  -> Benshuai Su;
- E6 — Lack of Clear Feedback After a Cleanup -> Guan Huang;
- E7 — No Way to Know Whether Litter Returns -> Hanxia Li;
- E8 — Motivation Fades When Contributions Are Not Visible -> Junn Keith
  Chong.

E1 and E2 duplicate rows already showed Qian Jiang and were left unchanged.
The archived `E3 | TEST EPIC NEW` card was not touched. The Future Backlog lane,
Sample Project PGIE and local reference files remain unchanged. This follow-up
only corrects the LeanKit Assigned Members field; it does not change card
status, scope or implementation evidence.

## PGP index and Iteration Planning execution — 23 August 2026

Huang Guan's current responsibilities are limited to PGP document organisation
and LeanKit Iteration Planning. Other assigned documents are not being authored
by Huang in this pass.

### PGP index

Created the actual-project root document:

- `Radar Sampah — PGP Index & Evidence Register`
- https://docs.google.com/document/d/1K2-eYEWMW_Vy6uWmNRxGCD_nDYX6IKwrFaWIufqxciU/edit?usp=drivesdk
- Drive ID: `1K2-eYEWMW_Vy6uWmNRxGCD_nDYX6IKwrFaWIufqxciU`

The index contains the seven mentor-priority files, the PGP folder map, project
links, evidence/status fields, decision states and current gaps. It records
that the DMP has two candidate files, the Iteration 1 User Journey exists,
System Architecture currently has only the older SVG, Security/Testing/
Iteration Build/Risks/Retrospective folders are empty, and the other named
documents remain with their assigned owners. It also records the course AI-use
requirement and does not present AI-assisted wording as unacknowledged student
work.

No existing Drive file was moved, renamed or overwritten. The Sample Project
PGIE remains outside the scope.

### Planning source and decisions

The source order for this pass is: latest explicit group decisions, the latest
Design Thinking document (revision
`AIroW36yJIsOJR5CQy_Mk0j2swHhr-nQMIrsdSr1piB7yo2aTSJdQfNqYll6567Arz9BPapPmkUs7BmxZajEgxR1swr8HcwH5CynmJLQ9rU`), Confirmed Workflow, then existing Drive/runtime evidence. The latest Design Thinking iteration tab keeps manual reporting in Iteration 1, AI suggestion in Iteration 2, and longer-term recurrence/leaderboard work in Iteration 3.

The latest group discussion supports offline draft/resume as the working
direction. Attendance verification, duplicate-event criteria, immediate
publication of new activities, cleanup evidence requirements and the temporary
pre-moderator status remain `Pending Team Decision`; they are not silently
treated as final acceptance criteria.

### LeanKit planning update scope

The intended planning mapping is 25 Stories and 76 AC:

- I1 (24 Aug–3 Sep 2026): US1.1–US1.3, US2.1–US2.2, US3.1–US3.2,
  US4.1–US4.2, US5.1–US5.2, US6.1–US6.2, US7.1–US7.2 and US8.1, with the
  initial fixed-score work tracked as an I1 slice of US4.3.
- I2: US2.3, US3.3, US4.3, US5.3, US6.3 and US8.2.
- I3: US5.4, US7.3 and US8.3.

The current LeanKit list showed the required Epics and ACs, but most Planning
increments were blank and several title-only I1/I2/I3 labels were stale. The
active-card planning pass was attempted without changing Assigned Members
or the Future Backlog. The LeanKit UI rejected the date-field format and its
Agile Planning controls were disabled, so zero Planning increments or dates
were written. No feature was marked complete without implementation or test
evidence.

## 23 August 2026 LeanKit read-only findings before write

Before the planning update, the list showed 8 formal Epics and 76 ACs. The
active Story cards were represented through the E/US planning set, while most
AC Planning increments were empty. Four old sample ACs and several TEST/
duplicate cards were still visible. They were not deleted or moved in this
pass. Any future permanent deletion requires a separate confirmation and a
saved card-ID list first. `FUTURE BACKLOG - DOCUMENT/OTHER` was not touched.

## 23 August 2026 LeanKit write outcome

The authorised light planning pass was checked again on the actual Team 04
board. It changed **0 cards**: no Planning increment, planned date, status,
owner or card text was overwritten. The board still displayed `No Planning
Increment`, and the Agile Planning control was disabled; a date entry attempt
failed validation and was immediately refreshed. Therefore the requested
Iteration 1/2/3 mapping remains a documented plan, not a claim that LeanKit
accepted it. Assigned Members were not changed in this pass.

The board still contains the previously recorded old sample/test residuals.
They were not deleted or moved because deletion needs a separate action-time
confirmation. The Future Backlog lane was not touched. The next safe action is
to ask a board administrator to enable Agile Planning (or provide the correct
date format/permission), then apply the mapping in a short reversible pass.

## 23 August 2026 LeanKit title-marker fallback

Because the account cannot use the native Planning increment field, a
reversible visible workaround was applied to editable active-card titles. The
suffixes now show `I1 | 24 Aug-3 Sep 2026 | Planned`, `I2 | Date TBD | Planned`,
or `I3 | Date TBD | Future/TBD`. Card status, lane, owner field and card body
were not changed.

The final scan found **8 Epics, 25 Stories and 76 Acceptance Criteria** with
iteration markers. The mapping is:

- I1: US1.1-1.3, US2.1-2.2, US3.1-3.2, US4.1-4.2, US5.1-5.2, US6.1-6.2,
  US7.1-7.2 and US8.1;
- I2: US2.3, US3.3, US4.3, US5.3, US6.3 and US8.2;
- I3: US5.4, US7.3 and US8.3.

US4.3 is marked with an I1 fixed-score prototype slice. AC6.3.3 is marked
as an I1 exception for `cleanup recorded — awaiting follow-up`. The observed
counts were 67 I1 markers, 26 I2 markers and 15 I3 markers across the 109
structured Epic/Story/AC titles. `FUTURE BACKLOG - DOCUMENT/OTHER` was not
opened or changed. The old sample/test residuals were not deleted.

Evidence screenshots were saved locally before and after the title-marker
pass:

- `realwork/leanKit_iteration_before.png`
- `realwork/leanKit_iteration_after.png`

The PGP Index was updated with the same fallback convention and mapping. This
title-based record is a temporary substitute for native Agile Planning, not a
claim that the administrator-only fields are enabled.

## PGP and requirements correction — 23 August 2026

Source: latest Design Thinking revision, current Team Information file and the
latest Team 04 discussion. This entry supersedes the earlier derivative notes
that used 18 stories or an older 19-story baseline. The Design Thinking source
itself was not changed.

- Current requirements are **8 Epics, 25 User Stories and 76 Acceptance
  Criteria**: 15 Must, 6 Should and 4 Could. Derivative story lists and PGP
  summaries must use this count.
- `AC6.3.3 — Cleanup recorded — awaiting follow-up` is now formally part of
  **MVP / Iteration 1** under the Epic 6 / US6.2 outcome path. It should not
  remain an Iteration 2-only item or appear as a duplicate under US6.3.
- YOLO and a public dataset route are allowed in principle, subject to source
  and licence checks. TACO is the current named public dataset candidate and
  is recorded as CC BY 4.0. A project-specific model still needs retraining or
  fine-tuning; no trained model is claimed until training, class mapping,
  evaluation and limitation evidence are attached.
- No explicit Kaggle dataset link was confirmed. An unidentified Kaggle file
  is not treated as a project fact. Keep the exact URL, licence/attribution,
  split, configuration, metrics and sample predictions as evidence before
  presenting recognition as more than a suggestion.
- The current Social Contract target is `TM04 Social Contract.docx` (Drive ID
  `1kbD7Z9hN_PXrC8y7ZIsxXVnrR80miu7R`). Its HealthFirst-specific project title,
  medical scope and examples are being removed while the governance and
  sign-off structure is retained. The replacement scope is Radar Sampah,
  synthetic/public data, broad-area locations, manual reporting first and
  non-enforcement wording.

PGP Index updated in place: https://docs.google.com/document/d/1K2-eYEWMW_Vy6uWmNRxGCD_nDYX6IKwrFaWIufqxciU/edit
Design Thinking source: https://docs.google.com/document/d/1GuVQunTtGfwmbHVXSh1ybBSLHtDxwRirWvdV1Fnp9LQ/edit
Current Team Information: https://drive.google.com/file/d/1lpXD7Yw9fJQ7xt8A5QyQe6UsGQmUcTsi/view

Status: PGP traceability update completed. Remaining evidence work belongs to
the requirements/data-management owner and recognition owner: update the
derivative story list, attach TACO/licence evidence, and record retraining and
evaluation results. Social Contract content cleanup is a separate document
update and is not claimed complete by this entry.

## Canonical acceptance-criteria refresh — 23 August 2026

The Drive Acceptance Criteria document was rebuilt from the latest Design
Thinking tab and re-read after writing. It now contains all **76 AC headings**
for the 25 stories (15 Must / 6 Should / 4 Could). `AC6.3.3 — Show Follow-Up
Status` is explicitly grouped under US6.2 as an MVP / Iteration 1 exception,
with the wording `Cleanup recorded — awaiting follow-up`; it is not duplicated
under US6.3. The Design Thinking source remains unchanged.

Canonical Drive file: https://docs.google.com/document/d/1xPuDXHzfFoLs_g4uBrNU0wKvzYO0kvUOXd1WnwXJGts/edit
The local acceptance-criteria Markdown is intentionally a compact
cross-reference to this canonical 76-criterion file.

The Radar Sampah Social Contract was also updated in place at Drive ID
`1kbD7Z9hN_PXrC8y7ZIsxXVnrR80miu7R`; a local Markdown/DOCX backup was kept and
the rendered two-page copy was checked. HealthFirst and other medical wording
is removed from the active contract. YOLO/TACO use remains conditional on
licence records, retraining/fine-tuning and evaluation evidence; no trained
project detector is claimed.

## LeanKit MVP follow-up marker — 23 August 2026

The latest Design Thinking decision moves `AC6.3.3 — Cleanup recorded —
awaiting follow-up` into MVP / Iteration 1. The LeanKit board does not expose
native Agile Planning fields for this account, so the visible card title is
used as a planning marker:

`AC6.3.3 | Cleanup recorded — awaiting follow-up | Owner: Huang | Must | MVP / I1 | Planned`

The card was confirmed by LeanKit search on 23 August 2026. A same-session
duplicate created during verification was removed. The older
`AC6.3.3 | Show Follow-Up Status` card was renamed with a `SUPERSEDED` prefix
so it remains traceable without competing with the MVP card. No other old
cards were deleted or changed, and `FUTURE BACKLOG - DOCUMENT/OTHER` was not
modified. The board still contains residual sample cards outside this focused
update; they were left in place because this request was limited to the MVP
marker correction.

## Legacy HealthFirst card cleanup — 23 August 2026

The user explicitly authorised deletion of old-version cards. I removed the
identified HealthFirst/sample cards from the LeanKit board:

- `[Iteration 1] AC 2.2.3. Prevent False Personalization of Population Statistics`
- `[Iteration 1] AC 3.1.5. Display Evidence for Preventive Guidance`
- `[Iteration 1] AC 3.2.3. Explain Why Follow-Up May Be Appropriate`
- `[Iteration 1] AC 3.2.5. Prevent Unsupported Urgency or Diagnosis`
- `[Epic 3] Uncertainty of Prioritized Preventive Action`
- `[Design Artefacts] Persona (Mr Lim Wei Jian)`
- `[Design Artefacts] Empathy Map`

Search verification returned 0 cards for `HealthFirst`, `Personalization`,
`Preventive Guidance`, `Unsupported Urgency`, `Explain Why Follow-Up`,
`Uncertainty of Prioritized`, `Mr Lim Wei Jian` and `Design Artefacts`.
Radar Sampah cards and `FUTURE BACKLOG - DOCUMENT/OTHER` were not targeted.
Other generic archived/test cards may still exist and need separate review if
the team wants a full archive purge; they were not assumed to be HealthFirst
without a clear title match.

## Generic archived/test card cleanup — 23 August 2026

Following the user's explicit instruction, the following cards from the
previous review list were deleted because they were in `ARCHIVED` and had
generic test/sample titles:

- `TEST MANUAL EPIC`
- `TEST RISK5`
- `Cards failed to pass acceptance test`
- `Cards which are completed ready for acceptance test by mentors`
- `TEST MANUAL CARD`
- `TEST RISK3`
- `TEST LANE`
- `TEST SIMPLE ABC`
- `E3 | TEST EPIC NEW | Owner: LiHanXia | Must | I1`
- `[Iteration 1] Integration & Acceptance Testing`

Post-cleanup search for `TEST` returned only `TEST ACTUAL E1` in `EPIC
BACKLOG` plus the two protected Future Backlog reflection cards. Those three
were not deleted. Other archived cards with project or evidence wording were
left untouched because they were not part of the confirmed generic-test list.

## Team Information LeanKit link — 23 August 2026

Updated the actual-project `TM04 Team Info.docx` in place (Drive file ID
`1lpXD7Yw9fJQ7xt8A5QyQe6UsGQmUcTsi`) and added the current LeanKit board link:

`https://monashie.leankit.com/board/2494590220`

The original DOCX was backed up before the write at
`realwork/backups/teaminfo/TM04 Team Info.original2.docx`. The updated local
artifact is `realwork/backups/teaminfo/TM04 Team Info.updated.docx` and was
rendered to PNG/PDF for visual checking. The Drive file ID, title and actual
project parent folder were preserved. A Drive readback confirmed the LeanKit
URL is present. Sample Project PGIE was not touched.

## Social Contract cleanup — 23 August 2026

Updated the newly uploaded actual-project Social Contract (Drive file ID
`1kbD7Z9hN_PXrC8y7ZIsxXVnrR80miu7R`) in place. HealthFirst project title,
health-risk shared goal, old LLM/chatbot role wording and the example sign-off
sentence were replaced with Radar Sampah project details and the current team
responsibility split. The original file was backed up at
`realwork/backups/socialcontract/Social Contract.original.docx`; the updated
artifact is `realwork/backups/socialcontract/Social Contract.updated.docx`.
The original table structure, section order, values, working rules, conflict
path and signature layout were preserved. LibreOffice rendering produced five
pages with no visible overflow, and Drive readback confirmed `Radar Sampah` is
present while `HealthFirst`, `physical examination` and `LLM chatbox` are absent.

## PGP compliance audit and evidence placeholders — 24 August 2026

Implemented the light version of the actual-project Drive/PGP compliance plan
against the root folder:

`https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx`

Protected scope was not changed: Sample Project PGIE, Future Features and
historical/archive material were not moved, renamed, deleted or edited.

Added or documented:

- Created `Usability Testing Video` and added a checklist for the required
  10–15 approved Iteration 1 videos and LeanKit findings. No videos were
  invented.
- Added Iteration Build, Testing, Security, Retrospective and Risk evidence
  registers. They are explicitly Pending or Draft until the responsible team
  member supplies evidence.
- Added Product, Support and Maintenance handover drafts, each labelled Draft /
  Pending team review.
- Added a Design Evidence Register for the missing User Story Map, Customer
  Journey Map, Ethic Canvas, Conceptual ERD, Site Map and independent prototype.
- Added a draft written System Architecture Evidence Note for Su review.
- Added a Data Governance Audit Note recommending
  `RadarSampah_Data_Management_Plan_Iteration1_MVP` as the canonical Iteration 1
  candidate. Keith must still confirm it and complete source URLs, licences,
  access frequency, use, cleaning, validation and privacy details.
- Updated the PGP Index in place with the audit date, links, current status and
  remaining evidence gaps. The stale Social Contract link was corrected to
  Drive ID `1kbD7Z9hN_PXrC8y7ZIsxXVnrR80miu7R`.

Honest status: the Drive now has a traceable place for each IE category, but it
is not fully compliant yet. Individual member photos, clearly labelled team
activity photos, 10–15 usability videos per iteration, formal security/testing
evidence, mentor communications, retrospective records and owner-approved
handover documents are still open. No passwords, API keys, personal identity
data, exact sensitive litter coordinates, trained YOLO model or penetration-test
result was fabricated.

Additional audit checklists were added for Team Information, Team Meeting and
Industry Mentor Communications. They record the missing evidence and next
actions only; they do not claim that photos, meetings or mentor communications
exist when they were not found.

## LeanKit read-only audit — 24 August 2026

The actual board was opened in list view at
`https://monashie.leankit.com/board/2494590220/list` and checked without edits.
The visible list currently contains **24 cards**, all acceptance-criteria cards
from AC1.1.1 through AC3.2.2:

- Jiang: 12 visible cards
- Darli: 3 visible cards
- Su: 4 visible cards
- LiHanXia: 5 visible cards
- Huang and Keith: no visible cards in this current list view

The visible cards show `Other Work`, `Not Started`, `Normal`, `Planned`, and the
I1/I2 title markers. The current view does not show top-level Epic or User Story
cards, so this read-only check cannot confirm the full 8 Epic / 25 Story / 76 AC
board structure. `Agile Planning` is still disabled for this account, so native
planning-increment fields remain unavailable.

This is a status observation, not a request to modify the board. The project is
still in discussion before MVP implementation, so `Not Started` is expected.

## Iteration 1 Security Plan draft — 24 August 2026

Created the native Drive document **Radar Sampah — Iteration 1 Security Plan
(Draft)** and placed it in the actual project's `Security Aspects` folder:

`https://docs.google.com/document/d/1at24QKE7sM6So1C9Z4_wwThUzZnigwLOQFjvJ3APXd8/edit`

The draft is owned by **LiHanXia** for review and is marked pending team
confirmation. It records the current Radar Sampah boundary, broad-area and
GPS privacy rules, manual/suggestion recognition boundary, moderator review
risks, data and secret handling, storage risks, pre-MVP checks and known
limitations. It does **not** claim authentication, RBAC/MFA, encryption at
rest, penetration testing, trained-model security, a completed moderator
dashboard or production privacy compliance. No password, API key or other
secret was added. This update did not modify code, deployment, Sample Project
PGIE or Future Features.

## Handover documents — product, support and maintenance

The three existing Handover documents in the actual-project Drive folder were
updated in English using the current Radar Sampah direction:

- Product Document — current problem, volunteer flow, Iteration 1 focus,
  Current/Planned/Future boundary, data limits and project links.
- Support Document — demo steps, status meanings, common problems, evidence
  to record and safe fallback behaviour.
- Maintenance Document — change checks, source/data maintenance, API/storage,
  recognition boundary, deployment rollback, security reminders and ownership.

All three remain working drafts pending team review. They do not claim that
moderator workflow, full organiser tools, recurrence, points, authentication,
or production security are complete. Existing file IDs and folder placement
were kept; no Sample Project PGIE or Future Features content was changed.

## LeanKit rebuild from latest Iteration Planning — 24 August 2026

Source of truth: the latest Design Thinking Iteration Planning tab and the
team's confirmed scope discussion:
`https://docs.google.com/document/d/1GuVQunTtGfwmbHVXSh1ybBSLHtDxwRirWvdV1Fnp9LQ/edit?tab=t.svrpm2lc1a#heading=h.hq9khitrxq0`.

The actual-project LeanKit board was reorganised at:
`https://monashie.leankit.com/board/2494590220`.

Current canonical structure:

- 8 Epics, 25 User Stories and 77 Acceptance Criteria;
- card colours follow the onboarding board convention: orange Epic, blue User
  Story, green Acceptance Criteria and purple Document/Other;
- Iteration 1 dates remain `24 Aug–3 Sep 2026`;
- Iteration 1 now contains Epic 2, Epic 4 and Epic 5 only;
- the active I1 slice contains US2.1–US2.2, US4.1–US4.3 and US5.1–US5.2,
  together with their 21 Acceptance Criteria;
- activity discovery/participation, verification/reliability and cleanup
  outcome work is planned for Iteration 2;
- AI suggestion (`US2.3`) is Iteration 2 and is not part of the manual I1 path;
- recurrence, quizzes/species cards and contribution recognition remain
  Iteration 3 / Future-TBD;
- the attendance requirement was added as `AC1.2.4 — Confirm Attendance on the
  Activity Date` in Iteration 2;
- Keith remains owner of Epic 8 only and is not assigned most of the board.

The three I1 Epic cards are in `EPIC IN PROGRESS`. Their Story and AC cards are
in the corresponding `TO DO THIS Iteration` sub-lanes. I2/I3 cards remain in
`EPIC BACKLOG`; no unfinished card was moved to Done. Eight superseded Epic
cards, 113 old-format `USx.x:` / `USx.x-ACx:` cards, duplicate/test Epic cards
and a small number of exact duplicates were moved to `ARCHIVED` rather than
presented as current requirements. `FUTURE BACKLOG -Document/Other` and its
reflection cards were not modified.

Visual verification was completed in board view at 75% zoom. The final board
shows the intended four-colour visual hierarchy and the new I1/I2/I3 split.

## LeanKit Iteration 1 display clarification — 24 August 2026

The live board was checked again after a question that Iteration 1 appeared
empty. The current board does contain the planned I1 slice: 3 Epic cards
(E2, E4 and E5), 7 User Story cards (US2.1, US2.2, US4.1–US4.3 and
US5.1–US5.2), and 21 Acceptance Criteria cards. All are marked `Planned` and
dated `24 Aug–3 Sep 2026`.

At the time of this earlier check, LeanKit used status/type lanes rather than
one standalone iteration lane: I1 Epics were under `EPIC IN PROGRESS`, with
Stories and ACs under `TO DO THIS Iteration`. This layout was subsequently
superseded by the sample-board alignment recorded below. The card titles still
keep their Planned status because implementation evidence is not available.

## LeanKit layout aligned with sample board — 24 August 2026

Following Huang Guan's explicit instruction to copy the sample-board layout,
all 31 current I1 cards were moved into the existing
`DONE → Iteration 1 → EP/US/AC` lane. This includes 3 Epics, 7 User Stories
and 21 Acceptance Criteria. Card colours remain orange, blue and green for
the three card types. The card titles still retain `Planned` and the I1 date
range so the board does not claim implementation evidence that does not yet
exist; the `DONE` location is a visual grouping choice requested to match the
sample board. The `FUTURE BACKLOG -Document/Other` lane was not changed.

Post-change screenshot:
`realwork/leanKit_iteration1_done_layout.png`.

## LeanKit Iteration 1 document cards added — 24 August 2026

Following Huang Guan's request to populate the empty `DOC&Others` area, the
six existing Iteration 1 Document/Other cards were moved into
`DONE → Iteration 1 → DOC&Others`:

- Tech stack and API/database feasibility
- Dataset licence and storage checks
- System architecture and code quality
- Data analysis, sources and visualisation
- Frontend flow and accessibility
- PM integration, deployment and evidence checks

No card was deleted or created. `EP/US/AC`, I2/I3 planning cards and
`FUTURE BACKLOG -Document/Other` were left unchanged. The cards still say
`Planned`; the Done lane is used as a visual Iteration 1 grouping to match the
sample-board layout, not as evidence that the work is complete.

## LeanKit status-lane discussion — 24 August 2026

We reviewed whether the current `Doing` and `Review by Mentors` areas should
be populated to look more like the sample MVP board. The proposed change was
to move the six Iteration 1 document cards from
`DONE → Iteration 1 → DOC&Others` to `Doing → Document/Other`, and to place
existing design and draft evidence in `Review by Mentors`.

Huang Guan decided to keep the current layout for now. No cards were moved in
this discussion. The current board therefore remains a visual MVP grouping:
the I1 EP/US/AC cards and six document cards stay under `DONE → Iteration 1`,
while `Doing` and `Review by Mentors` remain reserved for work with clearer
active-work or mentor-review evidence. This is a temporary layout decision,
not a claim that all I1 cards or documents are finished.

## LeanKit completed document evidence expanded — 24 August 2026

Huang Guan asked to add project documents that already have a current, usable
evidence source to `DONE → Iteration 1 → DOC&Others`, while keeping draft and
pending work out of the completed group. The following cards are now present in
that document lane:

- `Design Thinking — Latest Radar Sampah` — current Google Doc source;
- `Confirmed Workflow — Radar Sampah` — agreed flow and boundary notes;
- `IM Proposal — Radar Sampah` — current proposal deck;
- `PGP Index & Evidence Register` — current project index and evidence map;
- `Team Information — Radar Sampah` — team links and access notes;
- `Social Contract — Radar Sampah` — current Radar Sampah team agreement;
- `Empathy Map & Persona — Radar Sampah` — current Amirah/Miro evidence.

The six earlier Iteration 1 document cards remain in the same lane. Existing
`Iteration Planning` and `OB Project Discovery Presentation` cards were not
rewritten. Security Plan, Data Management Plan, Handover and other files that
are still draft, pending review or evidence gaps were not added as completed.

During this update two accidental duplicate `IM Proposal — Radar Sampah`
cards were moved to `ARCHIVED` rather than deleted. The Documentation card was
kept and placed in the Iteration 1 document lane. `FUTURE BACKLOG
-Document/Other`, the protected Sample Project and historical materials were
not changed. The board is still a planning/evidence view: a card in the Done
document lane means the linked document exists for this grouping, not that the
related product feature is implemented.

Verification: LeanKit list view was checked after creation and showed each of
the seven added titles. Linked sources were kept on the cards where the card
form accepted an external link. No passwords, API keys or other secrets were
added.

## LeanKit document-card ownership update — 24 August 2026

Huang Guan confirmed that the `PGP Index & Evidence Register` card had been
deleted and should not be recreated. A quick list-view scan found no remaining
card with that title.

The six current document cards added in the previous update now have these
assigned members:

- `Social Contract — Radar Sampah` — Guan Huang;
- `Team Information — Radar Sampah` — Guan Huang;
- `Design Thinking — Latest Radar Sampah` — Hnin Darli Myint Myat and Junn
  Keith Chong;
- `IM Proposal — Radar Sampah` — Hnin Darli Myint Myat and Junn Keith Chong,
  with the existing Huang co-owner retained as PM support;
- `Confirmed Workflow — Radar Sampah` — Hnin Darli Myint Myat and Junn Keith
  Chong;
- `Empathy Map & Persona — Radar Sampah` — Qian Jiang.

The duplicate archived versions of IM Proposal and Design Thinking remain
recoverable in `ARCHIVED`; the active document cards above are the ones to use
for current work. This update changed card ownership only and did not alter
the protected Future Backlog or Sample Project.

## LeanKit hierarchy metadata update — 24 August 2026

The current Radar Sampah cards were given a clearer hierarchy to match the
sample-board pattern. This is metadata only; it does not claim that planned
work is finished.

- Current Epic cards use headers `Iteration 1 · Epic`, `Iteration 2 · Epic` or
  `Iteration 3 · Epic`.
- Current User Story cards use the matching `Iteration n · User Story` header.
- Current Acceptance Criteria cards use the matching
  `Iteration n · Acceptance Criteria` header.
- Current project-document cards use `Iteration 1 · Evidence` where the card
  represents an evidence or governance document.
- Parent convention: `USx.y` is a child of `Ex`; `ACx.y.z` is a child of
  `USx.y`. The Parent Card field was saved for the current hierarchy. A
  sample check showed `AC2.2.1` under `US2.2`, and `US1.1` under its Epic.
- Two earlier parent retries (`US2.2` and `US4.2`) were repaired and checked in
  the list view. No unresolved current story parent remains in the retry list.

The card set still contains the agreed Radar Sampah Epics, Stories and ACs;
old HealthFirst/Risk-Issue sample cards were not edited in this metadata pass.
The deleted `PGP Index & Evidence Register` card was not recreated. The
Future Backlog, archived cards, historical materials and Sample Project PGIE
were not changed.

## Latest Design Thinking / LeanKit alignment — 25 August 2026

The LeanKit board was checked against the latest Design Thinking and the
confirmed Radar Sampah workflow. The agreed structure remains 8 Epics, 25
User Stories and 76 Acceptance Criteria. The iteration split used on the
board is now:

- Iteration 1: report and review foundations, the first area/severity view,
  biodiversity context and the minimum peer-validation path;
- Iteration 2: cleanup outcomes, AI suggestion, extended verification and
  follow-up context;
- Iteration 3: longer-term recurrence, collection/recognition and community
  contribution features.

`AC6.3.3 | Cleanup recorded — awaiting follow-up` was explicitly moved out of
MVP. Its card now reads `I2 | Date TBD | Planned` and its header is
`Iteration 2 · Acceptance Criteria`. It remains a child of US6.3. No MVP label
remains on the saved card.

The following hierarchy and planning corrections were applied:

- `US3.1`, `US3.2`, `AC3.1.1–AC3.1.3` and `AC3.2.1–AC3.2.3` now use Iteration 1
  dates (24 Aug–3 Sep 2026) and the matching story/AC headers;
- cross-iteration Epic metadata was corrected for E1 (`I1–I2`), E2
  (`I1–I2`), E3 (`I1–I2`) and E5 (`I1–I3`);
- E4 and E6 use their Iteration 1/2 headers, and E7/E8 use
  `Iteration 3 · Epic`;
- US5.3 and US5.4 now point to the current E5 (`I1–I3`) parent rather than
  the older archived E5 copy;
- the Confirmed Workflow evidence card is now titled
  `Confirmed Workflow — Radar Sampah` and uses `Iteration 1 · Evidence`;
- short dependency notes were added to US2.1, US3.1, US3.2 and US4.1 for
  registered accounts, peer validation, duplicate checks and broad-area map
  display.

The active E1 card and its archived E1 copy still create a LeanKit parent
selector limitation: the US1.1/US1.2/US1.3 editor currently exposes the old
Iteration 1 E1 option, while the current E1 card carries the corrected
`I1–I2` metadata. I did not link current stories to an archived card merely to
hide this conflict. This remains a small board-cleanup item for the team to
resolve by removing or merging the duplicate E1 card with permission.

The board still does not claim implementation evidence for planned work.
`AC6.3.3` and other Iteration 2/3 work remain planned/future. Future Backlog,
protected Sample Project material and historical archive cards were not
modified. The LeanKit page was refreshed after saving the changes, and the
key card text/header values were re-read from the live board.

## 2026-08-25 — MVP allocation discussion (LeanKit not updated)

- Latest Team 04 discussion suggested removing Epic 3 from the MVP and keeping
  the Iteration 1 reporting path manual; AI category suggestions remain in
  Iteration 2.
- The team also discussed a probability-scoring / ML-model direction under
  Epic 5. This is a proposal for team review, not an implementation claim.
- Proposed ownership shared in Team 04 chat:
  - Jiang: manual litter reporting and correction flow (US2.1–US2.2)
  - Darli: beach-attention and severity-map work (US4.1–US4.2)
  - Su: biodiversity context and probability-scoring prototype discussion
  - LiHanXia: verification states, duplicate/rejected handling and location
    privacy
  - Keith: DMP, data dictionary, licence/storage and story–AC traceability
  - Huang: PM integration, frontend/backend coordination, LeanKit and smoke
    testing
- `US4.3` remains an Iteration 1 non-blocking stretch task, as previously
  agreed with Huang.
- Login/profile storage is still unresolved. The group was asked to decide
  between real login records and an anonymous synthetic ID; no real personal
  data is to be assumed.
- A group notification was sent for review at 13:55. No LeanKit cards were
  changed after this notification; updates will wait for team feedback.

## Radar Sampah repository and ePortfolio update - 25 August 2026

- The active GitHub repository is now `huangguan-giegie/radar_sampah` (private,
  `main`). The local remote and active project links use the new slug.
- The focused brand update was pushed as commit `a53b819`.
- The active frontend source now displays Radar Sampah and keeps the old API
  variable name only as a compatibility fallback. `render.yaml` defines the
  target service names `radar-sampah-api` and `radar-sampah-frontend`.
- Render dashboard access was not available in the current browser session.
  The current stable services remain `team04-marine-observation-frontend.onrender.com`
  and `team04-marine-observation-api.onrender.com`; both were checked after the
  push. The new target hostnames returned 404, so they are not claimed as live.
  The old services are kept as the rollback path until an owner can rename or
  create the new Render services.
- `TM04 Team Info &links.docx` was updated in place. It keeps the original file
  ID and format, uses the new GitHub link, and points to the currently live
  Render services. No password, API key or database credential was added.
- The team04-FIT5120 ePortfolio About page was updated in place. It now has a
  Radar Sampah overview, current project links, source boundary, Amirah persona,
  overall journey, architecture/data boundary, iteration status, team roles,
  governance links and a design/build evidence block. A screenshot is saved at
  `backups/eportfolio-radar-sampah-2026-08-25.png`.
- The attached Citacita examples were used only as layout inspiration. Their
  text, images and data were not copied. Sample Project PGIE and HealthFirst
  reference files were not modified.

## Radar Sampah ePortfolio visual evidence - 25 August 2026

- Added project-owned visual blocks to the team04-FIT5120 About page so the
  page now has evidence alongside the written sections, following the sample
  page's pattern without copying its content.
- Added: `Project overview — beach cleanup context`, `Persona — Amirah`,
  `Prototype — manual litter report`, `Broad-area map and severity`,
  `Cleanup evidence — before and after`, `Confirmation — review before submit`,
  `Litter categories and quantities`, `Cleanup outcome and follow-up`, and
  `System architecture — data flow`.
- The images came from the local Radar Sampah design-thinking image set:
  `01_coastal_cleanup_hero.png`, `persona-amirah.png`,
  `02_phone_litter_documentation.png`, `03_broad_area_coast_map.png`,
  `04_beach_before_after.png`, `05_litter_categories.png`,
  `06_user_confirmation.png`, and `07_area_data_flow.png`.
- The screenshot used for layout review is
  `backups/eportfolio-radar-sampah-images-2026-08-25.png`. The page was
  reopened in display mode after saving; image blocks and their titles were
  re-read from the live page. All images are synthetic/project demonstration
  visuals and do not add real personal data or exact sensitive locations.

## 2026-08-28 — GitHub legacy sample cleanup

- Scope: GitHub repository `huangguan-giegie/radar_sampah` only. Drive,
  ePortfolio, Sample Project PGIE, Render settings and Future Features were not
  changed.
- Pre-cleanup `main` was `6ea1190d7bcc7f352dbb72465402ee831a5a11da`.
  A full archive and all-ref bundle are saved under
  `realwork/backups/github-legacy-cleanup-20260828/`.
- Rollback tags kept: `divesafe-last-stable` and
  `radar-sampah-pre-legacy-cleanup-20260828`.
- Cleanup commit on branch `codex/remove-legacy-sample-material` is
  `47ca9c28b92f8b8462c8b4c8d040431313c20b89`.
- Removed from the active tree: `references/healthfirst-example/**`,
  `actual-project/backend/data/dive_sites.json`,
  `species_directory.json` and `responsible_diving_briefings.json`.
  The old sample files remain recoverable from the tags and Git history.
- Removed the DiveSafe profile, species, briefing, recognition, sighting,
  collection and badge tables, helpers and routes from the active Flask app.
  The Radar Sampah litter tables, `/api/observations` compatibility route,
  current litter routes, `tidetrace_catalog.json`, OBIS context and Sea-TACO
  model files remain.
- Active README, API, integration, team and deliverable documents now describe
  Radar Sampah only. The migration record and this PM context retain the audit
  history and rollback references.
- Backend verification after cleanup: `19 passed`; Python compileall passed;
  `git diff --check` passed. Frontend build/test still needs to be run before
  merging to `main`.
- Remote branches scheduled for deletion after the main-branch verification:
  `agent/liquid-effects-more-visible` and `codex/radar-sampah-frontend`.
  Kept: `main`, `Sea-TACO-Detection-Model` and
  `feature/lihanxia-litter-report-status`.

### Final verification — 2026-08-28 22:58 +09:00

- The cleanup branch was merged into `main` with merge commit
  `2df923e910f962f7eaa29a8159634f7d8843d3ff` and pushed to origin.
- Remote `agent/liquid-effects-more-visible` and
  `codex/radar-sampah-frontend` were deleted. The model, backend feature and
  other team branches were left unchanged.
- Backend: `python -m pytest -q` passed (19 tests); Python compileall and
  whitespace checks passed. Frontend: 10 Vitest tests passed and
  `npx vite build --outDir dist-clean-verify` completed successfully.
- Local smoke check: `/health`, `/api/litter-options`,
  `/api/litter-reports`, `/api/litter-heatmap`, `/api/cleanup-missions` and
  `/api/community-progress` returned 200; a synthetic litter report returned
  201, demo recognition returned 200, and mission join returned 201. Removed
  DiveSafe endpoints returned 404 as intended.
- Render check: the existing `team04-marine-observation-frontend` and
  `team04-marine-observation-api` services returned 200 for their home/health
  checks. The unconfigured `radar-sampah-frontend` and
  `radar-sampah-api` hostnames returned 404; no Render settings were changed
  in this cleanup.
- A second live check of the existing API returned 200 for `/health`,
  `/api/litter-options`, `/api/context`, `/api/litter-reports`,
  `/api/litter-heatmap`, `/api/cleanup-missions` and
  `/api/community-progress`; the API root identifies the project as Radar
  Sampah.
- Final active-tree grep found no old sample runtime routes, DiveSafe data
  files or HealthFirst text outside the explicitly retained audit records and
  historical plan files.


## Radar Sampah brand cleanup merge — 30 August 2026

PR #9 (https://github.com/huangguan-giegie/radar_sampah/pull/9) was light-reviewed and merged into `main` with merge commit `2ea06b345d9e4e1afe14b6aba67706f099ce5fbf`. The cleanup renamed the active Marine-labelled Markdown, DOCX and onboarding deck files to Radar Sampah names, refreshed the five DOCX contents, and clarified the legacy Render-hostname and rollback boundaries. No runtime code, Drive file, Render setting, unmerged feature branch or Git history was changed. The pre-cleanup rollback tag is `radar-sampah-pre-legacy-cleanup` at `9af4bef`.

Verification recorded before merge: backend `34 passed`; frontend `25 passed`, TypeScript typecheck and production build passed; all 19 presentation slides rendered and passed the overflow test. DOCX text/table/link structure passed inspection; PDF rendering was unavailable because LibreOffice/soffice was not present in the local environment.

## Real frontend-backend integration repair — 31 August 2026

- Repair branch: `fix/real-api-integration-20260831`, based on `79107f5`.
  Commits: `c0519be` (frontend real API and metadata-free photo upload),
  `da28284` (backend contract/report/upload/scoring routes), `e0eee51`
  (privacy and score regressions), `aad8e6a` (SQLite timestamp handling), and
  `e76ac06` (frontend mock score alignment).
- Added the current frontend contract routes while retaining legacy `/api/*`.
  The new report table stores only anonymous user, beach, quantities, opaque
  photo key, source, status and timestamp; exact GPS and photo bytes are not
  stored. Scoring follows category weight × quantity weight, 90-day counted
  window, minimum three reports and mean bands.
- Verification: backend `40 passed`; frontend `30 passed`; TypeScript
  typecheck and production build passed. Local browser flow completed anonymous
  login → beach selection → metadata-free photo upload → manual location →
  category/quantity → Review → Submit Report → `/report/saved` → My Reports;
  the report was Counted and the browser console had no errors. Screenshot:
  `realwork/mentor-check-real-api-reports.png`.
- A follow-up regression test found mock-mode multi-category reports still
  selected the first category instead of the highest category × quantity score;
  `e76ac06` aligned that fallback with the backend rule. Frontend tests now pass
  `30/30` after this fix.
- Render target hosts `radar-sampah-api.onrender.com` and
  `radar-sampah-frontend.onrender.com` currently return 404, so this branch is
  not yet deployed online. The old compatibility frontend remains HTTP 200,
  while its API still lacks the new `/beaches` contract. Deployment and online
  smoke testing remain pending; no credentials, data or history were deleted.
