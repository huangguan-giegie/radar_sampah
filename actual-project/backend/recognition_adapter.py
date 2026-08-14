"""Optional, privacy-bounded adapter for a configured species recogniser."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen


def recognise(image_url: str, species_hint: str | None, species_ids: set[str]) -> dict[str, Any]:
    """Use a configured adapter when safe; otherwise return a deterministic demo result."""
    adapter_url = (
        os.getenv("SPECIES_RECOGNITION_API_URL")
        or os.getenv("RECOGNITION_ADAPTER_URL")
        or ""
    ).strip()
    api_key = os.getenv("SPECIES_RECOGNITION_API_KEY", "").strip()
    try:
        timeout = max(1, int(os.getenv("SPECIES_RECOGNITION_TIMEOUT_MS", "4000"))) / 1000
    except ValueError:
        timeout = 4
    external_enabled = os.getenv("TIDETRACE_RECOGNITION_ENABLED", "false").strip().lower() in {"1", "true", "yes"}
    if external_enabled and adapter_url.startswith("https://"):
        try:
            payload = json.dumps({"image_url": image_url, "species_hint": species_hint}).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            request = Request(adapter_url, data=payload, headers=headers, method="POST")
            with urlopen(request, timeout=timeout) as response:  # nosec B310 - HTTPS-only configured endpoint
                result = json.loads(response.read().decode("utf-8"))
            species_id = result.get("species_id") if isinstance(result, dict) else None
            if species_id in species_ids:
                return {
                    "status": "provider_suggestion",
                    "candidates": [species_id],
                    "provider": "configured_external_api",
                    "needs_user_confirmation": True,
                    "source": "configured provider suggestion; not verified",
                    "species_id": species_id,
                    "method": "configured_external_adapter",
                    "confidence": "unverified",
                    "data_sent_to_provider": True,
                    "illustrative": True,
                }
        except (URLError, TimeoutError, ValueError, OSError):
            pass
    selected = species_hint if species_hint in species_ids else sorted(species_ids)[0]
    return {
        "status": "demo_fallback",
        "candidates": [selected],
        "provider": "demo",
        "needs_user_confirmation": True,
        "source": "synthetic/public demonstration data",
        "species_id": selected,
        "method": "local_demo_fallback",
        "confidence": "illustrative",
        "data_sent_to_provider": False,
        "illustrative": True,
    }


def recognise_litter(image_url: str, category_hint: str | None, categories: set[str]) -> dict[str, Any]:
    """Return a local category suggestion unless an explicitly enabled adapter is configured."""
    enabled = os.getenv("LITTER_RECOGNITION_ENABLED", os.getenv("TIDETRACE_RECOGNITION_ENABLED", "false")).strip().lower() in {"1", "true", "yes"}
    adapter_url = os.getenv("LITTER_RECOGNITION_API_URL", os.getenv("TIDETRACE_RECOGNITION_API_URL", "")).strip()
    api_key = os.getenv("LITTER_RECOGNITION_API_KEY", os.getenv("TIDETRACE_RECOGNITION_API_KEY", "")).strip()
    try:
        timeout = max(1, int(os.getenv("LITTER_RECOGNITION_TIMEOUT_MS", os.getenv("TIDETRACE_RECOGNITION_TIMEOUT_MS", "4000")))) / 1000
    except ValueError:
        timeout = 4
    if enabled and adapter_url.startswith("https://"):
        try:
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            request = Request(adapter_url, data=json.dumps({"image_url": image_url, "category_hint": category_hint}).encode("utf-8"), headers=headers, method="POST")
            with urlopen(request, timeout=timeout) as response:  # nosec B310 - configured HTTPS endpoint only
                result = json.loads(response.read().decode("utf-8"))
            category = result.get("category") if isinstance(result, dict) else None
            if category in categories:
                return {
                    "status": "provider_suggestion",
                    "category": category,
                    "candidates": [category],
                    "method": "configured_external_adapter",
                    "provider": "configured_external_api",
                    "needs_user_confirmation": True,
                    "source": "configured provider suggestion; not verified",
                    "confidence": "unverified",
                    "data_sent_to_provider": True,
                    "illustrative": True,
                }
        except (URLError, TimeoutError, ValueError, OSError):
            pass
    # TideTrace never contacts a provider by default. This keeps demo image URLs local.
    selected = next((category for category in categories if category.lower() == (category_hint or "").lower()), sorted(categories)[0])
    return {
        "status": "demo_fallback",
        "category": selected,
        "candidates": [selected],
        "method": "local_demo_fallback",
        "provider": "demo",
        "needs_user_confirmation": True,
        "source": "synthetic/public demonstration data",
        "confidence": "illustrative",
        "data_sent_to_provider": False,
        "illustrative": True,
    }
