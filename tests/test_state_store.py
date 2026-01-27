import json
import tempfile
import unittest
from pathlib import Path

from lafayette911.state_store import StateStore


class StateStoreTests(unittest.TestCase):
    def test_dedupe_and_persistence(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "incidents.sqlite3"
            store = StateStore(db_path)

            incidents = [
                {"id": "a", "summary": "Test A", "timestamp": "t1", "lat": 1.0, "lon": 2.0},
                {"id": "b", "summary": "Test B", "timestamp": "t2", "lat": 3.0, "lon": 4.0},
            ]

            inserted = store.upsert_incidents(iter(incidents))
            self.assertEqual(inserted, 2)

            inserted_again = store.upsert_incidents(iter(incidents))
            self.assertEqual(inserted_again, 0)

            store = StateStore(db_path)
            loaded = list(store.load_incidents())
            loaded_ids = {item["id"] for item in loaded}
            self.assertEqual(loaded_ids, {"a", "b"})

            store.set_meta("last_run", json.dumps({"cycle": 1}))
            self.assertEqual(store.get_meta("last_run"), json.dumps({"cycle": 1}))


if __name__ == "__main__":
    unittest.main()
