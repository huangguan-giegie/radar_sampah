from __future__ import annotations

from typing import Any

from flask import request


def install_legacy_small_only_guard(application: Any, impl: Any) -> None:
    """Keep legacy count input compatible without letting Small-only reports become Counted."""

    @application.before_request
    def reject_legacy_small_only_item_counts():
        if request.endpoint != "create_report":
            return None
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or "quantities" in payload or "itemCounts" not in payload:
            return None

        item_counts = impl.validate_item_counts(payload.get("itemCounts"))
        if not item_counts:
            return None
        quantities = impl.quantity_bands_for_counts(item_counts)
        if quantities and all(band == "Small" for band in quantities.values()):
            return impl.error_response(
                422,
                "SMALL_ONLY_REPORT",
                "This report is below the active litter threshold because every confirmed category is Small.",
            )
        return None
