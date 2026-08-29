"""Shared utilities for the TideTrace MY Iteration 1 spatial baseline."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Iterable, Iterator


ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_config() -> dict[str, Any]:
    return load_json(CONFIG_PATH)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def iter_positions(geometry: dict[str, Any]) -> Iterator[tuple[float, float]]:
    """Yield every lon/lat pair in a GeoJSON Polygon or MultiPolygon."""
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [coordinates]
    elif geometry["type"] == "MultiPolygon":
        polygons = coordinates
    else:
        raise ValueError(f"Unsupported geometry type: {geometry['type']}")
    for polygon in polygons:
        for ring in polygon:
            for lon, lat, *_ in ring:
                yield float(lon), float(lat)


def geometry_bounds(geometry: dict[str, Any]) -> tuple[float, float, float, float]:
    positions = list(iter_positions(geometry))
    longitudes = [position[0] for position in positions]
    latitudes = [position[1] for position in positions]
    return min(longitudes), min(latitudes), max(longitudes), max(latitudes)


def point_on_segment(
    x: float,
    y: float,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    tolerance: float = 1e-12,
) -> bool:
    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    if abs(cross) > tolerance:
        return False
    return (
        min(x1, x2) - tolerance <= x <= max(x1, x2) + tolerance
        and min(y1, y2) - tolerance <= y <= max(y1, y2) + tolerance
    )


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    """Boundary-inclusive ray casting for one GeoJSON linear ring."""
    inside = False
    previous = ring[-1]
    for current in ring:
        x1, y1 = float(previous[0]), float(previous[1])
        x2, y2 = float(current[0]), float(current[1])
        if point_on_segment(lon, lat, x1, y1, x2, y2):
            return True
        intersects = (y1 > lat) != (y2 > lat)
        if intersects:
            x_at_latitude = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
            if lon < x_at_latitude:
                inside = not inside
        previous = current
    return inside


def point_in_geometry(lon: float, lat: float, geometry: dict[str, Any]) -> bool:
    """Return whether a point is inside a GeoJSON Polygon or MultiPolygon."""
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [coordinates]
    elif geometry["type"] == "MultiPolygon":
        polygons = coordinates
    else:
        raise ValueError(f"Unsupported geometry type: {geometry['type']}")

    for polygon in polygons:
        if not polygon or not point_in_ring(lon, lat, polygon[0]):
            continue
        if any(point_in_ring(lon, lat, hole) for hole in polygon[1:]):
            continue
        return True
    return False


def cell_indices(latitude: float, longitude: float, grid_size: float) -> tuple[int, int]:
    """Return stable integer grid indices for a WGS84 coordinate."""
    lat_index = math.floor((latitude + 90.0) / grid_size + 1e-10)
    lon_index = math.floor((longitude + 180.0) / grid_size + 1e-10)
    return lat_index, lon_index


def cell_id(latitude: float, longitude: float, grid_size: float) -> str:
    lat_index, lon_index = cell_indices(latitude, longitude, grid_size)
    return f"{lat_index}:{lon_index}"


def cell_center(lat_index: int, lon_index: int, grid_size: float) -> tuple[float, float]:
    latitude = -90.0 + (lat_index + 0.5) * grid_size
    longitude = -180.0 + (lon_index + 0.5) * grid_size
    return round(latitude, 7), round(longitude, 7)


def marine_grid(geometry: dict[str, Any], grid_size: float) -> list[dict[str, Any]]:
    """Generate grid centres inside the supplied marine polygon.

    This uses horizontal scan lines rather than testing every cell against
    every boundary vertex. The Malaysia EEZ geometry is detailed enough that
    the direct point-by-point approach is unnecessarily slow.
    """
    min_lon, min_lat, max_lon, max_lat = geometry_bounds(geometry)
    min_lat_index, min_lon_index = cell_indices(min_lat, min_lon, grid_size)
    max_lat_index, max_lon_index = cell_indices(max_lat, max_lon, grid_size)
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [coordinates]
    elif geometry["type"] == "MultiPolygon":
        polygons = coordinates
    else:
        raise ValueError(f"Unsupported geometry type: {geometry['type']}")

    def intervals_for_ring(ring: list[list[float]], latitude: float) -> list[tuple[float, float]]:
        intersections: list[float] = []
        previous = ring[-1]
        for current in ring:
            x1, y1 = float(previous[0]), float(previous[1])
            x2, y2 = float(current[0]), float(current[1])
            if (y1 > latitude) != (y2 > latitude):
                intersections.append(x1 + (latitude - y1) * (x2 - x1) / (y2 - y1))
            previous = current
        intersections.sort()
        return list(zip(intersections[0::2], intersections[1::2]))

    cells_by_id: dict[str, dict[str, Any]] = {}
    for lat_index in range(min_lat_index, max_lat_index + 1):
        latitude, _ = cell_center(lat_index, min_lon_index, grid_size)
        polygon_intervals: list[tuple[list[tuple[float, float]], list[tuple[float, float]]]] = []
        for polygon in polygons:
            outer = intervals_for_ring(polygon[0], latitude)
            if not outer:
                continue
            holes = [
                interval
                for hole in polygon[1:]
                for interval in intervals_for_ring(hole, latitude)
            ]
            polygon_intervals.append((outer, holes))
        for lon_index in range(min_lon_index, max_lon_index + 1):
            _, longitude = cell_center(lat_index, lon_index, grid_size)
            inside = any(
                any(left <= longitude <= right for left, right in outer)
                and not any(left <= longitude <= right for left, right in holes)
                for outer, holes in polygon_intervals
            )
            if inside:
                identifier = f"{lat_index}:{lon_index}"
                cells_by_id[identifier] = {
                    "cell_id": identifier,
                    "latitude": latitude,
                    "longitude": longitude,
                }
    return list(cells_by_id.values())


def geometry_from_feature_collection(collection: dict[str, Any]) -> dict[str, Any]:
    features = collection.get("features", [])
    if len(features) != 1:
        raise ValueError(f"Expected exactly one Malaysia EEZ feature, got {len(features)}")
    return features[0]["geometry"]


def parse_flags(value: Any) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, list):
        return {str(flag).upper() for flag in value}
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return set()
        try:
            decoded = json.loads(stripped)
            if isinstance(decoded, list):
                return {str(flag).upper() for flag in decoded}
        except json.JSONDecodeError:
            pass
        return {part.strip().upper() for part in stripped.split(",") if part.strip()}
    return {str(value).upper()}


def spatial_group(latitude: float, longitude: float, block_size: float) -> str:
    lat_index, lon_index = cell_indices(latitude, longitude, block_size)
    return f"{lat_index}:{lon_index}"


def chunks(values: list[Any], size: int) -> Iterable[list[Any]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]
