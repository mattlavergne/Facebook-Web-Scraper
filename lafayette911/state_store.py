from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Dict, Iterable, Iterator


class StateStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self._ensure_directory()
        self._initialize()

    def _ensure_directory(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def _initialize(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS incidents (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def upsert_incidents(self, incidents: Iterable[Dict[str, object]]) -> int:
        now = int(time.time())
        inserted = 0
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("BEGIN")
            for incident in incidents:
                payload = json.dumps(incident, ensure_ascii=False)
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO incidents (id, data, updated_at)
                    VALUES (?, ?, ?)
                    """,
                    (incident["id"], payload, now),
                )
                if cursor.rowcount:
                    inserted += 1
            conn.commit()
        return inserted

    def load_incidents(self) -> Iterator[Dict[str, object]]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT data FROM incidents ORDER BY updated_at DESC"
            )
            for row in cursor:
                yield json.loads(row[0])

    def prune_incidents(self, retention_seconds: int) -> int:
        if retention_seconds <= 0:
            return 0
        cutoff = int(time.time()) - retention_seconds
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM incidents WHERE updated_at < ?",
                (cutoff,),
            )
            conn.commit()
            return cursor.rowcount

    def set_meta(self, key: str, value: str) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
                (key, value),
            )
            conn.commit()

    def get_meta(self, key: str) -> str | None:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT value FROM meta WHERE key = ?", (key,))
            row = cursor.fetchone()
            if row:
                return row[0]
        return None
