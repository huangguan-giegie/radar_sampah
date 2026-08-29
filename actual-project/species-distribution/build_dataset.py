"""Download OBIS records and build gridded presence/background training tables."""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import pandas as pd
import requests

from tidetrace_sdm import (
    ROOT,
    cell_center,
    cell_indices,
    geometry_from_feature_collection,
    load_config,
    marine_grid,
    parse_flags,
    point_in_geometry,
    write_json,
)


OBIS_ENDPOINT = "https://api.obis.org/v3/occurrence"
MARINE_REGIONS_ENDPOINT = "https://geo.vliz.be/geoserver/MarineRegions/wfs"
USER_AGENT = "TideTrace-MY-Student-Project/1.0 (OBIS occurrence research)"
REJECT_FLAGS = {
    "NO_COORD",
    "ON_LAND",
    "ZERO_COORDINATE",
    "ZERO_COORDINATES",
    "INVALID_COORDINATE",
    "COORDINATE_OUT_OF_RANGE",
}
RAW_FIELDS = [
    "id",
    "occurrenceID",
    "scientificName",
    "scientificNameID",
    "aphiaID",
    "taxonomicStatus",
    "decimalLatitude",
    "decimalLongitude",
    "eventDate",
    "year",
    "basisOfRecord",
    "occurrenceStatus",
    "coordinateUncertaintyInMeters",
    "marine",
    "dataset_id",
    "datasetName",
    "license",
    "flags",
    "dropped",
    "absence",
]


def request_json(url: str, params: dict[str, Any], timeout: int = 90) -> dict[str, Any]:
    response = requests.get(
        url,
        params=params,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def fetch_malaysia_eez(mrgid: int) -> tuple[dict[str, Any], str]:
    params = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": "eez",
        "cql_filter": f"mrgid={mrgid}",
        "outputFormat": "application/json",
    }
    return request_json(MARINE_REGIONS_ENDPOINT, params), f"{MARINE_REGIONS_ENDPOINT}?{urlencode(params)}"


def marine_regions_query_url(mrgid: int) -> str:
    params = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": "eez",
        "cql_filter": f"mrgid={mrgid}",
        "outputFormat": "application/json",
    }
    return f"{MARINE_REGIONS_ENDPOINT}?{urlencode(params)}"


def fetch_obis(scientific_name: str, area_id: int) -> tuple[list[dict[str, Any]], str, int]:
    params = {
        "scientificname": scientific_name,
        "areaid": area_id,
        "size": 1000,
        "absence": "exclude",
        "dropped": "false",
    }
    payload = request_json(OBIS_ENDPOINT, params)
    total = int(payload.get("total", 0))
    results = list(payload.get("results", []))
    if total > len(results):
        raise RuntimeError(
            f"OBIS returned {len(results)} of {total} rows for {scientific_name}; "
            "pagination must be added before continuing."
        )
    return results, f"{OBIS_ENDPOINT}?{urlencode(params)}", total


def obis_query_url(scientific_name: str, area_id: int) -> str:
    return f"{OBIS_ENDPOINT}?{urlencode({'scientificname': scientific_name, 'areaid': area_id, 'size': 1000, 'absence': 'exclude', 'dropped': 'false'})}"


def serialise_raw_rows(rows: list[dict[str, Any]]) -> pd.DataFrame:
    serialised: list[dict[str, Any]] = []
    for row in rows:
        selected: dict[str, Any] = {}
        for field in RAW_FIELDS:
            value = row.get(field)
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
            selected[field] = value
        serialised.append(selected)
    return pd.DataFrame(serialised, columns=RAW_FIELDS)


def clean_and_grid_presence(
    raw: pd.DataFrame,
    species: dict[str, str],
    geometry: dict[str, Any],
    grid_size: float,
    max_uncertainty: float,
) -> tuple[pd.DataFrame, dict[str, int]]:
    counters = {
        "raw_records": len(raw),
        "rejected_missing_or_invalid_coordinate": 0,
        "rejected_not_present_or_dropped": 0,
        "rejected_non_marine_or_quality_flag": 0,
        "rejected_coordinate_uncertainty": 0,
        "rejected_outside_current_malaysia_eez": 0,
        "rejected_grid_center_outside_current_malaysia_eez": 0,
        "accepted_records_before_grid_deduplication": 0,
    }
    accepted: list[dict[str, Any]] = []
    for row in raw.to_dict(orient="records"):
        try:
            latitude = float(row["decimalLatitude"])
            longitude = float(row["decimalLongitude"])
        except (TypeError, ValueError):
            counters["rejected_missing_or_invalid_coordinate"] += 1
            continue
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            counters["rejected_missing_or_invalid_coordinate"] += 1
            continue
        status = str(row.get("occurrenceStatus") or "").lower()
        dropped = str(row.get("dropped") or "").lower() == "true"
        absence = str(row.get("absence") or "").lower() == "true"
        # Some otherwise valid API rows contain a taxon LSID in occurrenceStatus.
        # OBIS's normalized boolean `absence` is therefore the reliable exclusion
        # field here; an explicit textual "absent" is also rejected.
        if status == "absent" or dropped or absence:
            counters["rejected_not_present_or_dropped"] += 1
            continue
        flags = parse_flags(row.get("flags"))
        marine_value = row.get("marine")
        if str(marine_value).lower() == "false" or flags.intersection(REJECT_FLAGS):
            counters["rejected_non_marine_or_quality_flag"] += 1
            continue
        uncertainty = pd.to_numeric(row.get("coordinateUncertaintyInMeters"), errors="coerce")
        if pd.notna(uncertainty) and float(uncertainty) > max_uncertainty:
            counters["rejected_coordinate_uncertainty"] += 1
            continue
        if not point_in_geometry(longitude, latitude, geometry):
            counters["rejected_outside_current_malaysia_eez"] += 1
            continue
        lat_index, lon_index = cell_indices(latitude, longitude, grid_size)
        center_latitude, center_longitude = cell_center(lat_index, lon_index, grid_size)
        # Both classes must use grid centres. Keeping arbitrary raw coordinates
        # only for presences would leak the label through decimal precision.
        if not point_in_geometry(center_longitude, center_latitude, geometry):
            counters["rejected_grid_center_outside_current_malaysia_eez"] += 1
            continue
        accepted.append(
            {
                "cell_id": f"{lat_index}:{lon_index}",
                "latitude": center_latitude,
                "longitude": center_longitude,
                "scientific_name": species["scientific_name"],
                "species_slug": species["slug"],
                "label": 1,
                "label_source": "OBIS_presence_grid",
                "source_observation_id": row.get("occurrenceID") or row.get("id"),
                "source_dataset_id": row.get("dataset_id"),
                "source_dataset_name": row.get("datasetName"),
                "source_event_date": row.get("eventDate"),
            }
        )

    counters["accepted_records_before_grid_deduplication"] = len(accepted)
    if not accepted:
        raise RuntimeError(f"No usable presence records remain for {species['scientific_name']}")

    accepted_frame = pd.DataFrame(accepted)
    aggregated = (
        accepted_frame.groupby(
            [
                "cell_id",
                "latitude",
                "longitude",
                "scientific_name",
                "species_slug",
                "label",
                "label_source",
            ],
            as_index=False,
        )
        .agg(
            observation_count=("source_observation_id", "size"),
            source_dataset_count=("source_dataset_id", "nunique"),
            example_occurrence_id=("source_observation_id", "first"),
            example_dataset_name=("source_dataset_name", "first"),
            example_event_date=("source_event_date", "first"),
        )
        .sort_values(["latitude", "longitude"])
        .reset_index(drop=True)
    )
    counters["presence_grid_cells"] = len(aggregated)
    return aggregated, counters


def build_training_table(
    presence: pd.DataFrame,
    all_marine_cells: pd.DataFrame,
    species: dict[str, str],
    background_ratio: int,
    seed: int,
) -> pd.DataFrame:
    presence_ids = set(presence["cell_id"])
    candidates = all_marine_cells[~all_marine_cells["cell_id"].isin(presence_ids)].copy()
    requested_backgrounds = len(presence) * background_ratio
    if requested_backgrounds > len(candidates):
        requested_backgrounds = len(candidates)
    backgrounds = candidates.sample(n=requested_backgrounds, random_state=seed).copy()
    backgrounds["scientific_name"] = species["scientific_name"]
    backgrounds["species_slug"] = species["slug"]
    backgrounds["label"] = 0
    backgrounds["label_source"] = "sampled_EEZ_background_not_confirmed_absence"
    backgrounds["observation_count"] = 0
    backgrounds["source_dataset_count"] = 0
    backgrounds["example_occurrence_id"] = ""
    backgrounds["example_dataset_name"] = ""
    backgrounds["example_event_date"] = ""

    columns = [
        "cell_id",
        "latitude",
        "longitude",
        "scientific_name",
        "species_slug",
        "label",
        "label_source",
        "observation_count",
        "source_dataset_count",
        "example_occurrence_id",
        "example_dataset_name",
        "example_event_date",
    ]
    return (
        pd.concat([presence[columns], backgrounds[columns]], ignore_index=True)
        .sort_values(["label", "latitude", "longitude"], ascending=[False, True, True])
        .reset_index(drop=True)
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Redownload existing source files.")
    args = parser.parse_args()

    config = load_config()
    data_dir = ROOT / "data"
    raw_dir = data_dir / "raw"
    processed_dir = data_dir / "processed"
    reference_dir = data_dir / "reference"
    for directory in (raw_dir, processed_dir, reference_dir):
        directory.mkdir(parents=True, exist_ok=True)

    eez_path = reference_dir / "malaysia_eez_marineregions_v12.geojson"
    if args.force or not eez_path.exists():
        eez_collection, eez_url = fetch_malaysia_eez(int(config["marine_regions_mrgid"]))
        write_json(eez_path, eez_collection)
    else:
        with eez_path.open("r", encoding="utf-8") as handle:
            eez_collection = json.load(handle)
        eez_url = marine_regions_query_url(int(config["marine_regions_mrgid"]))

    geometry = geometry_from_feature_collection(eez_collection)
    grid_size = float(config["grid_size_degrees"])
    marine_cells = pd.DataFrame(marine_grid(geometry, grid_size))
    marine_cells.to_csv(processed_dir / "malaysia_eez_marine_grid.csv", index=False)

    summaries: list[dict[str, Any]] = []
    download_entries: list[dict[str, Any]] = []
    for species_index, species in enumerate(config["species"]):
        slug = species["slug"]
        raw_path = raw_dir / f"obis_{slug}.csv"
        if args.force or not raw_path.exists():
            rows, query_url, obis_total = fetch_obis(
                species["scientific_name"], int(config["obis_area_id"])
            )
            raw = serialise_raw_rows(rows)
            raw.to_csv(raw_path, index=False)
        else:
            raw = pd.read_csv(raw_path)
            query_url = obis_query_url(
                species["scientific_name"], int(config["obis_area_id"])
            )
            obis_total = len(raw)

        presence, counters = clean_and_grid_presence(
            raw,
            species,
            geometry,
            grid_size,
            float(config["max_coordinate_uncertainty_metres"]),
        )
        presence_path = processed_dir / f"{slug}_presence_grid.csv"
        presence.to_csv(presence_path, index=False)

        species_seed = int(config["random_seed"]) + species_index
        training = build_training_table(
            presence,
            marine_cells,
            species,
            int(config["background_ratio"]),
            species_seed,
        )
        training_path = processed_dir / f"{slug}_training.csv"
        training.to_csv(training_path, index=False)

        summary = {
            **species,
            **counters,
            "background_grid_cells": int((training["label"] == 0).sum()),
            "training_rows": len(training),
            "raw_path": raw_path.relative_to(ROOT).as_posix(),
            "presence_path": presence_path.relative_to(ROOT).as_posix(),
            "training_path": training_path.relative_to(ROOT).as_posix(),
        }
        summaries.append(summary)
        download_entries.append(
            {
                "scientific_name": species["scientific_name"],
                "obis_reported_total": obis_total,
                "downloaded_rows": len(raw),
                "query_url": query_url,
                "licences_in_rows": sorted(
                    str(value) for value in raw["license"].dropna().unique().tolist()
                ),
            }
        )

    pd.DataFrame(summaries).to_csv(processed_dir / "dataset_summary.csv", index=False)
    write_json(
        data_dir / "download_manifest.json",
        {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "obis_area_id": config["obis_area_id"],
            "marine_regions_mrgid": config["marine_regions_mrgid"],
            "marine_regions_query_url": eez_url,
            "grid_size_degrees": grid_size,
            "marine_grid_cells": len(marine_cells),
            "species_downloads": download_entries,
            "important_note": (
                "OBIS records are presence observations. Background cells are generated model "
                "contrasts, not verified absences."
            ),
        },
    )
    print(pd.DataFrame(summaries)[["scientific_name", "raw_records", "presence_grid_cells", "background_grid_cells", "training_rows"]].to_string(index=False))


if __name__ == "__main__":
    random.seed(20260829)
    main()
