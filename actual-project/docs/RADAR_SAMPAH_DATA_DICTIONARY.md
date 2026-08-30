# Radar Sampah - Data Dictionary

This file lists the fields used by the Radar Sampah demo. The data is synthetic
or public and is not a survey, enforcement or scientific evidence record.

| Field | Type | Meaning |
|---|---|---|
| `category` | fixed text | Plastic packaging, fishing gear, glass, metal or other |
| `quantity` | integer 1-500 | Demonstration item count |
| `area_id` | fixed text | Broad Malaysian coastal area; no exact location |
| `observed_at` | ISO datetime | Time of the report |
| `image_url` | safe URL | Optional `/assets/` path or HTTPS example |
| `note` | short text | Optional note; no names, contact details or accounts |
| `detection` | derived text | Reporter-selected or local demo fallback |
| `priority` | derived object | Illustrative score and cleanup level |
| `impact` | derived object | Illustrative before/after comparison |
| `report_status` | fixed text | reported, moderator-verified or collected |
| `sensitivity_factor` | decimal | Area factor 1.0, 1.25 or 1.5 used in severity |
| `gps_assist` | boolean | One-off area selection help; no coordinate is stored |

The service keeps reports, detections, priorities, missions and evidence in
separate tables. Recognition is disabled by default. No exact coordinates are
accepted or returned. Collected status is not set before moderator review.
