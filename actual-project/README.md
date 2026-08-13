# Team 04 — Marine Litter Hotspot & Marine-Life Observation MVP

## Working title

**Marine Litter Hotspot & Marine-Life Observation Platform**

## Current scope

1. A user reports marine litter from one selected Malaysian coastal area.
2. The report records a photo or illustrative sample image, category, approximate area and time.
3. The system classifies a small, fixed set of litter categories using rules or a clearly labelled demo model.
4. The map shows litter observations and an OBIS marine-life layer.
5. The system highlights areas for possible clean-up attention using transparent, non-enforcement wording.

## Explicitly out of scope for the first MVP

- A separate marine-animal reporting workflow.
- Broad multi-coastal deployment.
- Claims that the system proves pollution sources or population change.
- Exact locations of threatened species.
- Unreviewed automated environmental decisions.

## Suggested flow

`Report litter → validate fields → classify category → map observation → combine litter density with ecological sensitivity → show an illustrative clean-up priority`

## Team roles

- Huang Guan — Project Manager and integration
- Hnin Darli — Data analysis and visualisation
- Qian Jiang — UI/UX and frontend
- LiHanXia — Backend/API
- Keith Junn Chong — Database/data integration
- Benshuai Su — AI/LLM or classification support

## First build boundary

Start with a local demo and public/synthetic data. Freeze the coastal area, category list, API fields and map layer before adding model features.
