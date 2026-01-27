from __future__ import annotations

import hashlib
import json
import time
from typing import Dict, Iterable, Iterator

import requests

from .config import Config


class FetchError(RuntimeError):
    pass


def _normalize_incident(item: Dict[str, object]) -> Dict[str, object]:
    incident_id = item.get("id") or item.get("incident_id")
    summary = item.get("summary") or item.get("description") or ""
    timestamp = item.get("timestamp") or item.get("time") or ""
    lat = item.get("lat") or item.get("latitude")
    lon = item.get("lon") or item.get("longitude")

    if not incident_id:
        stable_payload = json.dumps(
            {
                "summary": summary,
                "timestamp": timestamp,
                "lat": lat,
                "lon": lon,
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        incident_id = hashlib.sha256(stable_payload.encode("utf-8")).hexdigest()

    return {
        "id": str(incident_id),
        "summary": summary,
        "timestamp": timestamp,
        "lat": lat,
        "lon": lon,
    }


def fetch_incidents(config: Config, session: requests.Session) -> Iterator[Dict[str, object]]:
    if not config.incidents_url:
        raise FetchError("incidents_url is not configured")

    last_error: Exception | None = None
    for attempt in range(1, config.request_retries + 1):
        response = None
        try:
            response = session.get(
                config.incidents_url,
                timeout=config.request_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            break
        except Exception as exc:  # noqa: BLE001 - wrapped below
            last_error = exc
            if attempt < config.request_retries:
                backoff = config.request_backoff_base_seconds * (2 ** (attempt - 1))
                time.sleep(backoff)
            continue
        finally:
            if response is not None:
                response.close()
    else:
        raise FetchError(f"failed to fetch incidents: {last_error}")

    items: Iterable[Dict[str, object]]
    if isinstance(payload, dict):
        raw_items = payload.get("incidents") or payload.get("data") or []
        if not isinstance(raw_items, list):
            raise FetchError("unexpected payload shape")
        items = raw_items
    elif isinstance(payload, list):
        items = payload
    else:
        raise FetchError("unexpected payload type")

    for item in items:
        if not isinstance(item, dict):
            continue
        yield _normalize_incident(item)

    payload = None
