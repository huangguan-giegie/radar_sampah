# Team 04 PM Context

> Working context for future PM questions. Read this file before answering project-management questions, then check the newest chat folder under GROUP_CHAT_HISTORY for changes. This file is a summary, not a replacement for the latest team decision.

Last reviewed: 2026-08-08
Project: FIT5120 2026 S2 — Team 04
Product name: HealthFirst
Current user: Huang Guan (Guan)

## Identity correction — high priority

- Keith is Junn Chong and owns the Database role.
- Hnin Darli Myint Myat is Darli/Hnin and owns Data Analysis & Visualisation.
- The phone number +60 11-2375 4731 in the personal chat belongs to Hnin Darli, not Keith.
- Darli has also been helping with LeanKit, Epics/User Stories and iteration planning. Do not attribute those LeanKit messages to Keith.
- Earlier drafts and replies mixed up Keith and Darli. Use this correction as the current source of truth.

## 1. Huang Guan’s role

Huang Guan is the Project Manager. Main responsibilities:

- Sprint planning and scope control
- Task coordination and progress tracking
- LeanKit card and acceptance-criteria coordination
- Client/mentor communication
- Recording decisions in PGP or the agreed project record
- Supporting technical integration when needed
- Final integration checks for the shared presentation and MVP handoff
- Security Plan & Innovation owner for the Week 3 build, including planned security controls, privacy wording and the innovation notes

PM working rule: keep the scope realistic, make ownership visible, surface blockers early, and distinguish confirmed decisions from proposals.

## 2. Current team division

The latest division plan (GROUP_CHAT_HISTORY/8.2/分工计划8.2.txt) is the authority for team roles:

| Member | Main role | Main responsibility |
|---|---|---|
| Huang Guan | Project Manager | Sprint planning, coordination, progress, client communication, technical integration support |
| Qian | UI/UX + Frontend | Figma and HTML/CSS/JavaScript implementation |
| LiHanXia | Backend Developer | Python backend, APIs, business logic, frontend/database connection |
| Keith (Junn Chong) | Database | Database schema, data storage, database design and maintenance |
| Benshuai | AI / LLM | LLM chatbot, AI API, prompts and model-related features |
| Hnin / Darli (Hnin Darli Myint Myat) | Data Analysis & Visualisation | Data analysis, health-indicator processing and visualisation; current LeanKit and iteration-planning support |

Working relationship:

- Qian (frontend) ↔ LiHanXia (backend) ↔ Keith (database)
- Benshuai’s AI/LLM layer connects through the backend
- Hnin/Darli provides data analysis and visualisation and is currently helping maintain LeanKit and iteration planning
- Huang Guan coordinates the full flow and integration

## 3. Product and persona

HealthFirst is an onboarding/web-app concept for helping a middle-aged Malaysian user understand confirmed health-screening information and decide what to consider next.

The working persona is Mr Lim, a middle-aged Malaysian man who has screening information available but needs help understanding it. The product is educational decision support, not a medical diagnosis.

Main intended journey:

Frontend input → validation/review → user confirmation → health assessment → Malaysian context → explanation → prioritised action

## 4. Frozen MVP direction

Unless the team explicitly changes it, Iteration 1 should focus on a small manual-entry MVP.

### Must have

- Manual health-information entry
- Required-field and format validation
- Plain-language field explanations where needed
- Review and editing
- Explicit user confirmation before assessment
- Assessment using an approved method and confirmed inputs
- Malaysian health/mortality context from approved sources
- Plain-English interpretation
- Prioritised preventive actions and professional follow-up guidance where supported
- Visible evidence/source information
- Safety and accessible communication boundaries

### Backlog for now

- Automated report upload and OCR
- The pathway for users without a previous health screening
- Any broad chatbot or ongoing-guidance feature not needed for the MVP
- Extra datasets or unsupported risk calculations

Important safety rules:

- The AI explains confirmed inputs; it must not invent values, thresholds or evidence.
- Do not present the result as a diagnosis.
- Keep personal results separate from Malaysian population statistics.
- Do not use real patient data in the demo.

## 5. Current technical direction

Proposed MVP structure:

Frontend → Backend/API → Database

The AI/LLM layer should receive confirmed health fields through the backend and produce a plain-English explanation/action layer. The assessment itself must use a team-approved method; the placeholder [confirmed risk-assessment method] in the Epics/User Stories document must be replaced before implementation.

The extraction/OCR API can remain a future item while the team validates report-format feasibility with mentors.

Hosting is not finally decided. Safest current assumption: make a local or free-hosted demo work first; do not add a paid service without team agreement.

Supported fields still need final confirmation between frontend, backend, database and data owners. Keep the first list small and aligned with the ERD and approved assessment method.

## 6. Current project progress (as of 2026-08-03)

- Persona, problem statement and empathy map have been revised.
- Epics, user stories and acceptance criteria have been drafted. They cover three epics: Health Screening Information, Personalised Health Insights, and Prioritised Preventive Action.
- The team intends to place the manual-entry path in Iteration 1 and keep OCR/no-report onboarding in the backlog.
- The shared Google Slides deck is the current onboarding presentation. The latest live check on 2026-08-03 reports 20 slides after a teammate added an MVP example-tables/ERD slide; this supersedes the earlier 19- and 21-slide estimates.
- Huang Guan updated the shared AI Workflow and AI Outputs slides to match the manual-entry MVP, pending OCR validation, confirmed-input assessment, Malaysian context and prioritised action.
- The AI Workflow and AI Outputs speaker notes include the team role allocation and Kaggle/DOSM source references.
- Database/ERD, System Architecture and Code Quality content added by teammates should be preserved unless the owner requests a change.
- The team was trying to finish/review the slides on 2026-08-03.

Current status is not fully confirmed for implementation. Before promising completion, ask each owner for status, blocker, next step and expected completion time.

### Live checks completed on 2026-08-03

LeanKit:

- BACKLOG - Future Work contains Epic 4, Automated Report Input, correctly kept outside Iteration 1.
- TO DO THIS ITERATION contains Epics 1–3, the main User Stories and many Epic 1/Epic 2 Acceptance Criteria cards.
- No Acceptance Criteria cards for Epic 3 were visible in the loaded board view; confirm whether they are intentionally kept in the linked document or still need to be added.
- A sampled User Story card (US 1.1) had no Assigned Members, Planned Start or Planned Finish.
- A sampled Epic 2 Acceptance Criteria card (AC 2.1.1) also had no Assigned Members, Planned Start or Planned Finish, and its API field was still marked TBD.
- The in-progress documentation card AI Workflow slides - Huang Guan is assigned to Guan. Its description records manual entry as the MVP, report upload/OCR and the no-screening pathway as backlog items, the slide/source checks, and the handoff to Su. Planned Finish is now 10/08/2026 (Week 3 Monday, 11:55pm); Planned Start remains blank.
- The board therefore needs an owner/deadline pass before it can be treated as ready for iteration tracking.

Shared Google Slides:

- The latest live Google Slides check reported 20 slides and showed the document as saved to Drive. The new MVP example-tables/ERD content needs a safety and source review before the deck is treated as final.
- Slides 12–13 match the MVP direction: manual entry is the MVP path, OCR is pending validation, confirmed inputs are assessed in Malaysian context, and the outputs include a prioritised action with no diagnosis wording.
- Slide 2 has been aligned with the latest division plan: Benshuai AI/LLM, Keith/Junn Chong Database, LiHanXia Backend, Qian UI/UX + Frontend, and Hnin Darli Data Analysis & Visualisation.
- Slides 6, 9 and 16 now label manual entry as the MVP and report upload/OCR as pending/backlog. The deck was rechecked and shows Saved to Drive.
- Slide 11 contains stronger prediction/risk language about future heart disease, stroke and diabetes. This needs source and assessment-method confirmation, or should be softened to qualitative comparison language.
- Slide 10 includes CVD/diabetes/stroke risk fields and a high-risk threshold in the ERD; confirm that each method and threshold is approved before implementation.
- Slides 17–18 should be checked for planned-versus-implemented security wording and complete final reference URLs. Slides 16–17 did not show speaker-note source blocks in the HTML view.

### Actions completed on 2026-08-03

- Updated the shared Google Slides role list and MVP wording without changing the teammate-owned database, system-diagram, security or risk-method content.
- Updated the LeanKit card `AI Workflow slides - Huang Guan` with the same MVP boundary and handoff details; Guan Huang remains the only assignee and the card remains in Doing / In Progress.
- The team confirmed the official onboarding build deadline. LeanKit Planned Finish for `AI Workflow slides - Huang Guan` is 10/08/2026 (Week 3 Monday, 11:55pm); Planned Start remains blank.

### Drive file audit for tomorrow's onboarding presentation (2026-08-03)

- The shared `Onboarding` folder contains the current `TM04 Onboarding presentation` Google Slides deck (modified 22:39), `Health Screening Information.pptx` (modified 22:33), `Epics, User Stories`, `System architecture.svg`, the `Design Artefacts` folder and `Idea Generation`.
- `Design Artefacts` contains `Persona_Mr_Lim_Wei_Jian.pdf`, `problem statement` and `Empathy_Map_Mr_Lim.pdf`. These support the discovery section but are not required to be opened during the presentation.
- The parent shared folder also contains `TM04 Social Contract.docx` and `To Do List.xlsx`. They are governance backups, not presentation slides.
- The must-have live links are the shared deck, Figma prototype and LeanKit board. No separate PDF/PPTX export of the current shared deck was visible in Drive; make an offline export if the venue connection or projector is uncertain.
- Treat `Health Screening Information.pptx` and any ERD/example values as illustrative only unless the team has approved the method and sources. Do not present them as real patient results.
- Created the English Google Doc `Team 04 – HealthFirst Team Information` in the shared `Team Information` Drive folder on 2026-08-03. It records the current team roles, MVP direction, backlog boundary, working principles and project links: https://docs.google.com/document/d/1RqcnZ0z0CzWwSSeMmuDRwD1dglmN30VWFpU1y65toIY/edit

### Live WhatsApp review on 2026-08-03 (21:23)

- Darli/Yuki indicated that Iteration Plan and Epics/User Stories are checked and asked the team to review their own sections.
- Keith/Junn Chong added MVP ERD/example-table content and explained the seven datasets and proposed database flow. His examples included risk scores, thresholds and mortality wording that still need an approved method/source or clear mock-data labels.
- Su indicated that System Diagram and Code Quality are checked.
- Qian/Jiang shared the Figma prototype link and said the prototype was ready for review; a final review is still needed.
- No current backend/API status from LiHanXia was visible in the chat.
- Qian/Jiang asked whether an AI action plan must be saved in the functionality. The PM position is to keep the MVP action card as guidance based on confirmed inputs, without diagnosis or unsupported predictions.
- Huang Guan sent a PM message at 21:23 thanking the team, requesting each owner’s next step/blocker/expected completion time, and asking that sample scores, thresholds and predictive-mortality wording be marked as illustrative or removed until approved.

### Figma prototype review on 2026-08-03

- Jiang/Qian’s `Health First — 3 Screen Accessible Prototype` contains three clear screens: Enter your screening values, Check your information / review and confirm, and Personalised insights.
- Strengths: the flow is easy to follow; fields show units; the confirmation step explicitly says only confirmed values are used; the prototype separates Malaysian population context from the user’s confirmed values; and the copy uses doctor discussion rather than diagnosis wording.
- Jiang’s revision now labels the values as `Illustrative demo data — not real user results` and includes optional age, sex, smoking and activity fields, resolving the main ERD/prototype field mismatch for the current MVP.
- The population cards now show source/year details and separate population context from individual results. The page also states that the overview is illustrative and not a diagnosis.
- Each demo status now references the relevant Malaysian MOH CPG (Hypertension 2018, T2DM 2020, Dyslipidaemia 2023 and Obesity 2023) and says clinical validation is required before release.
- Remaining design check: the `AI-assisted recommendations / action plans` box is still blank. Add a small clearly labelled illustrative action-card example or mark it as a prototype placeholder; do not add unsupported medical advice.
- The Figma file was reviewed as a static design. Prototype interaction testing was unavailable because Figma requested an account for Prototype view.

### WhatsApp follow-up after Figma revision (2026-08-03, 21:25)

- Darli/Yuki confirmed that the official delivery deadline is Monday of Week 3, matching the LeanKit Planned Finish already set to 10/08/2026 (11:55pm).
- No new backend/API status from LiHanXia was visible after the PM status request. Continue tracking this as the main open owner update.

### Live WhatsApp and presentation review (2026-08-04)

- In the Team 04 WhatsApp chat, Yuki/Hnin said at 23:51 that the slides were final and asked everyone to review them. At 00:00 she noted that the deck still had no clear ethics aspect.
- The current shared Google Slides deck is saved to Drive and contains 22 slides. Slides 15 and 16 are the current AI Workflow and AI Outputs slides; the workflow labels the third stage `ASSESS` rather than `COMPARE`.
- The AI slides are visually readable and include visible safety wording, confirmed-input wording and source-note blocks. The speech script should match the deck's `Capture → Confirm → Assess → Explain` labels.
- Review risks before presenting: Slides 11–14 contain sample risk scores, thresholds, mortality-risk wording and a claim that the system predicts elevated mortality risk without an explicit illustrative-data label; Slide 14 also uses `What may happen next if I don't act?`. These should be softened, clearly labelled as mock examples, or supported by an approved method and source.
- Slide 19 says RAG grounds every recommendation in authoritative guidelines, while the visible deck does not show those guideline links. Slide 20 uses present-tense claims about encryption, anonymisation, RBAC/MFA and PDPA compliance; change to planned controls unless already implemented. Slide 21 says Kaggle links are on Slide 9, but the dataset list is on Slide 10.

## 7. Acceptance-criteria ownership proposal

This is a working proposal, not a confirmed team decision until the owners acknowledge it in chat or LeanKit. Each LeanKit card should have one named owner; supporting reviewers can be listed in the description.

| Acceptance area | Proposed owner | Supporting reviewer(s) |
|---|---|---|
| Health-information entry | Qian | LiHanXia, Keith |
| Input validation | LiHanXia | Qian |
| Health-field explanation | Benshuai | Hnin |
| Review and editing | Qian | LiHanXia |
| User confirmation | Qian | LiHanXia |
| Health-result interpretation | Benshuai | Hnin |
| Health-risk assessment | Hnin | Benshuai, LiHanXia |
| Attention identification | Hnin | Benshuai |
| Contributing-factor explanation | Benshuai | Hnin |
| Malaysian health context | Hnin | Keith |
| Evidence/source display | Hnin | Qian |
| Preventive actions and prioritisation | Benshuai | Hnin |
| Finding-to-action connection | Benshuai | Qian |
| Professional follow-up guidance | Benshuai | Hnin |
| Safety/educational boundaries | Huang Guan | Benshuai, Hnin |
| Accessible health communication | Qian | Benshuai |
| Database schema/storage | Keith | LiHanXia |

Clarification for the earlier group message: Keith was not intentionally omitted from the proposed Acceptance Criteria allocation. That list focused on user-facing functionality and did not clearly show the database work. Keith (Junn Chong) should own the MVP database/schema card and review the field, storage and source mappings behind the relevant criteria, especially health-information entry, confirmation and Malaysian/source data. The exact LeanKit card mapping remains a team proposal until Keith and the team confirm it. Darli/Hnin is the person who created the current LeanKit iteration structure; do not confuse that contribution with Keith’s database ownership.

Latest clarification from the group: Keith has actively confirmed that he will update the database fields and schema for the MVP. Su’s concern that Keith was missing is therefore resolved. Treat this as a separate Iteration 1 technical task linked to the relevant User Stories; it does not need to become another user-facing Acceptance Criteria card unless the team identifies a database-specific criterion.

## 7A. LeanKit presentation guidance

The following screenshots were reviewed on 2026-08-03:

- Product Functionality table with 18 functional/acceptance areas
- A sample LeanKit board with a separate Acceptance Criteria column
- Another onboarding board that keeps the main board clean and shows no separate Acceptance Criteria column

Recommended approach for Team 04:

- Keep the detailed acceptance criteria in the Epics/User Stories document and/or inside the relevant User Story card.
- Keep the main LeanKit board readable. Do not create 18 large standalone cards if they make the board hard to follow.
- A compact Acceptance Criteria column is acceptable for the core Iteration 1 user stories, but it is optional for an onboarding board.
- Darli’s existing EPIC 2 acceptance-criteria cards can remain as a useful reference. If the board becomes crowded, link the full criteria from the User Story card instead of duplicating every criterion on the main board.
- The shared presentation should show only the MVP flow and scope summary, not the full acceptance-criteria list.
- OCR/report upload and the no-previous-screening pathway remain backlog items in LeanKit.

This is the PM recommendation based on the screenshots. It should be confirmed in the team chat before treating it as a final LeanKit convention.

## 8. Core chat history and decisions

### 2026-07-31

- Team 04 was formed and members joined the group.
- LeanKit was proposed for Epics and User Stories, initially using Mr Lim as the persona.
- Dataset research started; the product idea was health-screening input followed by comparison and action guidance.
- Team members began choosing presentation sections.

### 2026-08-01

- The shared onboarding presentation was created and section ownership was discussed.
- Huang Guan took Epics/User Stories and later the AI Workflow section; Su retained System Diagram and Code Quality; other sections were divided among the team.
- The group realised the initial concept could be too broad for a one-week build.
- Hnin suggested a broader user journey for people who know or do not know their health information; this was later narrowed for MVP feasibility.
- The team confirmed that the immediate focus was product-discovery presentation structure and a small later demo, not a complete production system.

### 2026-08-02

- Persona, problem statement and empathy mapping were updated.
- Hnin recommended keeping detailed technical diagrams in a separate file and showing only a summary/flow in the shared presentation.
- The agreed flow became: frontend input, manual entry as must-have, report upload/OCR pending validation, extraction only if later approved, user confirmation, health assessment, Malaysian context, explanation and prioritised action.
- The team discussed two possible APIs: report extraction and risk/action analysis. Because OCR is not yet validated, extraction should not block the MVP.
- Hosting and possible costs were raised, but no final hosting decision was recorded.
- Huang Guan updated the shared AI Workflow slides and aligned the notes with the source list and team roles.
- The shared deck now also aligns Slide 2 with the current roles (Hnin Darli as Data Analysis & Visualisation, Qian as UI/UX + Frontend, LiHanXia as Backend, Keith/Junn Chong as Database, Benshuai as AI/LLM). Slides 6, 9 and 16 describe manual entry as the MVP and report upload/OCR as pending/backlog.
- Epics/User Stories were placed into Iteration 1 except OCR and the pathway for users without previous screening.

### 2026-08-03

- The team was asked to finish and review the slides.
- Su said the required one-week functionality was still unclear.
- Huang Guan pointed the team to the Epic, User Story and Acceptance Criteria summary.
- Acceptance-criteria owners had not yet been assigned in LeanKit.
- Hnin Darli asked how the overall project and technical aspects were progressing, created the Iteration 1 LeanKit structure, placed OCR/report upload and the no-previous-screening pathway outside Iteration 1, and asked whether the detailed Acceptance Criteria should remain on the board.
- Darli also asked Huang Guan to help oversee the slides and LeanKit, including owners and deadlines, because she has an important exam on Wednesday and may reply more slowly.
- Huang Guan apologised for mixing up Keith/Junn Chong and Hnin Darli and confirmed that the correction should be used going forward.

## 9. Open risks and PM follow-up

1. Scope risk: 18 acceptance areas can become too much for one week. Freeze manual entry and defer OCR.
2. Assessment-method risk: choose and document one approved assessment method; do not leave placeholders.
3. Field-list risk: confirm the smallest supported field set before frontend/backend/database work diverges.
4. Ownership risk: assign one owner per LeanKit acceptance card and record the decision the same day.
5. Integration risk: confirm frontend → backend → database handoff and the AI input/output contract.
6. Hosting risk: decide whether local/free hosting is enough for the MVP; avoid unapproved costs.
7. Evidence/safety risk: keep sources visible and avoid diagnosis, invented thresholds, unsupported urgency and fabricated statistics.
8. Delivery risk: slides, technical notes and the actual MVP scope must tell the same story.

## 10. PM response checklist

Before answering a new PM question:

1. Read this file.
2. Check the newest GROUP_CHAT_HISTORY/<date> folder.
3. Treat the newest confirmed team decision as authoritative over older proposals.
4. Separate confirmed facts, proposed decisions and unresolved blockers.
5. When drafting team messages, use simple natural English, short sentences and a student-like tone.
6. Do not claim that a message, LeanKit card or external document was updated unless the action was actually performed.
7. When a decision changes scope, roles or sources, update this file and record the date.

## Key project files

- Latest division plan: GROUP_CHAT_HISTORY/8.2/分工计划8.2.txt
- Latest chat export reviewed: GROUP_CHAT_HISTORY/8.3/与Team 04的 WhatsApp 聊天.txt
- Epics and user stories: Epics, User Stories.txt
- Social Contract: TM04 Social Contract.docx
- Local presentation copy: TM04 Onboarding presentation.pptx
- Shared presentation: Google Slides deck provided by the user

## 11. Post-presentation Week 3 build planning (2026-08-04)

- Huang Guan reported that the team presentation has passed and the team is moving into the Week 3 MVP build.
- The official build deadline remains Monday 10 August 2026, 11:55pm AEST/MYT. This is separate from the Week 2 presentation.
- The proposed build scope remains manual health-information entry, validation, review/editing, explicit confirmation, an approved assessment approach, Malaysian context, plain-English explanation and a prioritised action card.
- OCR/report upload and the pathway for users without previous screening remain backlog items unless the team explicitly changes scope.
- A private GitHub repository was created on 2026-08-04: https://github.com/huangguan-giegie/healthfirst-team04-mvp. It has an initial `README.md` and Python `.gitignore`. Drive remains the shared space for presentation files, governance documents and large artefacts; GitHub is for source code, technical notes, review history and rollback. Team member access still needs to be added after their GitHub usernames are confirmed in the group chat.
- The repository should use a protected `main` branch, `feature/<owner>-<task>` branches, one review before merge, and no secrets, real health reports or personal data in Git.
- Huang Guan now owns Security Plan & Innovation. Security claims in the build should be written as implemented controls only when they are actually implemented; otherwise label them as planned.
- On 2026-08-04, Huang Guan posted a PM update in the Team 04 WhatsApp group with the GitHub link, Drive/Git usage split, branch and data-safety rules, the Week 3 deadline, the frozen MVP scope, and a request for each member’s GitHub username, blocker and expected finish time.
- On 2026-08-04, Huang Guan sent a follow-up Team 04 WhatsApp message with the full Week 3 owner list, the manual-entry MVP flow, the deadline, the GitHub repository link and a request for each member’s GitHub username. The earlier message alone did not include the full division plan; this follow-up corrected that.
- On 2026-08-05, Qian/Jiang provided the GitHub username `qjia0033-dev` for repository access. After Huang completed GitHub sudo verification, the account was added to `huangguan-giegie/healthfirst-team04-mvp`. GitHub shows `Pending Invite / Awaiting qjia0033-dev’s response`; Qian must accept the invitation before the private repository opens for her.
- The detailed English Week 3 plan is saved at `docs/superpowers/plans/2026-08-04-team04-week3-mvp-build.md`.

## 12. GitHub access and merge workflow review (2026-08-05)

- The 8.5 WhatsApp export confirms that Qian opened PR #1 for the frontend (`https://github.com/huangguan-giegie/healthfirst-team04-mvp/pull/1`) and asked Hanx and Su to review it.
- Hanx proposed that contributors notify Huang Guan after updating their branches, then wait for PM review and a merge into `main` before rebasing or starting further work from the updated `main`.
- GitHub usernames confirmed in the 8.5 chat include `hlii0333` (Hanx), `SUBENSHUAI` (Benshuai), `hnin0011` (Hnin Darli), `kcho0072` (Keith) and `qjia0033-dev` (Qian/Jiang). Invitations were sent; each person must accept the invitation before the private repository opens.
- Permission review: the repository is owned by Huang's personal GitHub account. GitHub documents personal-account collaborators as having read/write collaboration access, rather than separate Write/Maintain roles. No collaborator role change was possible on 2026-08-05.
- Proposed convenience workflow (not yet confirmed): keep Huang as the only owner; let code contributors use feature branches and PRs; keep `main` protected with one review; and nominate one trusted second reviewer if PM review becomes a bottleneck. Moving the repository to a GitHub organization would provide granular Read/Triage/Write/Maintain/Admin roles, but adds setup overhead and is not necessary for this student MVP unless the team needs delegated repository management.
- On 2026-08-05, Huang posted the agreed English permissions/workflow notice in the Team 04 WhatsApp group. It says accepted collaborators already have write access, one peer review can be used for routine PRs, Su can help review/merge routine code, Huang will retain scope/safety/conflict oversight, feature branches remain required, and direct pushes to `main` are not allowed.
- On 2026-08-05, Huang created a classic branch-protection rule for `main` with required pull requests, one approval and stale-approval dismissal; force pushes and branch deletion remain disabled. GitHub currently shows the rule as `Not enforced` because this private personal-account repository needs a GitHub Team or Enterprise organization plan for classic protection enforcement. No collaborator role escalation was possible or made; personal-account collaborators already have write access.
- Current GitHub access status after the 8.5 invitations: accepted collaborators are `hlii0333` (Hanx), `qjia0033-dev` (Qian/Jiang), `SUBENSHUAI` (Benshuai/Su) and `kcho0072` (Keith). Only `hnin0011` (Hnin Darli) is still pending invitation acceptance.
- Follow-up decision on 2026-08-05: keep the private personal repository for now. The manual PR/review agreement is usable for the student MVP, but the `main` branch rule is currently not enforced on this plan. Full enforcement would require either moving the repository to a suitable GitHub organization plan or making the repository public; neither change should be made without the team's explicit approval because they affect privacy, ownership or cost.
- Latest GitHub check on 2026-08-05: direct access shows four accepted collaborators (`hlii0333`, `kcho0072`, `qjia0033-dev`, `SUBENSHUAI`) and one pending invitation (`hnin0011`). `SUBENSHUAI` is Benshuai/Su, so Su is already in the repository. No repeat permissions announcement is needed; only remind Hnin to accept the outstanding invite if necessary.
- Pull Request #1 (`Frontend: manual entry, validation, review & confirm`) is open from `feature/qianjiang-frontend-entry-confirm` into `main`. GitHub currently shows `Ready to merge`, a merge button, zero automated checks, and `No reviews`. Huang should review the changed files and test evidence before merging; do not merge solely because the page says it is ready.
- On 2026-08-05, Huang reviewed PR #1 and approved it after checking the 58-case validation suite (`58 passed, 0 failed`), JavaScript syntax and both JSON examples. The PR had no merge conflicts. Huang then merged it into `main` as commit `fb3917b5c74026d05b4de259bf36e687c71c612c`; the feature branch remains available and was not deleted. The review comment records that mock thresholds and source labels are illustrative placeholders and must be replaced with Hnin's approved assessment method before release.
- After the merge, the GitHub PR now contains the review and merge events. Huang chose not to repeat the same update in WhatsApp; GitHub records are visible to the PR author and repository users, but delivery of notifications depends on each person's subscription settings. Team members should still sync from `main` before continuing work.

## 13. Week 3 backend integration and PM execution (2026-08-06)

- The latest live Team 04 WhatsApp update came from Hanx/LiHanXia: the backend for `POST /api/assess` was pushed to `feature/lihanxia-backend-assess-api` while `main` remained untouched. The message confirmed that `docs/API.md` is the contract, thresholds are still frontend-demo values, `action_card` is rule-based placeholder logic, and persistence is local SQLite while the storage decision remains open.
- PM review found two input-safety gaps in the first backend draft: JSON booleans could pass as `smoking`/`activity`, and biomarker names/duplicates/units were not strict. These were hardened in commit `ce048c42b829b554bbe68ea804b1dc5fd9eb1157` on `feature/huang-backend-validation-hardening`, then included in the integration branch.
- Pull Request #2 (`Week 3 MVP backend, security and integration skeleton`) was opened from `feature/huang-pm-security-integration` into `main`: https://github.com/huangguan-giegie/healthfirst-team04-mvp/pull/2. It included the backend skeleton, frontend connection, validation hardening, Security Plan, Innovation, integration checklist, decisions record and README run/safety guidance.
- PR #2 was reviewed by Huang as an integration skeleton and merged without conflicts into `main` on 2026-08-06 as commit `3d34b3a7af3e1dac02bf43e1006a379e4b15242c`. The review note records that the release remains blocked until Hnin confirms the assessment method and sources, Benshuai confirms final AI/LLM action-card logic, and production controls are actually implemented and reviewed.
- Fresh post-merge verification on `origin/main`: backend `pytest -q` passed `34 passed` (with only dependency deprecation warnings); frontend validation passed `58 passed, 0 failed`; JavaScript syntax checks passed for `frontend/js/api.js` and `frontend/js/app.js`. The local browser flow at `http://localhost:8000` passed: entry → validation → review/edit → confirmation → `POST /api/assess` → results. A `127.0.0.1` attempt correctly exposed the localhost-only CORS boundary and was rerun using the documented `localhost` origin.
- The merged docs separate implemented demo controls from planned controls. Current facts are local SQLite, localhost-only CORS, no authentication, no production hosting, demo data only and no committed secrets. The docs do not claim encryption, RBAC/MFA, anonymisation or PDPA compliance.
- LeanKit board `FIT5120 2026S2 TM04` was updated with Huang-owned cards: `Backend API review & integration - Huang Guan` (Doing: Document/Other, finish 07/08/2026, PR #2 evidence), `Security Plan and release gates - Huang Guan` (Doing: Document/Other, finish 08/08/2026), `Innovation notes and MVP boundaries - Huang Guan` (Doing: Document/Other, finish 08/08/2026), and `Final end-to-end safety review - Huang Guan` (To Do This Iteration: Document/Other, finish 10/08/2026). OCR/report upload and the no-screening pathway remain in the backlog.
- After the PR review and merge, Huang sent the planned short English update in the Team 04 WhatsApp group at 17:32: `Quick update: LiHanXia has pushed the backend for POST /api/assess. I reviewed the PR against API.md and ran the local tests and end-to-end flow before merging. Please continue from main and use feature branches. The demo thresholds, local SQLite storage and rule-based action card are placeholders until the approved method and final AI logic are confirmed.`

Current release blockers remain: approved assessment method and source confirmation, replacement of demo thresholds, final AI/LLM action-card review, real-data/privacy controls, and any public deployment decision. Do not present the merged skeleton as a medical diagnostic or production-secure service.

## 14. LeanKit owner/date pass (2026-08-07)

- Teacher request completed for the Iteration 1 Epics, User Stories and Acceptance Criteria cards.
- Epic owners and windows: Health Screening Information — Qian Jiang, 05/08/2026–07/08/2026; Personalized Health Insights — Hnin Darli Myint Myat, 07/08/2026–08/08/2026; Prioritized Preventive Action — Benshuai Su, 08/08/2026–09/08/2026.
- User Story owners and windows: US1.1 and US1.2 — Qian Jiang; US2.1 — Hanxia Li; US2.2 — Hnin Darli Myint Myat; US3.1 and US3.2 — Benshuai Su. Dates match their parent Epic windows.
- Acceptance Criteria owners follow the agreed allocation: Qian for AC1.1/1.2, Benshuai and Hnin for the relevant health-result and action criteria, Guan Huang for AC2.1.8 safety wording, and Benshuai for professional follow-up criteria. All cards now have planned start and finish dates.
- OCR/report upload and the no-previous-screening pathway remain backlog items.
## 15. Data governance draft (2026-08-08)

- Darli requested documentation for data governance of the onboarding project in her latest personal WhatsApp message.
- Huang created the English working draft “HealthFirst - Data Governance and Information Handling (MVP)” in Drive: https://docs.google.com/document/d/1rnSL3anbY3Fy57fDS0uv8LfX4dCqK2AsdFahODCOOEw/edit
- The document was moved into the shared `Sample Project Governance Portfolio (PGIE) / Data Governance` folder.
- It covers the MVP data inventory, purpose and flow, roles/access, implemented versus planned privacy controls, data quality and evidence, retention open decision, release gates and action owners.
- Open owners: Hnin for the assessment method, Malaysian sources and threshold wording; Keith and LiHanXia for fields, schema and storage; Benshuai for AI/action-card review; Qian for frontend consistency; Huang for PM records and final review.
- Status: working draft. Do not present it as a production privacy policy, clinical protocol or PDPA compliance statement.

## 16. Darli GitHub update check (2026-08-08)

- Darli asked Huang to reject her unconfirmed GitHub updates because Codex changed files while she was testing.
- GitHub review found `main` unchanged since the 2026-08-06 integration merge, no open Pull Request, and no Hnin/Darli feature branch or new commit to merge.
- Action taken: no unconfirmed changes were merged or added to `main`; the repository remains on the last reviewed state. Darli should send a new request and confirmation before any future change is considered.
- Team workflow reminder: use a feature branch, open a Pull Request, and notify Huang before review/merge.
- Huang replied to Darli in WhatsApp with the check result and asked her to send intended changes with confirmation before any addition.
- Huang posted the same GitHub status in the Team 04 group: no unconfirmed edits were merged; feature branches and Pull Requests remain required.
- On 2026-08-08, Huang posted the follow-up data-governance plan in the Team 04 group: Hnin to confirm method/sources/threshold wording; Keith and LiHanXia to check fields/schema/storage/validation; Benshuai to confirm AI/action-card logic; Qian to check frontend wording; Huang to complete the final review. OCR and the no-screening pathway remain backlog items, and the governance document stays a working draft.

## 17. Feature Matrix and CPG scoring review (2026-08-08)

- Darli asked Huang to check the files shared in Team 04. The latest group message links the Feature Matrix: https://docs.google.com/spreadsheets/d/1WR62fOwkGToTwVOx8bZpmDgjUPFU-W_2/edit?gid=1725687145#gid=1725687145 and `CPG_Baseline_and_MVP_Scoring`: https://docs.google.com/document/d/1aG_oSpiqzt5AmC8yxQnevsqyEMqSVdQt/edit.
- The Feature Matrix contains 21 core/context variables plus derived BMI, maps fields to CVD, diabetes, stroke and heart-failure areas, and marks clinical-only items such as ECG, renal function, BNP/NT-proBNP and echocardiogram as excluded from self-entry. It also records local dataset names and HealthFirst input sources.
- The CPG document proposes educational Low/Medium/High categories, CPG thresholds, a named Framingham method when complete inputs exist, fallback attention rules, missing-data rules and explicit non-diagnosis wording. It is labelled an analysis/implementation handoff, not a final clinical protocol.
- PM review decision: do not merge the 21-variable expansion, exact thresholds or average/third-quantile values into the MVP until Hnin confirms the method and provides official source URLs/page references. Descriptive quantiles must not be presented as clinical cut-offs.
- Next actions: Hnin confirms sources/method/threshold wording; Keith and LiHanXia map the variables to the actual schema/API and identify fields not yet supported; Qian checks UI wording; Benshuai checks AI/action-card safety language; Huang reconciles the handoff with the local MVP and release gates.

- A duplicate Prioritized Preventive Action card briefly appeared during editing. After refresh, only one card remained with Benshuai Su and the correct 08/08/2026–09/08/2026 window; no deletion was performed against the remaining card.
- On 2026-08-07, Huang Guan posted the LeanKit owner/date summary in the Team 04 WhatsApp group. The message confirmed the Epic and User Story owners, the Acceptance Criteria ownership groups, the 05–09 August schedule, and that OCR/report upload and the no-previous-screening pathway remain in the backlog.
## 18. Source confirmation and schema mapping record (2026-08-08)

- Huang completed the source and schema handoff in `tmp/agent-docs-security/docs/SOURCE_CONFIRMATION_AND_SCHEMA_MAP.md`, and linked it from `docs/API.md`.
- The record links the shared Feature Matrix and CPG draft, lists the official MOH candidate publications and direct URLs, and separates publication confirmation from Hnin's pending page-level/method confirmation.
- The current API/database contract was mapped field by field. Existing support is limited to the current report fields, five biomarkers and server-derived BMI; LDL-C, HDL-C, triglycerides, HbA1c, treatment/history fields and waist circumference remain proposed and are not accepted by the endpoint yet.
- Clinical-only fields (heart-failure symptoms/signs, BNP/NT-proBNP, echocardiogram LVEF, ECG and renal function) remain excluded from self-entry. Dataset averages and third quantiles are not clinical cut-offs and were not added to `Benchmark`.
- `docs/decisions.md` records the working decision to keep the API stable until Hnin confirms source pages/method and Keith/LiHanXia confirm schema/storage. Backend regression tests still pass (`34 passed`); no production or clinical approval is claimed.
## 19. PR #3 database integration review (2026-08-09)

- Keith/Junn Chong opened PR #3, `Feature/junnkeith db integration`, from the `feature/junnkeith-db-integration` branch. The email says it adds PostgreSQL integration, benchmark-backed statuses, and persistence for `biomarker`, `user_report` and `health_assessment`.
- Review evidence: the PR branch was fetched locally and its backend test suite passed `37 passed` with SQLite; `git diff --check` passed. This does not prove the Render/PostgreSQL path works.
- Merge blockers found: `backend/app/db.py` contains a hard-coded Render PostgreSQL connection URL with credentials; the credential must be rotated/revoked and removed from the repository history. The runtime queries `public.benchmark`, but `backend/schema.sql` does not create or seed that table, so a fresh PostgreSQL deployment can return `500` on assessment. No live PostgreSQL integration test is included.
- Safety blocker: `health_assessment` stores potential risk scores and a mortality risk level calculated from the current illustrative status rules. These must remain clearly non-clinical placeholders or be left unset until Hnin confirms the approved method and wording.
- Hygiene issue: the PR adds four `.DS_Store` files. Remove them and add the pattern to `.gitignore`.
- PM decision: do not merge PR #3 yet. Ask Keith to rotate the exposed credential, switch to environment-only configuration, add a complete benchmark table/migration with provenance, add PostgreSQL-path tests, and keep demo/risk wording explicit. After a clean force-push/new commit and fresh tests, Huang can review again.
## 20. Latest Keith and Team 04 chat / PR #3 follow-up (2026-08-09)

- Keith replied privately that he removed the hard-coded database setting, added the benchmark schema and PostgreSQL-path test, and asked for help removing files and the database setting from Git history. He also said the exact risk scores are still stored in the database but not shown in the frontend.
- The remote feature branch now points to `ce7a958` and contains the follow-up commits, but the open PR #3 ref still points to `23f7b3a`; the new fixes are therefore not yet included in the PR under review. Do not review or merge the old PR head as if it contained the fixes.
- Fresh verification of the updated feature branch: normal backend tests `37 passed, 1 skipped` (the PostgreSQL test is opt-in); `schema.sql` now includes `public.benchmark` and the default URL is removed from the latest file. Three tracked `.DS_Store` files remain in the branch, and the exposed credential still appears in four earlier Git commits, so rotation and history cleanup are still required.
- The latest Team 04 chat records Yuki providing age/gender-filtered dataset summaries, Keith replying “thanks”, and Yuki replying “Ok will do” to Huang's source/schema handoff update. No new PM message was sent after that.
- Next PM action: ask Keith to ensure the fixes are pushed to the PR's actual head branch, remove the remaining `.DS_Store` files, rotate and rewrite the exposed credential, and explain how the stored risk scores will remain visibly non-clinical or be disabled until Hnin approves the method. Re-review only after the PR head updates.
## 21. Render rotation and PR #3 monitoring (2026-08-09)

- Huang authorised rotation of the exposed Render database credential. The Render dashboard opened to its sign-in page, so no credential change was made and no password or database URL was requested from Huang. Huang must sign in in the browser before the rotation can continue.
- A fresh remote check still shows PR #3 at `23f7b3a`, while `feature/junnkeith-db-integration` is at `ce7a958` with the follow-up commits. The PR has not yet updated to the fixed branch head, so no second PR review or merge was performed.
## 22. Keith clarification on Git history and Render ownership (2026-08-09)

- Keith acknowledged the requirement to label the stored risk scores as demo placeholders.
- He then asked Huang for help removing `.DS_Store` files and the database credential from Git history, saying he has not done this before. His latest message only says the credentials are in `db.py`; it does not identify the Render account or workspace that owns the database.
- Huang has not sent the Render-account question yet. Next coordination step is to ask Keith whether he owns the Render workspace/database and whether he can rotate the credential or invite Huang to the workspace. Do not ask him to paste the credential into WhatsApp.

## 23. Latest Keith reply and PM follow-up (2026-08-09)

- Keith's latest private WhatsApp message says: `Done rotate for credential, however render free version doesn't allow invite team members` (11:41). He has therefore handled the credential rotation on his side, but Huang does not need Render workspace access for the next step.
- Huang replied at 11:54: `Thanks Keith. Good that you rotated the credential. No need to invite me to Render—please don’t send the new credential. Please finish the Git history cleanup, remove all remaining .DS_Store files, keep risk scores labelled as demo placeholders, and push the cleaned branch so PR #3 updates. I’ll review it again then.` The message was delivered; no credential was requested or shared.
- The latest Team 04 group chat has no new PM request after Yuki's `Ok will do` (00:30) in response to the source/schema handoff. Yuki supplied an age- and gender-filtered dataset summary; Keith acknowledged it. No duplicate group announcement is needed now.
- Current Huang actions remain: wait for Keith to rewrite the exposed credential out of branch history, remove the remaining `.DS_Store` files, update the actual PR #3 head, and then rerun backend/frontend tests plus the local end-to-end flow before any merge decision. Keep the exact risk scores visibly non-clinical placeholders until Hnin confirms the assessment method and sources.
- Hnin's method/source confirmation and Benshuai's final AI/action-card review remain open release gates. OCR/report upload and the no-screening pathway remain backlog items. The 8.2 division record still assigns Huang as PM/integration coordinator and Security Plan & Innovation owner.

## 24. Keith latest update and PR #4 review queue (2026-08-09)

- Keith sent two new private WhatsApp messages at 13:33: `Done the changes, please help review again` and an image labelled `Added Demo`.
- GitHub verification shows that old PR #3 is closed and still contains only the earlier five-commit version. Keith opened PR #4 from the same feature branch: https://github.com/huangguan-giegie/healthfirst-team04-mvp/pull/4.
- PR #4 is open with 11 commits and states that the credential was removed from `backend/app/db.py`, the credential was rotated, `public.benchmark` was added to `schema.sql`, risk scores remain labelled as demo placeholders, `.DS_Store` files were removed and ignored, and a PostgreSQL-path test was added. The latest branch commit is `fa63104` (`Add .DS_Store to gitignore`).
- PR #4 currently has no reviews and no automated checks. Huang must review the changed files and run the backend/frontend tests plus the local end-to-end flow before merging. Do not merge based only on Keith's summary. The historical credential-removal claim still needs verification in the full Git history, and the PostgreSQL test needs an environment where it can actually run.
- The Team 04 group chat has no newer PM request after Yuki's 00:30 `Ok will do`; no group announcement is required yet. The 8.2 division plan still assigns Huang PM/integration coordination and Security Plan & Innovation, while Keith owns database/schema/storage and Hnin owns assessment method/source confirmation.

## 25. Darli source update and Malaysian-context follow-up (2026-08-09)

- Darli's latest private WhatsApp messages at 20:40 say: `Ive finished adding sources and references with Links` and `But for Malaysian Context, what i need to do?` She has not yet provided the links in the private chat for PM verification.
- The latest Team 04 group message is Yuki's 20:08 reminder: `Finish adding the references for the CPG thresholds`. This is consistent with the outstanding source-confirmation gate; no unrelated group announcement is needed.
- PM follow-up: review Darli's added official links and page references, then ask her to map each Malaysian-context statement to an official Malaysian source (for example, the relevant MOH/DOSM/NHMS publication and page/section) and state what local context is being shown. She should not invent new clinical thresholds, quantiles or risk claims.
- Until Hnin confirms the assessment method and threshold wording, keep the Feature Matrix/CPG material as a working handoff only. Do not update the MVP API, benchmark table or frontend labels from Darli's draft alone.
- A suitable English reply draft for Huang is: `Thanks, that is helpful. For Malaysian context, please link each local statistic or explanation to the official Malaysian source and page/section, and note what user-facing context it supports. Please do not add new clinical thresholds or quantiles. Send me the updated links when ready, and I will check them with the assessment method before we use them.` No private or group message was sent in this check.

## 26. Darli final CPG handoff review (2026-08-09)

- Darli shared `[Final]CPG_Baseline_and_MVP_Scoring` in WhatsApp at 20:47: https://docs.google.com/document/d/1qFraFyIKlvNxrCVAjhyrpZRCAH6_MY-H/edit.
- The document contains direct links to eight Malaysian CPG publications covering hypertension, obesity, type 2 diabetes, dyslipidaemia, heart failure, primary/secondary CVD prevention and ischaemic stroke. Its appendices give page references for the main BP, BMI, glucose, HbA1c, lipid and LDL-C thresholds.
- It documents a clear safety boundary: educational Low/Medium/High categories, no diagnosis or disease-probability claim, confirmation for abnormal asymptomatic results, and clinical-only heart-failure investigations excluded from self-entry.
- It proposes a named Malaysian Framingham CVD method, fallback domain rules and expanded fields such as HDL-C, LDL-C, HbA1c, triglycerides, treatment status and cardiovascular history. These fields and exact rules exceed the current MVP API/database contract and must not be merged automatically.
- PM decision: treat the document as a strong source-and-method handoff, not final clinical approval. Hnin still needs to confirm the assessment method and threshold wording. Before implementation, reconcile the document with the current API/schema, mark any unimplemented fields as future scope, and keep demo placeholders visible.
- No edits were made to Darli's document and no WhatsApp message was sent during this review.

## 27. Malaysian mortality workbook review (2026-08-09)

- Darli shared `cause of deaths_2024.xlsx` (about 1.5 MB) at 20:50. The workbook contains official-looking bilingual tables for Malaysia 2024 and many sections, including: Table 1.1 state + sex deaths/rates; Table 1.2 ethnic group + sex deaths/rates; Table 1.4 state + administrative district + sex deaths/rates; Table 1.9 top causes by ethnic group; and Tables 13.3, 13.5 and 13.7 premature mortality rates by state/district and sex for diabetes/CVD-related context.
- The file supports descriptive filters for state, district, ethnicity and sex, but it does not provide one combined table crossing all four dimensions with four individual HealthFirst risk outputs. It reports population deaths or mortality rates, not an individual's disease probability or assessment result.
- Darli proposed a bar chart based on the user's selected ethnicity, district, state and gender. This can be a useful separate Malaysian-context view, but the current MVP API/form does not collect all of those fields and the chart must not change the personalised assessment.
- Safety/UX conditions before use: label the chart `Population-level Malaysian mortality context`; cite the workbook/publication and table number; do not call counts/rates `personal risk`; do not use the chart to adjust a user's score; avoid causal or predictive claims about ethnicity; and consider suppressing or aggregating small cells if a future view exposes detailed district/ethnicity counts.
- PM decision: keep this as a possible later context visualisation, not a Week 3 release requirement. First confirm the official publication URL and table provenance with Hnin, then decide whether a simple state/sex or district/sex chart is feasible without expanding the MVP schema. No WhatsApp message was sent and the workbook was not added to Git or the shared Drive.

## 28. Scope reply on Malaysian mortality visualisation (2026-08-09)

- Huang replied privately to Darli that the workbook can support a separate population-level Malaysian mortality context chart, but it must not change the personalised assessment or be labelled as personal risk. Because the current MVP does not collect all state/district/ethnicity fields, it is optional for now and should not delay the core MVP or PR #4 review.
- Huang posted the same scope decision in Team 04: prioritise PR #4 review, core MVP tests and Hnin's assessment-method/source confirmation; no raw personal data will be used.
- Darli's workbook remains a possible later context visualisation. If implemented, cite the source/table, keep it separate from scoring, and avoid ethnicity-based causal or predictive claims.

## 29. Su AI/RAG branch clarification (2026-08-09)

- Su asked why later branches do not include the LLM API/RAG action-card work from `feature/benshuai-ai-action-card`.
- GitHub verification: `feature/benshuai-ai-action-card` still exists and its README describes an OpenRouter-backed AI/RAG action card with a rule-based fallback. The branch was last updated on 6 August and has no pull request or merge into `main`.
- The current `main` README explicitly says the action card is still a rule-based placeholder and that no external LLM or RAG service is connected. PR #4 is Keith's database branch only; it is open, has no conflicts, but has not been reviewed or merged.
- Huang replied in Team 04: the AI branch was not lost; later work appears to have proceeded from `main` before the AI branch was merged. Su should keep the branch unchanged until it is reviewed through a separate PR.

## 30. Su main-branch scope confirmation (2026-08-09)

- Su asked whether `main` only contains a frontend/backend skeleton.
- Huang confirmed that `main` includes the reviewed frontend/backend MVP flow, manual confirmed-input assessment API, server-side validation, local SQLite storage and a rule-based action-card placeholder. It does not include the OpenRouter/RAG integration, which remains on Su's separate branch for review.
- The confirmation was sent in Team 04 and delivered. No merge or branch changes were made.

## 31. Member identity and frontend/database handoff (2026-08-09)

- Member identity note: Su is male; Jiang is female. Do not refer to Su as female or Jiang as male in future messages.
- Jiang asked whether the frontend must change because the database may contain additional fields.
- PM decision: additional backend tables or storage columns do not automatically require frontend changes. If the current API request/response contract stays stable and the extra fields are internal or optional, Jiang can keep the current frontend. Frontend changes are needed only if the API introduces required user inputs or new user-facing outputs. Clinical-only fields should remain out of self-entry, and LiHanXia/Keith should confirm the final schema-to-API mapping first.
- Suggested concise English reply to Jiang: `The frontend does not need changes just because the database has extra fields. If the API contract stays the same and the new fields are backend-only or optional, please keep the current form. We only need a frontend update if the API adds required inputs or new user-facing outputs; Keith and LiHanXia should confirm the mapping first.` No message was sent in this check.

## 32. Darli LeanKit acceptance-criteria handoff (2026-08-09)

- Darli reported that AC 2.1.3, AC 2.1.6 and AC 2.1.7 were moved to Done, and asked where to put her completed work for AC 2.1.2 and AC 2.1.4 because their assignment does not list frontend.
- Huang replied that AC 2.1.2 and AC 2.1.4 should remain under their current User Story and be moved to Done with evidence. A separate frontend owner is only needed if the criterion requires a user-facing change; then Qian can add a linked frontend task. Backend/data work stays with its current owner.
- The reply was sent privately to Darli and delivered.

## 36. Data Management Plan draft status (2026-08-09)

- Darli asked whether a Data Management Plan draft already exists.
- Huang checked the workplan and confirmed that there is no separate DMP draft yet. Existing material includes the database/schema notes and a working Security Plan, which can be combined into the mandatory DMP.
- Huang replied privately that the DMP will be structured from those materials and shared once ready. The message was delivered.

## 37. Data Management Plan working draft created (2026-08-09)

- Created the English working draft at `docs/DATA_MANAGEMENT_PLAN.md`.
- The draft covers current MVP scope, data categories, API-to-database flow, the four logical tables (`user_report`, `biomarker`, `health_assessment`, `benchmark`), validation, local SQLite storage, retention, privacy/safety boundaries, responsibilities, release gates and supporting records.
- It clearly marks the document as a working draft. It does not claim PDPA compliance, clinical approval, production security or external AI/RAG integration.
- The draft is ready for team review. No existing Security Plan was deleted or overwritten.

## 38. Darli Malaysian Population Context example (2026-08-09)

- Darli shared an image example of a static `MALAYSIAN POPULATION CONTEXT` panel with one DOSM cause-of-death statistic and NHMS 2023 prevalence figures for hypertension, hypercholesterolaemia, diabetes and overweight/obesity.
- Huang confirmed that this is the right direction for the MVP: keep it as a separate population-level panel, show official source links and data years, and never present the percentages as personal risk. Each percentage still needs source verification before final submission.
- Huang replied privately to Darli and the message was delivered. The panel structure will be reflected in the DMP.

## 34. Malaysian-context MVP display decision (2026-08-09)

- Darli asked whether the Malaysian-context information would be static rather than dynamic.
- Huang confirmed that the MVP can use a fixed, preloaded population-level summary rendered from the approved local dataset. It must not dynamically personalise or change a user's risk result. The source, table and data year should be shown; live filtering remains future work.
- The clarification was sent privately to Darli and delivered.

## 35. Governance-document requirement check (2026-08-09)

- Darli reported that the mandatory governance documents are Database and Data Management Plan, and that security plan, user journey and similar material can be covered within the DMP.
- Huang replied that Database and Data Management Plan should be treated as mandatory. Existing security controls, user journey and data-flow notes can be included in the DMP, but the existing Security Plan will remain as a supporting working document until the official brief confirms it can be removed. No document was deleted.
- The reply was sent privately to Darli and delivered.

## 33. Darli Malaysian-context clarification (2026-08-09)

- Darli confirmed AC 2.1.2 and AC 2.1.4 could move to Done because the CPG draft defines the thresholds, then asked what Malaysian context should show if the user does not enter extra state, district or ethnicity data.
- Huang clarified that the MVP should show a separate population-level summary, such as an official DOSM/MOH national or state/sex cause-of-death rate with source and table reference. It must not change the user's score or be called personal risk. Extra filters remain future work if they expand scope.
- The reply was sent privately to Darli and delivered.

## 39. Official Malaysian causes-of-death PDF handoff (2026-08-10)

- Darli shared `MY Causes of Death 2025.pdf` at 23:59 and asked whether the project can use it with a link.
- PM decision: it can support the Malaysian Population Context panel if the team records a stable public URL, exact table/page, data year and verified wording. The PDF is for population-level context only; it must not change personal scores or be labelled personal risk.
- Huang replied privately that the PDF can be used and linked, with the source details and figures verified before final submission. The message was delivered.

## 40. AI-assisted recommendation acceptance criterion (2026-08-10)

- Darli shared the `Simple Malaysian Context` Google Doc for review and reminded Huang that the current acceptance criteria do not mention AI-assisted recommendations.
- Huang replied privately that Epic 3 will explicitly state the boundary: recommendations are AI-assisted guidance based only on confirmed inputs, approved guidance and visible sources; they must not present a diagnosis or unsupported urgency.
- The canonical `Epics, User Stories.txt` now includes `US3.1 AC7 — AI-assisted recommendation boundary` and records that the current `main` branch still uses a rule-based action-card placeholder pending final AI/LLM integration and review.
- LeanKit card `AC 3.1.6. Display Educational Disclaimer` was updated with the same AI-assisted boundary and the rule-based-placeholder note; its existing owner, dates and parent card were kept unchanged.
- This is a requirements and safety clarification, not a claim that the AI integration is already implemented.

## 41. Epic and User Story wording review (2026-08-10)

- Darli said she will review the Epic and User Story names after mentor feedback that they should reflect the user's pain rather than sound like feature labels.
- Huang replied that this is the next priority, but only the wording should change. IDs, acceptance criteria, owners, dates and implementation tasks should remain unchanged, and the proposed wording should be checked before updating LeanKit.
- No implementation scope or current backend/frontend work is being changed by this wording review.

## 42. Week 3 PR #4 review and team reminder (2026-08-10)

- Keith's latest private message said the database changes were done and asked for another review. Darli's latest private message was `sure will do` after the Epic/User Story wording discussion; no further reply was needed from Huang.
- GitHub PR #4 was checked again. It is open and marked ready to merge with no conflicts, but GitHub reports zero automated checks. The changed-files view still shows a tracked `.DS_Store` file (including `frontend/js/.DS_Store`), so the PR is not ready to merge.
- The PR description says the credential was rotated and removed from `backend/app/db.py`, but full-history cleanup and the opt-in PostgreSQL test still require verification before merging. The risk-score logic remains a labelled demo placeholder pending Hnin's method confirmation.
- Huang posted a new Team 04 reminder: remove the remaining system file, confirm the credential is absent from the full Git history, keep working from `main`, and wait for the backend/frontend and local end-to-end checks before merging PR #4.
- The available local Python runtime does not include `pytest`; a compile-only smoke check on the existing local review snapshot passed, but this is not evidence that PR #4's full test suite passes.

## 44. Latest communications and repository check (2026-08-10)

- WhatsApp audit: Team 04 has no newer group message after Huang's PR #4 blocker reminder. Keith's private chat still ends with his earlier `Done the changes, please help review again`; Darli's private chat still ends with `sure will do`; Jiang has not replied to the Studio 1 role-planning message yet.
- GitHub audit: the repository has one open pull request, PR #4 (`Feature/junnkeith db integration`), plus three closed pull requests. PR #4 remains at 11 commits and 22 changed files with zero automated checks. GitHub reports no merge conflicts and a technically mergeable state, but the PM review gate remains blocked by the tracked `.DS_Store`, unverified full-history credential cleanup and missing verified test evidence.
- No duplicate WhatsApp reply or new group reminder was sent during this audit. Huang's next actions are to wait for Keith's corrected PR head, rerun the required tests, and assign Studio 1 roles when the exact schedule is posted.

## 45. Studio 1 and showcase clarification (2026-08-10)

- New Team 04 group messages: Su asked whether onboarding usability testing is required and which Applied/Studio session the team presents in this week. Yuki noted that the app and Data Management Plan should be ready today, mentors will conduct acceptance testing in Studio 1 tomorrow, and the team retrospective recording is due Thursday. Su also asked whether PM can merge the branches so the website can be deployed.
- PM clarification sent to Team 04: TM04 is paired with TM03 for the peer usability test; the test must be completed and recorded for the PGP during Studio 1. Studio 1 also covers mentor acceptance testing, the retrospective and stand-up demo. The current notice says Friday Studio 2 is the showcase, with a maximum of 8 minutes plus 10 minutes Q&A, subject to any updated official slide.
- PM release rule repeated: Huang will merge and deploy only after the PR review and required checks pass. The team should prioritise today's build/DMP and continue using feature branches.

## 46. Week 3 build/DMP handoff and Studio 1 role split (2026-08-10)

- Updated `docs/DATA_MANAGEMENT_PLAN.md` with a Week 3 build-submission and Studio 1 handoff section. It records the safe local synthetic-data build flow, localhost run ports, the SQLite-only demo boundary, the PR #4 release gate, the demo/rule-based placeholder wording, the remaining backlog items, readiness owners and the TM03 peer-usability evidence requirement.
- DMP status remains a working draft. It does not claim PDPA compliance, clinical approval, production security, public deployment or approved thresholds. The PostgreSQL/Render path remains blocked until PR review, tests and credential-history checks are complete.
- Proposed Studio 1 peer-usability roles for the TM03 pairing: Qian—demo/navigation; LiHanXia—user-flow and API handoff; Su—recording/evidence; Huang—timing, PGP notes and Q&A. Keith supports database questions, Benshuai supports action-card questions, and Hnin/Darli support source/method questions.
- A concise English role assignment was sent to Team 04. The message asks members to confirm the split and add the official Studio 1 room/time when posted.
- Verification completed on the local PR3 review snapshot: Python backend compile check passed and the frontend validation test passed. Full `pytest` and the PR #4 branch were not independently verified because the local Python environment lacks `pytest` and the PR branch could not be fetched in this environment. No merge or deployment was performed.

## 47. PR #4 latest update review (2026-08-10)

- GitHub PR #4 now has 12 commits and 21 changed files. The newest visible commit is `61012aa Delete frontend/js/.DS_Store`. The changed-file list no longer contains a tracked `.DS_Store`; the remaining `.DS_Store` entries are ignore rules in `.gitignore`.
- GitHub reports `Ready to merge`, no conflicts with `main`, and a visible `Merge pull request` button, but still shows `Checks (0)`. This is mergeability, not evidence that the tests passed.
- The PR description says the credential was rotated, the PostgreSQL benchmark table and integration test were added, and the risk rules remain labelled placeholders. Full credential-history cleanup and the PostgreSQL test result remain team claims that Huang has not independently verified.
- A source inspection of the latest branch's `backend/app/db.py` found a build blocker: it sets `DATABASE_URL = os.environ.get("DATABASE_URL")` and immediately calls `DATABASE_URL.startswith(...)`. When `DATABASE_URL` is unset, the documented local SQLite fallback will fail before the app starts. Keith must restore an explicit SQLite fallback or otherwise guard the unset value before the PR can be accepted for the local build.
- PM decision: do not merge or deploy PR #4 yet. Ask Keith to fix the local fallback, then rerun backend tests and the manual frontend-to-API flow from a clean environment. The PR page was left open for handoff; no merge action was taken.

## 43. Studio 1 peer usability-test planning (2026-08-10)

- Jiang shared two Studio 1 notice images in private chat and said the activity needs to be assigned because it may happen on Tuesday:
  - [Photo 1](C:/Users/huangguan/Desktop/FIT5120/workplan/.codex-remote-attachments/019fbe2c-987d-7b52-a3af-b2e3884bd6f6/531f5b35-2e29-4d45-92e4-96a8e19d09bd/1-Photo-1.jpg) lists the Studio 1 agenda: retrospective and stand-up demo, onboarding build review/mentor acceptance test, and a team peer-review usability video. It states that each team tests one other team and records the usability test in the team's PGP. The pairing table shows TM03 paired with TM04.
  - [Photo 2](C:/Users/huangguan/Desktop/FIT5120/workplan/.codex-remote-attachments/019fbe2c-987d-7b52-a3af-b2e3884bd6f6/531f5b35-2e29-4d45-92e4-96a8e19d09bd/2-Photo-2.jpg) says the onboarding presentation is in person, no longer than 8 minutes plus 10 minutes Q&A, and that the product demo, timing and participation should be prepared. The exact venue/time is still to be updated.
- PM interpretation: Team 04 needs a small role split for the TM03 peer usability test: demo/navigation, user-flow explanation, recording, and PGP/Q&A notes. The exact Tuesday schedule and names are not confirmed yet.
- Huang replied privately to Jiang that he checked the notice, confirmed the TM03 pairing and Studio 1 activities, and will coordinate the four roles after the exact time is posted. The reply was delivered.

## 48. Studio 1 Q&A notes shared (2026-08-10)

- Darli asked whether short notes or Q&A could be shared before the Studio 1 session so everyone could prepare. Huang replied in the Team 04 group that he would share them.
- Huang then shared concise English Q&A notes covering the problem, current demo flow, confirmed-input safety boundary, rule-based action-card placeholder, synthetic data, HTML/CSS/JavaScript + Python/FastAPI + local SQLite stack, PR #4 review status, out-of-scope OCR/no-screening work and the usability-test focus.
- The notes tell the team to use `main` for the Studio 1 demo and record questions or usability issues from TM03. The message was delivered; no claim was made that PR #4 or final AI/LLM logic is already integrated.

## 49. Darli frontend stability clarification (2026-08-10)

- Darli asked privately whether the frontend was stable because she could not see the latest changes in the live demo.
- Huang confirmed that the current frontend flow on `main` is stable for the local MVP demo and that client-side validation passed. PR #4 frontend/database changes are not merged, and no deployed live demo is available yet.
- Huang told Darli to use `main` for the Studio 1 demo. The reply was delivered; no claim was made that the unmerged PR or a public deployment is ready.

## 50. Build deadline and variable-scope clarification (2026-08-10)

- Darli reminded Huang that the Week 3 build requires a deployed web link or downloadable executable by Monday 11:55 PM. She also asked whether her broader variable set for personalised assessment would be used instead of the smaller current demo set.
- PM decision: use Darli's file as the source for the full target variable set, but deploy only variables already implemented and tested in the MVP. Remaining variables must be labelled as pending schema/API integration; the deployed build must not overclaim functionality.
- Huang replied privately that the deployed link is the immediate priority and that Darli's file will be mapped into the next build. The reply was delivered. This does not authorise merging or deploying the unreviewed PR #4.

## 51. Build deadline group reminder (2026-08-10)

- Team 04's latest group messages showed Su asking whether onboarding materials should go into the PGP folder and then offering to place them there. No deployed-link status or blocker had been posted by the team.
- Huang sent a concise group reminder that the deployed build link is due by 11:55 PM, members should report status or blockers, `main` should be used for the validated MVP, PR #4 remains under review, and project-specific evidence belongs in the PGP folder while course-wide guidelines stay separate.
- Huang confirmed Su's filing question: project-specific onboarding files should go in the PGP folder; general course guidelines should remain separate. Both messages were sent successfully.

## 55. Week 3 deadline coverage check (2026-08-10)

- Group audit found that the build deadline reminder, PGP filing guidance and DMP threshold update had been sent, but the remaining Tuesday/Thursday/Friday Week 3 deadlines had not been listed together.
- Huang sent a concise reminder covering Tuesday Studio 1 (mentor acceptance, TM03 peer usability test, stand-up demo and retrospective with PGP evidence), Thursday 11:55 PM Team Reflection Video, Friday OB Showcase (maximum 8 minutes plus 10 minutes Q&A), and Friday 11:55 PM Retrospective and e-Portfolio submission.
- The message asks members to confirm their role or blocker. It was sent successfully; no duplicate build reminder was added.

## 56. Branch organisation and PGP recording clarification (2026-08-10)

- Su asked Huang to organise the branches because Keith had updated a branch and the team needs a complete branch for deployment. The group also asked why the generic PGP guide does not mention recording the usability test.
- GitHub check: `feature/junnkeith-db-integration` is PR #4 with 12 commits, no conflicts with `main`, and zero automated checks. It is not a deployment candidate yet. The current safe demo baseline remains `main`.
- PM branch order: Keith confirms the SQLite fallback fix and test result; LiHanXia verifies the API flow; Huang reviews the PR and merges only after the gate passes; deployment then comes from the reviewed `main`. No merge or deployment was performed.
- Huang clarified in the group that the recording requirement comes from the official Studio 1 notice: TM04 must record the TM03 peer-usability evidence and place the link in the PGP, even if the generic PGP guide does not show that line. The message was delivered.

## 57. Keith fallback fix and checks status (2026-08-10)

- Su asked in the group what happened to the checks after Keith updated the branch. Keith reported that he pushed the local SQLite fallback fix and tested values when no credentials are present.
- GitHub PR #4 was rechecked: it now has 14 commits and remains `Ready to merge` with no conflicts, but `Checks (0)` is still shown. The new commit `8cc242d` changes `DATABASE_URL` to default to `sqlite:///./healthfirst.db`; merge commit `69a4f10` follows it.
- PM interpretation: the specific startup blocker appears addressed in the branch, but the checks are not evidence of a passing test suite. Manual backend/frontend/API verification is still required before merging or deploying.

## 58. PR #4 merged after explicit PM instruction (2026-08-10)

- After Keith pushed the SQLite fallback fix, Huang rechecked PR #4. GitHub showed 14 commits, no conflicts and `Checks (0)`; the new fallback commit was `8cc242d` and the following merge commit was `69a4f10`.
- At the user's explicit instruction to merge according to the group request, Huang clicked GitHub's `Confirm merge`. GitHub then showed `Merged` and `Pull request successfully merged and closed`, with 14 commits merged into `main`.
- The merge is not evidence that the automated checks passed. Next action is manual backend/frontend/API verification from the updated `main` before any deployment claim. The fallback fix must still be tested in the clean local environment.

## 59. PR #4 merge and deployment handoff (2026-08-10)

- Su asked Huang to try the merge because the team expected some code and logic changes to be needed, then noted that a suitable deployment platform still had to be found.
- Huang merged PR #4 into `main` through GitHub after the explicit user instruction. GitHub confirmed the pull request was successfully merged and closed.
- Huang posted the group handoff: PR #4 is merged after the SQLite fallback update, GitHub still shows `Checks (0)`, the team should pull the updated `main`, and manual backend/frontend/API checks must run before deployment.
- Deployment remains pending; no platform, credentials, public URL or production claim has been created.

## 52. Darli threshold-documentation clarification (2026-08-10)

- Darli clarified that the MVP personalised-assessment threshold set may differ from the broader method in her file, and asked that the distinction be documented.
- Huang agreed: the current MVP will be described as using a separate illustrative threshold set, while Darli's file is the broader target method. The deployed build must label MVP thresholds as placeholders and show the method/source boundary clearly.
- The clarification was sent privately and delivered. It does not approve unsupported clinical thresholds or change the release gate for PR #4.

## 53. MVP threshold traceability added to DMP (2026-08-10)

- Darli said the mentor had asked how the thresholds are calculated and that she lacked supporting notes because the current MVP differs from her broader method.
- Huang replied that he would add the current MVP variables, illustrative threshold logic, calculation notes and the difference from Darli's method to the DMP, without presenting placeholders as approved clinical rules.
- Added `## 13. MVP variable and threshold traceability` to `docs/DATA_MANAGEMENT_PLAN.md`. It records the current fields, local fallback cut-offs, BMI formula, optional-field boundary, comparison-label distinction, PR #4 PostgreSQL caveat and the pending status of Darli's broader method.
- No code or threshold implementation was changed; this is documentation and release-boundary work only.

## 54. Acceptance-test preparation (2026-08-10)

- Darli asked whether the threshold notes belong in the DMP or a separate document, reminded Huang that the acceptance criteria must be tested after the Professional Experience class for tomorrow's Studio, and asked whether the AI-integration criterion was fixed.
- Huang confirmed that the threshold notes are in the DMP, AC7 covers the AI-assisted recommendation boundary, the current rule-based action card remains labelled as a placeholder, and the team should execute and record the acceptance tests after class.
- Added `docs/ACCEPTANCE_TEST_CHECKLIST.md` with eight test cases covering the manual flow, validation, BMI recomputation, source/limit wording, AI boundary, accessibility, failure recovery and PGP evidence. All results remain pending execution; no pass claim was made.

## 60. Su asked about GitHub checks (2026-08-10)

- Su asked what “Checks (0)” means on PR #4 after the merge update.
- Huang replied in the Team 04 group: GitHub Checks are automated CI/test results; “Checks (0)” means that no automated checks were reported, not that the code failed. Manual backend, frontend and API checks still need to be run before deployment.
- The reply was delivered at 19:41. No new merge or deployment action was taken in this exchange.

## 61. Manual backend/frontend/API verification (2026-08-10)

- Manual verification used a clean worktree from merged `main` at commit `a2e34d3` (PR #4 merge). No source files were changed during testing.
- Backend test suite: `37 passed, 1 skipped, 13 warnings`. Frontend validation suite: `58 passed, 0 failed`; the test file was run through a non-mutating CommonJS VM harness because the workspace `package.json` marks `.js` files as ES modules while the legacy test uses `require`.
- API checks passed: valid synthetic payload returned 200; server recomputed a tampered BMI of 99 to 27.0; missing/invalid fields returned 400; CORS preflight from `http://localhost:8000` returned 200; SQLite contained `user_report`, `biomarker` and `health_assessment`, with no persisted `action_card` table.
- Browser flow passed on local services: entry → review → confirmation gate → results. Results displayed source labels, “not a diagnosis”, synthetic-demo wording and the clinical-validation release limitation. Unticked confirmation blocked progression as required.
- Failure recovery passed: after stopping the backend, the frontend kept the entered data and showed “Sorry — the assessment service is unavailable right now. Please try again.” The backend was then restarted and returned 200 for `/docs`.
- Release boundary remains unchanged: no public deployment was created; demo thresholds and the rule-based action card remain placeholders; use synthetic data and local storage only until approved methods, final AI logic and security controls are confirmed.

## 62. Project development strategy rule added (2026-08-10)

- Added the project-level `AGENTS.md` at the workplan root. It now defines the Team 04 strategy: integrate reasonably safe work first, run the complete system, fix concrete integration problems, and deploy as early as practical.
- `Checks (0)` alone is not a merge blocker. Serious blockers remain secrets, non-running code, critical bugs, destructive database changes, major API incompatibility and clearly breaking changes.
- The rule also requires preserving a rollback point before important demos or submissions and keeps the synthetic-data, placeholder-threshold and local-only safety boundary explicit.

## 63. PM communication rule added (2026-08-10)

- Extended the project-level `AGENTS.md` with “PM Communication Rule: Facilitate, Don't Gatekeep”. Future group messages, PR reviews and merge notices should use collaborative, progress-oriented wording by default.
- Gatekeeping language is reserved for concrete serious blockers. If a blocker exists, messages must state the problem, minimum required fix and next action. If no serious blocker exists, default to quick review, merge and integrated testing; `Checks (0)` alone is not a reason to block.

## 64. Jiang privacy fix and Su action-card integration (2026-08-10)

- Latest Team 04 messages showed Jiang had finished revising the privacy wording and Su asked for `feature/benshuai-ai-action-card` to be merged. GitHub had no open PR for either branch.
- Reviewed the remote branches. Jiang's `fix/privacy-notice-accuracy` was one commit ahead and merged cleanly. Su's action-card branch was behind `main` and conflicted in the README files, so an integration branch preserved the current port-5001/Render notes together with the AI/RAG documentation and resolved the documentation conflict without changing the API shape.
- Created PR #6, `Integrate privacy notice and AI action card updates`, from `integration/jiang-privacy-su-action-card`, then merged it into `main` after review. GitHub showed no merge conflicts; `Checks (0)` was treated as no configured CI, not as a failure. The resulting `main` merge commit is `74f9524`.
- The merged UI now states `Not saved until you confirm` before confirmation, explains the storage boundary on the review screen, and shows `SAVED TO LOCAL DEMO DATABASE` after confirmation. Su's action card keeps the `{heading, items, disclaimer}` shape, uses Malaysian context retrieval and falls back safely when OpenRouter is unavailable. No API keys were committed and no public deployment was claimed.
- Post-merge verification on `main`: backend `42 passed, 1 skipped`; frontend validation `58 passed`; persistence-copy regression check passed; `git diff --check` passed. The remaining release boundary is synthetic data, local/demo storage and controlled provider testing only.
- Sent a concise Team 04 group update with the PR #6 merge result, test totals, conflict resolution and the instruction to pull `main` and continue with synthetic data only. The message was delivered at 21:41.

## 65. PR visibility clarification (2026-08-10)

- A later GitHub check showed that Su did create PR #5, `Add Benshuai AI RAG action card`, from `feature/benshuai-ai-action-card`. It was merged into `main` when the integration commit from PR #6 included Su's commit, so the PR is now listed under Closed/Merged rather than Open.
- The earlier `0 Open` view was therefore a timing/filter issue: at the first check the branch existed, but the PR had not yet appeared in the open list or the page had not refreshed. A pushed branch and an open PR are separate GitHub objects.
- Current repository state has one open PR, Jiang's #8 `fix: storage-location wording — drop "local", correct the README port`. Other remote branches such as Hnin's `analysis` and LiHanXia's backend branch are present, but they do not currently have an open PR listed. This means their changes need a PR or an explicit integration step before they are treated as reviewed work.

## 66. Jiang follow-up after PR #6 (2026-08-10)

- In the Team 04 group, Jiang posted three copy/documentation fixes on top of PR #6: corrected the README port to 5001, removed four claims that the database is always local because `DATABASE_URL` can point to Render PostgreSQL, and changed the results wording to `SAVED TO THE DEMO DATABASE`. She also updated `persistence-copy.test.cjs` and reported frontend validation plus 1440px/430px screen checks passing.
- In private chat, Jiang flagged a remaining security-documentation mismatch: `SECURITY_PLAN.md` still says External AI/RAG is not connected, while `action_card.py` can send assessed values to OpenRouter when `OPENROUTER_API_KEY` is configured. The screen-2 notice does not mention a third party. With no key configured the safe fallback is used, but this must be logged and resolved before enabling external AI or claiming deployment readiness.
- Jiang's latest work is PR #8, currently open. PM next action is to review/merge the copy fix, then decide whether the demo keeps OpenRouter disabled or update the security plan and privacy notice before any provider test.
- Replied to Jiang privately at 22:01: PR #8 will be reviewed; the current demo will keep OpenRouter disabled and use the fallback; security wording will be updated before any external AI test.

## 67. PR #8 and security-boundary follow-up (2026-08-10)

- Lightweight review of Jiang's PR #8 found no serious blocker. It corrected the README port, removed inaccurate always-local storage wording and aligned the persistence-copy test. The PR was merged into `main`.
- Added docs-only PR #9 to align `SECURITY_PLAN.md` with the configured demo database (SQLite by default, PostgreSQL when `DATABASE_URL` is set) and to state that External AI/RAG is disabled by default. The PR was merged into `main`.
- Latest `main` is `bca24da`. Post-merge checks passed: backend `42 passed, 1 skipped`; frontend validation `58 passed`; persistence-copy check passed; `git diff --check` passed.
- OpenRouter remains disabled by default. The demo continues to use synthetic data, and no real health data or provider key should be used without the required security/privacy review.
- Sent the concise merge and safety-boundary update to the Team 04 group at 22:12. Team members should pull the latest `main` before continuing.

## 69. Free Render deployment (2026-08-10)

- Connected Render to the private GitHub repository with the GitHub App limited to `healthfirst-team04-mvp` only.
- Created the Hobby-plan Free Web Service `healthfirst-team04-api` from `main` at `bca24da`.
- Render configuration: Root Directory `backend`; Build Command `pip install -r requirements.txt`; Start Command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; Python 3 runtime. No `OPENROUTER_API_KEY` or `DATABASE_URL` was set, so the service uses the rule-based fallback and default SQLite demo storage.
- Deployment completed successfully and is live at https://healthfirst-team04-api.onrender.com. `/docs` returned HTTP 200; a synthetic `POST /api/assess` returned HTTP 200 with four indicators, three fallback action-card items and the non-diagnostic disclaimer. CORS preflight from `http://localhost:8000` returned HTTP 200.
- Render Free instances may spin down after inactivity and do not provide persistent disks. No real health data should be used; the service remains a demo deployment only.

## 68. Studio 1 preparation and peer-test clarification (2026-08-10)

- Darli clarified that Team 04 does not need to record usability testing of its own project. Tomorrow's peer usability/acceptance test is for the designated team TM03, and that recording should be placed in the PGP.
- Prepared the bilingual `STUDIO_1_PM_BRIEF_2026-08-11.md` with the PM stand-up script, Chinese explanations, demo handoff, TM03 test roles, evidence checklist, safety boundaries and likely mentor answers.
- Exported the highlighted bilingual PDF `output/pdf/STUDIO_1_PM_Brief_2026-08-11_Bilingual.pdf`; visual review covers all 7 A4 pages and the extracted text contains both Chinese and English.
- The brief keeps the current boundaries visible: synthetic data only, OpenRouter disabled, illustrative thresholds, OCR/upload in the backlog, and no diagnosis or production-security claim.

## 70. Render status shared with Team 04 (2026-08-10)

- Sent a concise group update confirming that the FastAPI backend Web Service is live at https://healthfirst-team04-api.onrender.com from `main` using `backend/requirements.txt` and the Uvicorn `$PORT` command.
- The frontend Static Site and PostgreSQL service are not set up yet. `OPENROUTER_API_KEY` remains disabled; the team should use synthetic data only.
- After the update, the latest group messages contained Su's earlier three-part deployment proposal and branch-based workflow, plus Yuki's offer to run acceptance tests. No new blocker or urgent request appeared, so the next step is to coordinate the frontend/database deployment plan and acceptance testing rather than send another message immediately.

## 71. Deployment branch and three-part Render setup (2026-08-10)

- Followed Su's branch-isolation proposal. Created and pushed `codex/render-deploy` from the latest `main`; Render backend and frontend services now deploy from this branch. Future changes can stay on their original feature branches and be merged or cherry-picked into the deployment branch after review.
- Added a small deployment integration change: non-local frontend pages call the Render API by default, and backend CORS accepts the static-site origin through `FRONTEND_ORIGINS` while retaining localhost defaults.
- Render services: `healthfirst-team04-api` (Free Web Service), `healthfirst-team04-frontend` (Free Static Site at https://healthfirst-team04-frontend.onrender.com), and `healthfirst-team04-db` (Free PostgreSQL, Oregon). `DATABASE_URL` is stored only in Render; `OPENROUTER_API_KEY` remains unset.
- The first PostgreSQL smoke test exposed the missing `public.benchmark` table. The deployment branch now bootstraps the five illustrative benchmark rows when the table is absent; this is not a clinical approval and remains demo-only.
- Verification: local backend `43 passed, 1 skipped`; Python compile check and `git diff --check` passed; Render CORS preflight allowed the static origin; synthetic `/api/assess` returned HTTP 200; the deployed browser flow completed entry → review → confirmation → results and showed `SAVED TO THE DEMO DATABASE`.
- The Free PostgreSQL instance is temporary and expires on 2026-09-09 unless upgraded. No real health data should be used, and the deployment branch should be reviewed before merging back to `main`.

## 72. Deployment PR integrated (2026-08-10)

- Reviewed PR #10 (`Prepare Render deployment branch`): no merge conflicts or serious blocker; merged the two deployment commits into `main` at GitHub. Render services remain pointed at `codex/render-deploy` so deployment configuration can continue independently and be changed without treating `main` as the live deployment switch.
- Sent the Team 04 group the two live URLs, the PostgreSQL linkage boundary, the benchmark-table fix, the successful deployed flow and the instruction to pull `main`. The message was sent at 23:37.
- A pre-existing remote `deployment` branch from Qian (`df8afbe`) was also present but based on an older `main`; it was left untouched. The fresh `codex/render-deploy` branch was based on the latest `main` so the deployment did not overwrite a teammate's branch.

## 73. OpenRouter key handling for class demo (2026-08-10)

- Huang reported that Su shared an OpenRouter API key. The key has not been entered into chat, Git, local files or Render; `OPENROUTER_API_KEY` remains unset.
- The current fallback demo is already working end to end. Enabling the key would send confirmed health values and retrieved Malaysian context to OpenRouter, while the current UI does not explicitly disclose that third-party transfer and the action-card normaliser does not block unsafe medical wording.
- Recommendation for the class demo: keep the key disabled, use synthetic data and demonstrate the stable fallback. If the team later enables the provider, enter it only as a Render secret, add explicit third-party disclosure and safety checks, then run a provider test before using it.

## 74. DMP traceability addendum and current group request (2026-08-11)

- The latest Team 04 group message asked Huang to provide the database and deployed links in the shared submission document. It also said the Data Management Plan can be added to the folder after the main deliverables if time is limited.
- Added a `Team 04 – Week 3 delivery links` section to the shared `HealthFirst OB Project Development` document: https://docs.google.com/document/d/1KOTsJmRwuE3Uw2WsIKhaTNvRQHizuaywMNhx-v0moCo/edit?tab=t.0. It includes the GitHub repository, deployed frontend, backend OpenAPI page and DMP link, and explains that the Render database is private with no credential included.
- Darli's earlier request was to record the current MVP variables, illustrative threshold logic, BMI calculation, the difference from her broader assessment method, and source/threshold traceability in the DMP rather than a separate document.
- Added a dated English `PM addendum – MVP assessment method and threshold traceability` to the shared Google DMP: https://docs.google.com/document/d/1rnSL3anbY3Fy57fDS0uv8LfX4dCqK2AsdFahODCOOEw/edit?tab=t.0. The document shows `Saved to Drive` and the addendum search returns `1 of 1`.
- The addendum keeps the current fields and fallback boundaries explicit, marks Darli's broader variables as future scope pending Hnin's confirmation, and separates Malaysian population context from personal assessment.
- The current Render backend now has an OpenRouter key configured by the user. The key is not recorded here, in GitHub, or in WhatsApp. The DMP states that only synthetic data may be used and that third-party transfer disclosure and unsafe-output checks are still required before real-data use.

## 75. PR #11 safety review (2026-08-11)

- Reviewed PR #11 (`copy: remove demo wording, refresh population context, cite MOH CPGs`) from `qjia0033-dev`. GitHub shows 3 commits, 9 files changed, no merge conflicts and `Checks (0)`.
- The code and copy changes are not ready to merge because they remove the synthetic/demo and clinical-validation notices while the threshold rules remain illustrative. The current confirmation screen also does not disclose third-party transfer when the configured OpenRouter key is used.
- Posted a constructive PR comment naming the specific blocker and the minimum fix: restore a clear demo/clinical-validation notice, add third-party AI disclosure while the key is enabled, rerun copy tests, then merge and test the integrated flow.
- PR #11 remains open; no merge was performed.

## 76. Darli submission-link clarification (2026-08-11)

- Darli said in Team 04 that the backend link is not needed for the submission because the GitHub repository is already provided and the direct backend endpoint is showing an error.
- Huang replied in the group that this is reasonable and that the submission can keep the GitHub repository, deployed frontend and DMP links. No backend credential or private database URL was shared.
- Updated the shared submission document to remove the backend/OpenAPI link and fill the two existing placeholders with the deployed frontend URL and GitHub repository URL. Added a short submission-link note to the DMP explaining that the backend URL is technical reference only.

## 77. PR #11 merged after safety-copy fix (2026-08-11)

- Re-reviewed the updated PR #11 after commit `70bd305` restored the synthetic-data prompt, clinical-validation notice and explicit external-AI-provider disclosure on the confirmation screen. The CPG note now also states that the applied thresholds are illustrative and not clinically validated.
- Verification from the PR branch: backend `43 passed, 1 skipped`; frontend validation `58 passed`; persistence-copy checks passed; no credential-like additions; `git diff --check` passed.
- GitHub showed no merge conflicts and `Checks (0)`, which was not treated as a blocker. PR #11 was merged into `main` at commit `63821d7` and closed successfully.

## 78. Latest frontend copy branch merged (2026-08-11)

- Reviewed `copy/remove-demo-wording` against `main`: commits `8dc2310`, `3b4379b` and `cd81f53`; changes were limited to fasting-status copy, the results-page status legend, CSS and its copy test.
- Verification: backend `43 passed, 1 skipped`; frontend validation `58 passed`; persistence-copy check passed; `git diff --check` passed; no credential-like additions or serious API/database changes were found.
- Created PR #12 and merged it into `main` at commit `919980d6`. The PR closed successfully with no merge conflicts. The branch was left available and was not deleted.

## 79. Render deployed acceptance test (2026-08-11)

- Tested only the Render deployment with synthetic values (`128/82`, `5.4`, `6.2`, `170`, `78`). The detailed report is `docs/DEPLOYED_ACCEPTANCE_TEST_REPORT_2026-08-11.md`.
- API evidence: `/openapi.json` 200; root 404 expected; valid assessment 200; missing/invalid glucose 400; tampered BMI still returned 27.0 from height and weight. Fasting and random requests produced the same demo statuses, confirming that context is recorded-only for now.
- Frontend evidence: entry, validation, review, edit, confirmation gating and results completed. Malaysian context, source labels, demo wording, non-diagnosis wording and four shape/text statuses were visible.
- Deployment drift found: Render frontend is still serving `codex/render-deploy@2c44177`, while `main` is `919980d`; the deployed page lacks PR #12's status legend and latest copy. The deployed confirmation copy also lacks an explicit third-party AI disclosure. This is a pre-demo follow-up, not a claim that real data is safe to use.

## 80. Render switched to main and post-redeploy review (2026-08-11)

- Switched both Render services to `main` and confirmed live deployments at commit `919980d` (PR #12 merge). Backend: https://healthfirst-team04-api.onrender.com. Frontend: https://healthfirst-team04-frontend.onrender.com.
- Re-ran the deployed synthetic-data flow through entry, review, confirmation and results. The confirmation page now includes the external-AI-provider disclosure when AI-assisted recommendations are enabled and keeps the sample-data-only boundary visible.
- Results now include the status legend, Malaysian context, source labels and non-diagnosis wording. Expanded benchmark evidence displays `HealthFirst benchmark reference set.`; the old `Render Benchmark table (Team 04)` sentence is no longer present.
- Remaining demo limits: illustrative thresholds, pending clinical method/final AI approval, synthetic data only, and possible Free-plan wake-up delay. No production safety or privacy claim is made.

## 81. Darli test-result handoff and Tuesday demo page (2026-08-11)

- Sent Darli a private English update confirming both Render services are live from `main@919980d`, the synthetic-data flow passed through results, the external-AI disclosure and status legend are present, and the old Team 04 benchmark sentence is gone.
- Left the latest deployed frontend open at https://healthfirst-team04-frontend.onrender.com for Tuesday's assessment. The page is reset at Step 1 and ready for synthetic demo values.

## 82. Darli AI, product-value and security explanation (2026-08-11)

- Replied to Darli privately in English. Confirmed that OpenRouter output may vary slightly at temperature 0.3, while the fallback card is deterministic; explained HealthFirst's validated-input, server BMI, source-labelled Malaysian-context and bounded action-card workflow; and described the current security boundary and missing production controls.
- Also clarified that MOH CPGs are reference sources, while the applied thresholds remain illustrative and not clinically validated.

## 83. LeanKit stage and EPIC 3 evidence check (2026-08-11)

- Checked the current LeanKit list. All visible AC cards are in `Started` / `Iteration 1`: AC1.1/1.2 under Qian, AC2.1/2.2 under Hnin/Su/Guan, and AC3.1.1-3.1.3 under Su. No visible AC3.2.1-3.2.5 cards were found, so they have no stage or assignee yet; no statuses were changed.
- Re-ran the deployed synthetic-data flow. The current action card connects actions to BMI/glucose, blood-pressure/glucose logging, movement for weight/heart health, and diet for cholesterol/blood sugar. It says to arrange a follow-up with a doctor or pharmacist; result cards say “Worth raising at your next check-up”; no unsupported urgency or diagnosis appeared.
- Sent Darli the evidence and marked the relevant criteria as partial/pass with the illustrative-threshold limitation. Asked her to confirm the intended wording for AC3.2.5 because the source Epic/User Stories file currently lists US3.2 AC1-AC4 only.

## 84. Darli requests screenshots before Studio (2026-08-11)

- Darli explicitly asked for screenshots of the deployed app because she could not find the evidence, and said that criteria without real app evidence should be removed before Studio.
- Current evidence exists on the results page for the action-to-finding links, next-check-up wording, doctor/pharmacist follow-up and non-diagnosis boundary. Do not delete cards yet; first capture the relevant screens and confirm the exact AC3.2 wording.

## 85. Screenshot evidence sent to Darli (2026-08-11)

- Sent three screenshots from the deployed frontend using synthetic data: Malaysian population context and sources; indicator statuses/legend and non-diagnostic boundary; and the action card showing doctor/pharmacist follow-up, finding-linked actions and disclaimer.
- Clarified that the doctor/pharmacist follow-up is visible evidence for the related EPIC 3 criterion, while AC3.2.5 is still not present in the current LeanKit/source list.
- Asked Darli to confirm whether AC3.2.5 should be added/renamed or removed before Studio. No LeanKit card was deleted.

## 86. Darli clarified EPIC 3 criteria (2026-08-11)

- Darli supplied the missing AC3.2.5 wording: prevent unsupported urgency or diagnosis. She said the current demo does not fully meet the approved urgency-rule description.
- Darli revised the AC3.2.4 heading from “Recommend Qualified Professional Consultation” to “Advise Qualified Professional Consultation” because the app advises speaking with a doctor/pharmacist but does not direct users to a specific clinic.
- Huang replied that AC3.2.5 should not be claimed as Passed, and should be marked Partial/Not met until the team agrees whether to remove it or retain it as a documented limitation. The LeanKit card was left unchanged.

## 87. LeanKit stand-up preparation (2026-08-11)

- Read the current LeanKit Board List View. All visible AC cards are marked `Started`; visible planned dates run from 8/5-8/9. Qian owns AC1.1/1.2, Hnin owns most AC2.1/2.2, Benshuai owns AC2.1.1/2.1.5 and AC3.1.1-3.1.3, and Guan owns AC2.1.8. No AC3.2 cards or Keith-owned database card are visible in the current list.
- Stand-up message should report the visible board facts without calling Started cards Done, flag the missing AC3.2/Keith tracking as board gaps, and ask owners to confirm evidence before moving cards to Finished.

## 87. Render PostgreSQL credential configured (2026-08-11)

- Set the existing Render backend environment variable `DATABASE_URL` to the PostgreSQL credential supplied by Huang. The credential was entered only in Render's masked environment-variable editor and was not written to GitHub, local files, screenshots or this context file.
- Render rebuilt and deployed the backend from `main@919980d`; the new deployment is Live.
- Sent a synthetic assessment request to the live API. It returned HTTP 200 with four indicators, Malaysian population context, a reference set and an action card, confirming the configured database path is working for the deployed flow.
- Render logs also show OpenRouter calls during the synthetic test, so external AI is currently enabled in the service; no real health data was used. Keep the demo synthetic-only unless the team explicitly confirms the privacy wording and provider boundary.

## 88. Database requirement announced to Team 04 (2026-08-11)

- Posted a concise English group update that Tuesday's demo must use the database, PostgreSQL is enabled on the Render backend, the deployed API was rebuilt and tested with synthetic data, and the database credential must not be shared.

## 89. Live PostgreSQL verification (2026-08-11)

- Re-tested the current deployed `/api/assess` with synthetic values: HTTP 200, four indicators, population context, reference set and action card returned.
- Render application logs show the corresponding `POST /api/assess` request completed with 200 and no persistence exception.
- Performed a read-only connection check against the configured PostgreSQL database. Public tables `benchmark`, `biomarker`, `health_assessment` and `user_report` were present with rows (`5`, `90`, `20`, `20` respectively). No data was modified.
- The frontend can remain on “Preparing your results…” while OpenRouter is called; this is external-AI latency, not evidence of a database failure.

## 90. Corrected Render database target and verified insertion (2026-08-11)

- Follow-up comparison found the Render service still held the older `healthfirst_team04_db` URL, so the earlier row-count check was against a different PostgreSQL instance than the credential supplied for `tm04`.
- Replaced the Render `DATABASE_URL` with the supplied `tm04` credential and redeployed `main@919980d`.
- Submitted a controlled synthetic request after the new deployment. The response was HTTP 200; PostgreSQL row counts increased and the newest `user_report` matched the test values (age 45, sex F, height 171, weight 79) with five linked biomarkers and a health assessment.
- Render logs show the corresponding POST requests completed with 200. The target database is now receiving writes; no real health data was used.

## 91. Miro personal reflection and SMART goal (2026-08-11)

- Opened the supplied Miro board `uXjVHzbvWl4=` and checked sharing. The board is `My First Board`; the Manage board access view shows the TM04 team has access with five users, including Junn Keith, Hanxia Li and Huang's account as editors. `Anyone with the link` remains `No access`.
- The board was blank before editing (`No objects on the board`), so the missing teammate avatars were not a permissions problem. Miro's People area shows active collaborators, not every team member who has access; teammates only appear there while they are online/active.
- Added only Huang Guan's personal section: a heading plus four English sticky notes covering contribution, learning, SMART goal and next improvement. No existing teammate content was overwritten.

## 92. Miro team retrospective update (2026-08-11)

- Reopened the Miro board and confirmed the previous personal notes were still present.
- The supplied Google Doc (`Idea Generation`) contains an unrelated SDG 14 draft; Guan, Darli and Keith tabs are blank, so it was not used as evidence for the HealthFirst retrospective.
- Added an English `Team 04 — Retrospective` section with Stop / Start / Continue cards. The cards capture the agreed progress-first merge policy, clearer LeanKit ownership, synthetic-data and privacy boundaries, end-to-end checks, supportive communication and source-visible non-diagnostic wording.
- Added a personal `My Stop / Start / Continue` card alongside the existing Huang Guan reflection and SMART goal. Existing content was not overwritten.

## 93. Miro retrospective evidence expansion (2026-08-11)

- Audited the actual shared `HealthFirst Onboarding Project` Drive folder. It contains `Iteration Build`, `Data Governance`, `Feedbacks`, `Design Artefacts`, the current onboarding presentation and Su's system architecture artefact. The `Iteration Build` folder contains the `HealthFirst OB Project Development` working document; Data Governance contains the working MVP information-handling draft and usability-testing folders.
- The latest Team 04 WhatsApp messages confirmed that the group is preparing the Team Reflection, that Su asked where the peer-review video should be submitted, and that Darli shared the Friday Studio reflection guide. Darli also reposted the older `Idea Generation` link for the next idea exercise; it is not HealthFirst retrospective evidence.
- Added a `Team Insights & Actions` section to Miro with English cards for `What worked`, `What was difficult` and `Next actions`. The cards refer to the shared onboarding deck, deployed MVP, PostgreSQL verification, integration scope changes, privacy/threshold wording and the need to freeze interfaces and keep evidence logs.
- Added a personal `Evidence I can show` card listing Huang's PM contributions: deck/final checks, GitHub workflow and PR review, Render main deployment, synthetic PostgreSQL write verification and visible safety limits. No existing card was overwritten.

## 94. Miro retrospective layout matched to sample (2026-08-11)

- Reorganised the Miro board to follow the supplied sample more closely without changing the English reflection content.
- Added a large pale title banner, a clear `Personal Insights` area, a separate `Team Insights & Actions` row, and a `Team 04 Retrospective` section.
- Grouped the team reflection into three visible columns: `STOP DOING`, `START DOING` and `CONTINUE DOING`, each with a light-grey panel and the existing colour-coded cards.
- Enlarged and centred the main title, removed the duplicate overlapping team heading, and kept the board at 75% zoom so the main reflection layout is visible together.

## 95. Miro personal/team separation (2026-08-11)

- Reviewed the board's accessible object list: 25 visible objects are present, and all reflection cards currently correspond to the team section or Huang Guan's own cards. No teammate-authored personal reflection cards are visible yet.
- Moved `My Stop / Start / Continue` and its card into the upper personal-insights row beside the three Huang cards, leaving the team Stop / Start / Continue panels in the lower section.
- The board now has a clearer vertical separation: personal reflections across the top, team insights and the three team action columns below. Existing card text was not changed.

## 96. Miro personal cards moved to Darli's personal area (2026-08-12)

- Darli clarified in WhatsApp that her copied template has the team `What will you stop doing?`, `What will you start doing?` and `What will you continue doing?` areas on the left, with the personal area on the far right.
- Moved Huang Guan's personal heading and cards (`Personal Insights`, `Huang Guan — Personal Reflection`, `My Stop / Start / Continue`, `What I contributed`, `What I learned`, `SMART goal`, `What I will improve` and `Evidence I can show`) toward the far-right personal area.
- Left Darli's template, the team Stop / Start / Continue content and team action cards unchanged. No peer-review videos were read or added.

## 97. Miro personal-area placement corrected (2026-08-12)

- The previous keyboard-only repositioning changed the board object order but did not visibly place the personal cards in Darli's far-right panel.
- Corrected this by physically dragging Huang Guan's personal heading and reflection cards into the blank area inside `Discussion and action items`, beside Darli's yellow `Darli - SMART Reflection` card.
- Visual check at 20% confirmed the personal cards are inside the right-hand frame with clear spacing; the team Stop / Start / Continue columns and Darli's template content remain in their original positions.
- No peer-review videos were opened or processed, and no card text, colour or content was changed.

## 98. Miro personal cards tightened and upper team clutter removed (2026-08-12)

- Repositioned Huang Guan's personal sticky notes into a tighter grouped layout inside the far-right `Discussion and action items` frame, keeping Darli's yellow SMART card separate and unchanged.
- Removed the redundant upper team title, headings, summary card and loose `What worked`, `What was difficult` and `Next actions` cards because the existing Stop / Start / Continue panels already contain the team action wording and there was no clean slot for the loose cards.
- Kept the existing Stop / Start / Continue panels and their written cards; removed only blank/unused rectangles associated with the loose upper area. No peer-review videos were opened.

## 99. Huang Guan SMART Reflection card added (2026-08-12)

- Added one separate purple sticky card titled `HUANG GUAN - SMART Reflection` inside the purple target square in the right-side personal reflection area.
- Consolidated Huang's contribution, learning, improvement, evidence and SMART goal into `Specific`, `Measurable`, `Assignable`, `Relevant` and `Time-bound` fields.
- Existing Darli card and team Stop / Start / Continue content were left unchanged.

## 100. Huang Guan team retrospective cards added (2026-08-12)

- Added concise team cards in the existing Stop / Start / Continue panels, each labelled `HUANG GUAN`.
- Stop: `Stop treating Checks (0) as blockers`.
- Start: `Start branch → review → merge → test`.
- Continue: `Keep clear teamwork and early sharing`, combining the team's successful early-sharing practice with the Continue reflection.
- Kept the longer team cards and existing teammate content unchanged.

## 101. Darli Friday presentation revision (2026-08-12)

- Confirmed Darli's latest private request: revise the copied `HealthFirst Expo Slides` deck for Friday, focusing on backend/system architecture and security.
- Added speaker-note guidance to the architecture and security sections: describe only implemented controls, keep synthetic-data and source-limit wording visible, and do not claim encryption, RBAC/MFA, anonymisation, PDPA compliance or production privacy controls unless implemented.
- Replied to Darli in WhatsApp: `Done — I added the backend/system architecture and security revision notes to the presentation. Please check it when you have time.`

## 102. Friday presentation and QA allocation (2026-08-12)

- Rechecked the latest `HealthFirst Expo Slides` deck: 21 slides, saved to Drive, with the latest edit shown as 5 hours ago.
- Confirmed the current assignment: Darli and Keith present the deck; QA is split by slide range — Darli 2–4 and 9, Keith 10–12 and 16, Qian 5–7, LiHanXia 10–13 and 16–17, Benshuai 14–15 and 18–19, Huang 1, 8 and 20–21 plus final deck check.
- Sent the English allocation to Team 04 with the note that it follows the current 21-slide PPT and that each member keeps ownership of their relevant technical section if the deck changes later.

## 103. Proposed QA swap with Darli (2026-08-12)

- Jiang/Qian requested Slides 2–4 because they match her frontend work.
- Proposed privately to Darli that she cover Slides 5–7 in exchange, while Huang Guan covers Slide 9.
- Asked Darli to confirm whether the swap works; no group update was sent for this proposed change yet.

## 104. Huang QA pages renewed (2026-08-12)

- Darli accepted the QA swap in private chat: Jiang/Qian takes Slides 2–4, Darli covers Slides 5–7, and Huang Guan covers Slide 9. Darli also asked that the system architecture reflect the manual-entry MVP without OCR; that remains outside Huang's reassigned QA pages.
- Rechecked the live Google Slides deck. It now contains 22 slides: Slide 1 cover/roles, Slide 8 results prototype, Slide 9 LeanKit, Slide 20 Security Plan, Slide 21 References, and Slide 22 Thank You.
- Renewed Huang's assigned content: corrected the cover role to `Hnin Darli - Data Analysis / Visualisation`; updated Slide 20 to distinguish implemented MVP boundaries from planned encryption, anonymisation, access control and PDPA work; clarified external-AI disclosure and synthetic-data limits; corrected Slide 21 so the Kaggle sources are not incorrectly attributed to Slide 9.
- Google Slides showed `Saved to Drive` after the changes. Slide 22 remains the Thank You page because the deck gained an extra slide after the original 21-slide allocation.

## 105. Miro reflection speaking notes shared (2026-08-13)

- Created `Team04_Miro_Reflection_Speaking_Notes.docx` for the online team reflection.
- The team section is planned for about five minutes, with Huang Guan leading and each teammate receiving one prompt only; teammate response lines are intentionally blank for them to complete.
- The personal Huang Guan section is planned for about two minutes.
- Uploaded the file to the shared `HealthFirst Onboarding Project` Drive folder and sent the file link in the Team 04 WhatsApp group for advance review.

## 106. Assigned presentation slides checked (2026-08-13)

- Rechecked Huang Guan's assigned slides in the live `HealthFirst Expo Slides` deck: Slides 1, 8, 9, 20 and 21.
- Slides 1, 8, 9 and 21 had no visible overlap in the current deck.
- Slide 20 contained an internal security-revision note text box covering the title and cards. Removed that unintended text box without changing the audience-facing security cards.
- Google Slides confirmed `Saved to Drive` after the correction.
