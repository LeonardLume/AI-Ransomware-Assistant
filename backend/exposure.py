from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from backend.config import DATA_DIR


@lru_cache(maxsize=1)
def load_external_exposure_checklist() -> list[dict[str, Any]]:
    with open(DATA_DIR / "external_exposure_checklist.json", "r", encoding="utf-8") as f:
        return json.load(f)


def build_external_exposure_self_check() -> dict[str, Any]:
    return {
        "type": "self_reported_advisory_only",
        "scanning_performed": False,
        "external_services_queried": False,
        "note": "No OSINT, domain enumeration, Shodan/Censys/HIBP lookup, IP scan, or SpiderFoot run is performed.",
        "items": load_external_exposure_checklist(),
    }
