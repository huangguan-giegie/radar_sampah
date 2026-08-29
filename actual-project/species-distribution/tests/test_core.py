from __future__ import annotations

import unittest

from tidetrace_sdm import cell_center, cell_indices, marine_grid, point_in_geometry


class GeometryTests(unittest.TestCase):
    def test_polygon_with_hole(self) -> None:
        geometry = {
            "type": "Polygon",
            "coordinates": [
                [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
                [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
            ],
        }
        self.assertTrue(point_in_geometry(2, 2, geometry))
        self.assertFalse(point_in_geometry(5, 5, geometry))
        self.assertFalse(point_in_geometry(12, 5, geometry))

    def test_grid_index_round_trip(self) -> None:
        lat_index, lon_index = cell_indices(5.123, 103.246, 0.1)
        latitude, longitude = cell_center(lat_index, lon_index, 0.1)
        self.assertAlmostEqual(latitude, 5.15)
        self.assertAlmostEqual(longitude, 103.25)

    def test_scanline_grid_respects_polygon_hole(self) -> None:
        geometry = {
            "type": "Polygon",
            "coordinates": [
                [[0, 0], [0.3, 0], [0.3, 0.3], [0, 0.3], [0, 0]],
                [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2], [0.1, 0.1]],
            ],
        }
        cells = marine_grid(geometry, 0.1)
        centres = {(cell["latitude"], cell["longitude"]) for cell in cells}
        self.assertIn((0.05, 0.05), centres)
        self.assertNotIn((0.15, 0.15), centres)


if __name__ == "__main__":
    unittest.main()
