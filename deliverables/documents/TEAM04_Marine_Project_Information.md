# Team 04 — Marine Observation Project Information

**Unit:** FIT5120, 2026 S2  
**Project:** Marine Litter Hotspot & Marine-Life Observation MVP  
**Working direction:** Marine litter is the only reporting flow. Public OBIS marine-life data is an ecological context layer.

## Project overview

The MVP lets a user report a litter observation in one selected Malaysian coastal area. The user enters a category, area, time, coordinates and an optional safe image URL, reviews the record, confirms it, and receives a transparent category result and an illustrative clean-up priority. A small OBIS sample is shown as map context.

This is a demonstration and learning tool. It does not prove a pollution source, verify a species identity, measure ecological change, or make an environmental enforcement decision.

## Team roles

| Member | Role | Main responsibility |
|---|---|---|
| Huang Guan | Project Manager | Scope, coordination, integration, evidence and release checks |
| Hnin Darli Myint Myat | Data Analysis and Visualisation | Public data review, context explanation and visual communication |
| Qian Jiang | UI/UX and Frontend | Accessible interface, interaction flow and visual design |
| Hanxia Li | Backend Developer | Flask API, validation and application integration |
| Chong Junn Keith | Database and Backend | PostgreSQL/SQLite schema, persistence and database checks |
| Benshuai Su | Backend and Intelligent Features | Rule explanation, future AI adapter boundary and technical support |

## MVP flow

`Report → Review and edit → Confirm → Save → Results and map context`

## Current boundaries

- Fixed categories: Plastic packaging, Fishing gear, Glass, Metal and Other.
- Public/static OBIS context is source-labelled and sensitive locations are masked or aggregated.
- The first release uses transparent rules and no external AI or computer vision.
- No names, phone numbers, accounts or real personal profiles are accepted.
- Raw uploaded files are not stored; image input is a safe demo path or HTTPS URL.

## Project spaces

- GitHub: https://github.com/huangguan-giegie/team04-marine-observation-mvp
- Frontend: https://team04-marine-observation-frontend.onrender.com
- API: https://team04-marine-observation-api.onrender.com
- Drive PGP: https://drive.google.com/drive/folders/18Px2njE27SCiZ4bs-40zgUgm_sRE70Kx
- Miro: https://miro.com/app/board/uXjVHySKbPY=/

**Last updated:** 14 August 2026
