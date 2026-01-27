from __future__ import annotations

import argparse
import gc
import json
import logging
import os
import signal
import sys
import time
import tracemalloc
from typing import Any

import requests

from .config import Config, load_config
from .fetch_incidents import FetchError, fetch_incidents
from .map_render import render_map
from .state_store import StateStore


def _read_rss_bytes() -> int:
    try:
        import psutil  # type: ignore

        return psutil.Process(os.getpid()).memory_info().rss
    except Exception:
        with open("/proc/self/statm", "r", encoding="utf-8") as handle:
            data = handle.readline().split()
        if len(data) < 2:
            return 0
        page_size = os.sysconf("SC_PAGE_SIZE")
        return int(data[1]) * page_size


def _log_event(logger: logging.Logger, message: str, **fields: Any) -> None:
    payload = {"message": message, **fields}
    logger.info(json.dumps(payload, sort_keys=True))


def _log_tracemalloc(logger: logging.Logger, snapshot: tracemalloc.Snapshot, limit: int) -> None:
    top_stats = snapshot.statistics("lineno")[:limit]
    for stat in top_stats:
        frame = stat.traceback[0]
        _log_event(
            logger,
            "tracemalloc",
            file=str(frame.filename),
            line=frame.lineno,
            size_bytes=stat.size,
            count=stat.count,
        )


def run_loop(config: Config, logger: logging.Logger) -> int:
    stop = False

    def handle_signal(signum: int, _frame: object) -> None:
        nonlocal stop
        stop = True
        _log_event(logger, "signal", signal=signum)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    store = StateStore(config.sqlite_path)
    cycle = 0

    if config.tracemalloc_enabled:
        tracemalloc.start()

    while not stop:
        start_time = time.monotonic()
        cycle += 1
        _log_event(
            logger,
            "cycle_start",
            cycle=cycle,
            rss_bytes=_read_rss_bytes(),
            mode=config.mode,
        )

        new_count = 0
        rendered_count = 0
        try:
            if config.mode in {"combined", "fetch"}:
                session = requests.Session()
                try:
                    incidents = fetch_incidents(config, session)
                    new_count = store.upsert_incidents(incidents)
                finally:
                    session.close()

            if config.mode in {"combined", "render"}:
                rendered_count = render_map(config, store)

            if config.retention_seconds > 0:
                store.prune_incidents(config.retention_seconds)

            _log_event(
                logger,
                "cycle_complete",
                cycle=cycle,
                new_incidents=new_count,
                rendered_incidents=rendered_count,
                rss_bytes=_read_rss_bytes(),
            )
        except FetchError as exc:
            _log_event(logger, "fetch_error", error=str(exc), cycle=cycle)
        except Exception as exc:  # noqa: BLE001 - log and continue
            _log_event(logger, "cycle_error", error=str(exc), cycle=cycle)

        if config.tracemalloc_enabled and cycle % config.tracemalloc_interval == 0:
            snapshot = tracemalloc.take_snapshot()
            _log_tracemalloc(logger, snapshot, config.tracemalloc_top)
            if config.debug_allocations:
                top_stats = snapshot.statistics("traceback")[: config.tracemalloc_top]
                for stat in top_stats:
                    _log_event(
                        logger,
                        "tracemalloc_detail",
                        size_bytes=stat.size,
                        count=stat.count,
                        trace=str(stat.traceback),
                    )

        if config.force_gc:
            gc.collect()

        elapsed = time.monotonic() - start_time
        sleep_for = max(0, config.poll_interval_seconds - elapsed)
        if sleep_for:
            time.sleep(sleep_for)

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lafayette 911 incident scraper")
    parser.add_argument(
        "--config",
        dest="config_path",
        help="Path to JSON configuration file",
        default=None,
    )
    parser.add_argument(
        "--mode",
        choices=["combined", "fetch", "render"],
        help="Override configured mode",
        default=None,
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    config = load_config(args.config_path)
    if args.mode:
        config = Config(
            **{**config.__dict__, "mode": args.mode},  # type: ignore[arg-type]
        )

    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        stream=sys.stdout,
    )
    logger = logging.getLogger("lafayette911")

    _log_event(logger, "startup", mode=config.mode, rss_bytes=_read_rss_bytes())
    return run_loop(config, logger)


if __name__ == "__main__":
    raise SystemExit(main())
