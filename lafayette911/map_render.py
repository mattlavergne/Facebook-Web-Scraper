from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Dict, Iterable

from .config import Config
from .state_store import StateStore


_HTML_TEMPLATE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>{title}</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      body {{ margin: 0; font-family: sans-serif; }}
      #map {{ height: 100vh; width: 100vw; }}
      .map-footer {{
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(255, 255, 255, 0.9);
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
      }}
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="map-footer">{count} incidents</div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      async function init() {{
        const response = await fetch("{json_path}", {{ cache: "no-store" }});
        const incidents = await response.json();
        const map = L.map("map").setView([{center_lat}, {center_lon}], {zoom});
        L.tileLayer("https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png", {{
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }}).addTo(map);
        incidents.forEach((incident) => {{
          if (!incident.lat || !incident.lon) return;
          const marker = L.marker([incident.lat, incident.lon]).addTo(map);
          const label = `${{incident.summary || "Incident"}}<br />${{incident.timestamp || ""}}`;
          marker.bindPopup(label);
        }});
      }}
      init();
    </script>
  </body>
</html>
"""


def _atomic_write(path: Path, contents: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8") as handle:
        handle.write(contents)
        temp_name = handle.name
    os.replace(temp_name, path)


def _write_json_stream(path: Path, incidents: Iterable[Dict[str, object]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with tempfile.NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8") as handle:
        handle.write("[")
        first = True
        for incident in incidents:
            if not first:
                handle.write(",")
            handle.write(json.dumps(incident, ensure_ascii=False))
            first = False
            count += 1
        handle.write("]")
        temp_name = handle.name
    os.replace(temp_name, path)
    return count


def render_map(config: Config, store: StateStore) -> int:
    incidents = store.load_incidents()
    first_lat = None
    first_lon = None

    def _incident_stream() -> Iterable[Dict[str, object]]:
        nonlocal first_lat, first_lon
        for incident in incidents:
            if first_lat is None and incident.get("lat") and incident.get("lon"):
                first_lat = incident["lat"]
                first_lon = incident["lon"]
            yield incident

    count = _write_json_stream(config.output_json_path, _incident_stream())

    if first_lat is None:
        first_lat = 30.2241
        first_lon = -92.0198

    html = _HTML_TEMPLATE.format(
        title="Lafayette 911 Incidents",
        count=count,
        json_path=config.output_json_path.name,
        center_lat=first_lat,
        center_lon=first_lon,
        zoom=12,
    )
    _atomic_write(config.output_html_path, html)

    return count
