"""Publish v2's reference catalogue, without importing preview report metrics.

Run from any directory after changing frontend reference content. The generated
JSON is committed, so an API-only deployment does not depend on frontend files.
"""
from __future__ import annotations

import json
from pathlib import Path


def sync() -> None:
    backend = Path(__file__).resolve().parents[1]
    content_dir = backend.parent / "frontend" / "src" / "content"
    content = json.loads((content_dir / "coastalContent.json").read_text(encoding="utf-8"))
    destination = backend / "data" / "beaches.json"
    existing = {b["id"]: b for b in json.loads(destination.read_text(encoding="utf-8"))}
    locations = {}
    for name in ("Base", "North", "East", "West"):
        locations.update(json.loads((content_dir / f"mapLocations{name}.json").read_text(encoding="utf-8")))
    species = {s["id"]: s for s in content["species"]}
    output = []
    for reference in content["beaches"]:
        beach_id = reference["id"]
        if beach_id in {"morib", "remis", "kelanang", "bagan"} and beach_id in existing:
            # Retain curated pilot coordinates and ecological metadata.
            beach = existing[beach_id]
        else:
            point = locations[beach_id]
            cards = []
            for slug in reference["species"]:
                item = species[slug]
                source = item.get("sources", [{}])[0]
                cards.append({
                    "name": item["name"], "kind": "group", "scientificName": None,
                    "glyph": "fish", "text": item["intro"],
                    "source": {"dataset": "other", "citation": source.get("label", "Published reference"),
                               "url": source.get("url"), "accessedAt": None},
                    "likelihood": {"state": "unavailable", "basis": "Published reference context; not a confirmed sighting at this beach."},
                })
            beach = {
                "id": beach_id, "name": reference["name"], "area": reference["area"],
                "lat": point["lat"], "lng": point["lng"],
                "coordinateSource": {"url": point["sourceUrl"], "name": point["sourceName"],
                                     "note": "Approximate beach reference point; not a visitor's location."},
                "habitat": reference.get("habitat") or "Coastal environment",
                "habitatTag": "COASTAL", "sensitivity": "Published marine-life reference context",
                "primarySpeciesGlyph": "fish", "speciesNames": [c["name"] for c in cards],
                "scene": "linear-gradient(178deg,#8FD0E8 0%,#4E9EC9 36%,#173E77 100%)",
                "species": cards,
                "ecologicalNote": "Marine-life information is from published reference sources, not a live wildlife observation or measured litter impact.",
            }
        beach["coverImageUrl"] = reference.get("image")
        # Keep only reference content. Ratings and report totals come from SQL.
        for key in ("severity", "validReports", "reported", "attentionScore"):
            beach.pop(key, None)
        output.append(beach)
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Published {len(output)} reference beaches; no preview ratings or reports imported.")


if __name__ == "__main__":
    sync()
