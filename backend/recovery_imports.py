from __future__ import annotations

import csv
import io
import json
from typing import Any

import yaml


def parse_evidence_text(
    text: str,
    *,
    source: str = "generic",
    evidence_format: str | None = None,
) -> list[dict[str, Any]]:
    """Parse pasted evidence text into raw evidence dictionaries.

    This parser is intentionally import-only. It does not call vendor APIs, execute
    scanners, open network connections, or run third-party tools.
    """
    clean = text.strip()
    if not clean:
        return []

    selected_format = (evidence_format or _infer_format(clean)).strip().lower()
    if selected_format == "json":
        parsed = json.loads(clean)
        return _rows_from_parsed(parsed, source=source)
    if selected_format in {"yaml", "yml"}:
        parsed = yaml.safe_load(clean)
        return _rows_from_parsed(parsed, source=source)
    if selected_format == "csv":
        return _rows_from_csv(clean, source=source)
    raise ValueError(f"Unsupported evidence format: {selected_format}")


def _infer_format(text: str) -> str:
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        return "json"
    first_line = stripped.splitlines()[0] if stripped.splitlines() else ""
    if "," in first_line and any(header in first_line.lower() for header in ("title", "check", "control", "status", "summary")):
        return "csv"
    return "yaml"


def _rows_from_parsed(parsed: Any, *, source: str) -> list[dict[str, Any]]:
    if parsed is None:
        return []
    if isinstance(parsed, list):
        return [_with_source(item, source) for item in parsed if isinstance(item, dict)]
    if isinstance(parsed, dict):
        for key in ("items", "findings", "results", "controls", "checks"):
            value = parsed.get(key)
            if isinstance(value, list):
                return [_with_source(item, source) for item in value if isinstance(item, dict)]
        return [_with_source(parsed, source)]
    return []


def _rows_from_csv(text: str, *, source: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    for row in reader:
        if not row:
            continue
        cleaned = {str(key or "").strip(): value for key, value in row.items() if str(key or "").strip()}
        if cleaned:
            rows.append(_with_source(cleaned, source))
    return rows


def _with_source(item: dict[str, Any], source: str) -> dict[str, Any]:
    if item.get("source"):
        return dict(item)
    return {**item, "source": source}
