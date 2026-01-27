from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict


@dataclass(frozen=True)
class Config:
    incidents_url: str
    poll_interval_seconds: int
    output_html_path: Path
    output_json_path: Path
    sqlite_path: Path
    request_timeout_seconds: float
    request_retries: int
    request_backoff_base_seconds: float
    retention_seconds: int
    log_level: str
    mode: str
    tracemalloc_enabled: bool
    tracemalloc_interval: int
    tracemalloc_top: int
    debug_allocations: bool
    force_gc: bool

    @staticmethod
    def from_dict(values: Dict[str, Any]) -> "Config":
        output_dir = Path(values.get("output_dir", "./public"))
        output_html_value = values.get("output_html_path") or output_dir / "map.html"
        output_json_value = values.get("output_json_path") or output_dir / "incidents.json"
        output_html_path = Path(output_html_value)
        output_json_path = Path(output_json_value)
        sqlite_path = Path(values.get("sqlite_path", "./state/incidents.sqlite3"))

        return Config(
            incidents_url=str(values.get("incidents_url", "")),
            poll_interval_seconds=int(values.get("poll_interval_seconds", 30)),
            output_html_path=output_html_path,
            output_json_path=output_json_path,
            sqlite_path=sqlite_path,
            request_timeout_seconds=float(values.get("request_timeout_seconds", 10.0)),
            request_retries=int(values.get("request_retries", 3)),
            request_backoff_base_seconds=float(values.get("request_backoff_base_seconds", 1.5)),
            retention_seconds=int(values.get("retention_seconds", 0)),
            log_level=str(values.get("log_level", "INFO")),
            mode=str(values.get("mode", "combined")),
            tracemalloc_enabled=bool(values.get("tracemalloc_enabled", False)),
            tracemalloc_interval=int(values.get("tracemalloc_interval", 50)),
            tracemalloc_top=int(values.get("tracemalloc_top", 10)),
            debug_allocations=bool(values.get("debug_allocations", False)),
            force_gc=bool(values.get("force_gc", False)),
        )


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_config(config_path: str | None = None) -> Config:
    base: Dict[str, Any] = {
        "incidents_url": os.getenv("L911_INCIDENTS_URL", ""),
        "poll_interval_seconds": int(os.getenv("L911_POLL_INTERVAL", "30")),
        "output_dir": os.getenv("L911_OUTPUT_DIR", "./public"),
        "output_html_path": os.getenv("L911_OUTPUT_HTML", "") or None,
        "output_json_path": os.getenv("L911_OUTPUT_JSON", "") or None,
        "sqlite_path": os.getenv("L911_SQLITE_PATH", "./state/incidents.sqlite3"),
        "request_timeout_seconds": float(os.getenv("L911_REQUEST_TIMEOUT", "10")),
        "request_retries": int(os.getenv("L911_REQUEST_RETRIES", "3")),
        "request_backoff_base_seconds": float(os.getenv("L911_REQUEST_BACKOFF", "1.5")),
        "retention_seconds": int(os.getenv("L911_RETENTION_SECONDS", "0")),
        "log_level": os.getenv("L911_LOG_LEVEL", "INFO"),
        "mode": os.getenv("L911_MODE", "combined"),
        "tracemalloc_enabled": _env_bool("L911_TRACEMALLOC", False),
        "tracemalloc_interval": int(os.getenv("L911_TRACEMALLOC_INTERVAL", "50")),
        "tracemalloc_top": int(os.getenv("L911_TRACEMALLOC_TOP", "10")),
        "debug_allocations": _env_bool("L911_DEBUG_ALLOCATIONS", False),
        "force_gc": _env_bool("L911_FORCE_GC", False),
    }

    if base["output_html_path"]:
        base["output_html_path"] = Path(base["output_html_path"])  # type: ignore[arg-type]
    if base["output_json_path"]:
        base["output_json_path"] = Path(base["output_json_path"])  # type: ignore[arg-type]

    if config_path:
        config_file = Path(config_path)
        if config_file.exists():
            with config_file.open("r", encoding="utf-8") as handle:
                file_values = json.load(handle)
            base.update({k: v for k, v in file_values.items() if v is not None})

    return Config.from_dict(base)
