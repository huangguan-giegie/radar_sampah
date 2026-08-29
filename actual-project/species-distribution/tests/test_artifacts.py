from __future__ import annotations

import json
import unittest

import joblib
import pandas as pd

from tidetrace_sdm import ROOT, geometry_from_feature_collection, point_in_geometry


class ArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
        cls.manifest = json.loads(
            (ROOT / "models" / "model_manifest.json").read_text(encoding="utf-8")
        )
        boundary = json.loads(
            (
                ROOT
                / "data"
                / "reference"
                / "malaysia_eez_marineregions_v12.geojson"
            ).read_text(encoding="utf-8")
        )
        cls.geometry = geometry_from_feature_collection(boundary)

    def test_all_configured_species_have_selected_models(self) -> None:
        expected = {species["slug"] for species in self.config["species"]}
        actual = {species["slug"] for species in self.manifest["species"]}
        self.assertEqual(expected, actual)
        for species in self.manifest["species"]:
            self.assertTrue((ROOT / species["selected_model_path"]).is_file())

    def test_training_tables_are_balanced_by_design_and_do_not_overlap(self) -> None:
        for species in self.config["species"]:
            frame = pd.read_csv(
                ROOT / "data" / "processed" / f"{species['slug']}_training.csv"
            )
            self.assertFalse(frame[["latitude", "longitude", "label"]].isna().any().any())
            presence = set(frame.loc[frame.label == 1, "cell_id"])
            background = set(frame.loc[frame.label == 0, "cell_id"])
            self.assertFalse(presence.intersection(background))
            self.assertEqual(len(background), 3 * len(presence))
            self.assertTrue(
                all(
                    point_in_geometry(row.longitude, row.latitude, self.geometry)
                    for row in frame.itertuples(index=False)
                )
            )

    def test_selected_models_return_finite_scores(self) -> None:
        sample = pd.DataFrame([{"latitude": 3.05, "longitude": 103.55}])
        for species in self.manifest["species"]:
            bundle = joblib.load(ROOT / species["selected_model_path"])
            score = float(bundle["model"].predict_proba(sample)[0, 1])
            self.assertGreaterEqual(score, 0.0)
            self.assertLessEqual(score, 1.0)


if __name__ == "__main__":
    unittest.main()
