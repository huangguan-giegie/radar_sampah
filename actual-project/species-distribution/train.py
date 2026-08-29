"""Train and spatially evaluate Iteration 1 coordinate-only species models."""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

from tidetrace_sdm import ROOT, load_config, spatial_group, write_json


def build_estimators(seed: int) -> dict[str, Any]:
    return {
        "logistic_regression": Pipeline(
            [
                ("scale", StandardScaler()),
                ("classifier", LogisticRegression(class_weight="balanced", max_iter=2000, random_state=seed)),
            ]
        ),
        "quadratic_logistic_regression": Pipeline(
            [
                ("polynomial", PolynomialFeatures(degree=2, include_bias=False)),
                ("scale", StandardScaler()),
                ("classifier", LogisticRegression(class_weight="balanced", max_iter=2000, random_state=seed)),
            ]
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=500,
            max_depth=10,
            min_samples_leaf=5,
            class_weight="balanced_subsample",
            random_state=seed,
            # Single-process execution is deterministic and works in restricted
            # classroom/deployment environments where worker creation is blocked.
            n_jobs=1,
        ),
    }


def spatial_oof_predictions(
    estimator: Any,
    features: pd.DataFrame,
    labels: pd.Series,
    groups: pd.Series,
    seed: int,
) -> tuple[np.ndarray, list[dict[str, int]], int]:
    positive_groups = groups[labels.to_numpy() == 1].nunique()
    negative_groups = groups[labels.to_numpy() == 0].nunique()
    n_splits = int(min(5, positive_groups, negative_groups))
    if n_splits < 2:
        raise RuntimeError("At least two presence and background spatial blocks are required")
    splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    predictions = np.full(len(features), np.nan, dtype=float)
    fold_summary: list[dict[str, int]] = []
    for fold, (train_indices, test_indices) in enumerate(
        splitter.split(features, labels, groups), start=1
    ):
        fold_estimator = clone(estimator)
        fold_estimator.fit(features.iloc[train_indices], labels.iloc[train_indices])
        predictions[test_indices] = fold_estimator.predict_proba(features.iloc[test_indices])[:, 1]
        fold_summary.append(
            {
                "fold": fold,
                "train_rows": len(train_indices),
                "test_rows": len(test_indices),
                "train_presence": int(labels.iloc[train_indices].sum()),
                "test_presence": int(labels.iloc[test_indices].sum()),
                "test_spatial_blocks": int(groups.iloc[test_indices].nunique()),
            }
        )
    if np.isnan(predictions).any():
        raise RuntimeError("Spatial cross-validation failed to predict every row")
    if any(fold["test_presence"] == 0 for fold in fold_summary):
        raise RuntimeError(
            "A spatial test fold contains no presence samples; reduce the spatial block size."
        )
    return predictions, fold_summary, n_splits


def metrics_for(labels: pd.Series, scores: np.ndarray) -> dict[str, float]:
    return {
        "roc_auc": float(roc_auc_score(labels, scores)),
        "pr_auc": float(average_precision_score(labels, scores)),
        "brier_score": float(brier_score_loss(labels, scores)),
        "balanced_accuracy_at_0_5": float(
            balanced_accuracy_score(labels, (scores >= 0.5).astype(int))
        ),
    }


def colour_for_score(score: float) -> str:
    stops = [
        (0.0, (68, 1, 84)),
        (0.25, (59, 82, 139)),
        (0.5, (33, 145, 140)),
        (0.75, (94, 201, 98)),
        (1.0, (253, 231, 37)),
    ]
    score = max(0.0, min(1.0, score))
    for (left_value, left_colour), (right_value, right_colour) in zip(stops, stops[1:]):
        if score <= right_value:
            ratio = (score - left_value) / (right_value - left_value)
            rgb = tuple(
                round(left + ratio * (right - left))
                for left, right in zip(left_colour, right_colour)
            )
            return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
    return "#fde725"


def generate_heatmap_svg(
    grid: pd.DataFrame,
    presence: pd.DataFrame,
    species: dict[str, str],
    model_name: str,
    output_path: Path,
    grid_size: float,
) -> None:
    min_lon, max_lon = float(grid.longitude.min()), float(grid.longitude.max())
    min_lat, max_lat = float(grid.latitude.min()), float(grid.latitude.max())
    mean_latitude = (min_lat + max_lat) / 2
    x_factor = math.cos(math.radians(mean_latitude))
    width = 1200
    margin = 70
    plot_width = width - 2 * margin
    geographic_ratio = (max_lat - min_lat + grid_size) / (
        (max_lon - min_lon + grid_size) * x_factor
    )
    plot_height = max(360, round(plot_width * geographic_ratio))
    height = plot_height + 2 * margin + 55

    def x_position(longitude: float) -> float:
        return margin + (longitude - (min_lon - grid_size / 2)) / (
            max_lon - min_lon + grid_size
        ) * plot_width

    def y_position(latitude: float) -> float:
        return margin + ((max_lat + grid_size / 2) - latitude) / (
            max_lat - min_lat + grid_size
        ) * plot_height

    cell_width = grid_size / (max_lon - min_lon + grid_size) * plot_width + 0.15
    cell_height = grid_size / (max_lat - min_lat + grid_size) * plot_height + 0.15
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" role="img" '
        f'aria-label="Relative occurrence heatmap for {species["scientific_name"]}" '
        f'width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        f'<text x="{margin}" y="32" font-family="Arial,sans-serif" font-size="22" fill="#172554">'
        f'{species["common_name_en"]} ({species["scientific_name"]})</text>',
        f'<text x="{margin}" y="54" font-family="Arial,sans-serif" font-size="13" fill="#475569">'
        f'Iteration 1 relative occurrence score · selected model: {model_name}</text>',
    ]
    for row in grid.itertuples(index=False):
        lines.append(
            f'<rect x="{x_position(row.longitude - grid_size / 2):.2f}" '
            f'y="{y_position(row.latitude + grid_size / 2):.2f}" '
            f'width="{cell_width:.2f}" height="{cell_height:.2f}" '
            f'fill="{colour_for_score(float(row.relative_occurrence_score))}"/>'
        )
    for row in presence.itertuples(index=False):
        lines.append(
            f'<circle cx="{x_position(row.longitude):.2f}" cy="{y_position(row.latitude):.2f}" '
            'r="2.1" fill="#ffffff" stroke="#111827" stroke-width="0.8"/>'
        )
    legend_x = margin
    legend_y = height - 43
    for index in range(101):
        lines.append(
            f'<rect x="{legend_x + index * 2.4:.1f}" y="{legend_y}" width="2.5" height="13" '
            f'fill="{colour_for_score(index / 100)}"/>'
        )
    lines.extend(
        [
            f'<text x="{legend_x}" y="{legend_y + 31}" font-family="Arial,sans-serif" font-size="12" fill="#334155">0 low</text>',
            f'<text x="{legend_x + 242}" y="{legend_y + 31}" text-anchor="end" font-family="Arial,sans-serif" font-size="12" fill="#334155">1 high</text>',
            f'<text x="{width - margin}" y="{legend_y + 11}" text-anchor="end" font-family="Arial,sans-serif" font-size="12" fill="#334155">White dots: gridded OBIS presences · background is not confirmed absence</text>',
            "</svg>",
        ]
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    config = load_config()
    processed_dir = ROOT / "data" / "processed"
    models_dir = ROOT / "models"
    artifacts_dir = ROOT / "artifacts"
    heatmaps_dir = artifacts_dir / "heatmaps"
    for directory in (models_dir, artifacts_dir, heatmaps_dir):
        directory.mkdir(parents=True, exist_ok=True)

    marine_grid = pd.read_csv(processed_dir / "malaysia_eez_marine_grid.csv")
    grid_features = marine_grid[["latitude", "longitude"]]
    metric_rows: list[dict[str, Any]] = []
    manifest_species: list[dict[str, Any]] = []
    fold_manifest: dict[str, Any] = {}

    for species_index, species in enumerate(config["species"]):
        slug = species["slug"]
        seed = int(config["random_seed"]) + species_index
        training = pd.read_csv(processed_dir / f"{slug}_training.csv")
        presence = pd.read_csv(processed_dir / f"{slug}_presence_grid.csv")
        features = training[["latitude", "longitude"]]
        labels = training["label"].astype(int)
        groups = training.apply(
            lambda row: spatial_group(
                float(row.latitude),
                float(row.longitude),
                float(config["spatial_cv_block_degrees"]),
            ),
            axis=1,
        )

        estimators = build_estimators(seed)
        fitted_models: dict[str, Any] = {}
        species_metrics: list[dict[str, Any]] = []
        for model_name, estimator in estimators.items():
            oof_scores, fold_summary, cv_folds = spatial_oof_predictions(
                estimator, features, labels, groups, seed
            )
            scores = metrics_for(labels, oof_scores)
            metric_row = {
                "species_slug": slug,
                "scientific_name": species["scientific_name"],
                "model": model_name,
                "evaluation": "stratified spatial-block cross-validation",
                "cv_folds": cv_folds,
                "spatial_block_degrees": config["spatial_cv_block_degrees"],
                "rows": len(training),
                "presence_rows": int(labels.sum()),
                "background_rows": int((labels == 0).sum()),
                **scores,
            }
            metric_rows.append(metric_row)
            species_metrics.append(metric_row)
            fold_manifest[f"{slug}:{model_name}"] = fold_summary

            estimator.fit(features, labels)
            fitted_models[model_name] = estimator
            bundle = {
                "model": estimator,
                "model_name": model_name,
                "species": species,
                "features": ["latitude", "longitude"],
                "grid_size_degrees": config["grid_size_degrees"],
                "background_ratio": config["background_ratio"],
                "score_interpretation": (
                    "Relative occurrence/suitability score under the sampled-background design; "
                    "not a calibrated real-world presence probability."
                ),
            }
            joblib.dump(bundle, models_dir / f"{slug}__{model_name}.joblib")

        selected = max(species_metrics, key=lambda row: (row["pr_auc"], row["roc_auc"]))
        selected_model_name = str(selected["model"])
        selected_model = fitted_models[selected_model_name]
        selected_path = models_dir / f"{slug}.joblib"
        joblib.dump(
            {
                "model": selected_model,
                "model_name": selected_model_name,
                "species": species,
                "features": ["latitude", "longitude"],
                "grid_size_degrees": config["grid_size_degrees"],
                "background_ratio": config["background_ratio"],
                "selection_rule": "highest spatial-CV PR-AUC, then ROC-AUC",
                "score_interpretation": (
                    "Relative occurrence/suitability score under the sampled-background design; "
                    "not a calibrated real-world presence probability."
                ),
            },
            selected_path,
        )

        heatmap = marine_grid.copy()
        heatmap["relative_occurrence_score"] = selected_model.predict_proba(grid_features)[:, 1]
        heatmap["species_slug"] = slug
        heatmap["scientific_name"] = species["scientific_name"]
        heatmap["selected_model"] = selected_model_name
        heatmap.to_csv(heatmaps_dir / f"{slug}_probability_grid.csv", index=False)
        generate_heatmap_svg(
            heatmap,
            presence,
            species,
            selected_model_name,
            heatmaps_dir / f"{slug}_heatmap.svg",
            float(config["grid_size_degrees"]),
        )

        manifest_species.append(
            {
                **species,
                "selected_model": selected_model_name,
                "selected_model_path": selected_path.relative_to(ROOT).as_posix(),
                "selection_metric_pr_auc": selected["pr_auc"],
                "selection_metric_roc_auc": selected["roc_auc"],
                "heatmap_grid_path": (
                    heatmaps_dir / f"{slug}_probability_grid.csv"
                ).relative_to(ROOT).as_posix(),
                "heatmap_svg_path": (
                    heatmaps_dir / f"{slug}_heatmap.svg"
                ).relative_to(ROOT).as_posix(),
            }
        )

    metrics = pd.DataFrame(metric_rows).sort_values(["species_slug", "pr_auc"], ascending=[True, False])
    metrics.to_csv(artifacts_dir / "model_metrics.csv", index=False)
    write_json(artifacts_dir / "spatial_cv_folds.json", fold_manifest)
    write_json(
        models_dir / "model_manifest.json",
        {
            "trained_at_utc": datetime.now(timezone.utc).isoformat(),
            "features": ["latitude", "longitude"],
            "species": manifest_species,
            "evaluation": {
                "method": "stratified spatial-block cross-validation (up to 5 folds)",
                "spatial_block_degrees": config["spatial_cv_block_degrees"],
                "selection_rule": "highest spatial-CV PR-AUC, then ROC-AUC",
            },
            "probability_warning": (
                "Scores depend on OBIS sampling and generated backgrounds. They are not calibrated "
                "probabilities of real-world presence."
            ),
        },
    )
    print(metrics.to_string(index=False))


if __name__ == "__main__":
    main()
