"""API middlewares.

Kept separate from main.py so the application entrypoint remains focused on wiring.
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request

from ..config import AppConfig

logger = logging.getLogger(__name__)


def install_request_context_middleware(app: FastAPI, config: AppConfig) -> None:
    if not config.enable_request_id:
        return

    @app.middleware("http")
    async def _request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        response.headers["X-Request-ID"] = request_id

        logger.info(
            "%s %s -> %s (%.1fms) rid=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )
        return response


def install_no_cache_middleware(app: FastAPI) -> None:
    """Disable HTTP caching for API endpoints.

    This prevents stale/mismatched simulation results when running behind
    intermediaries that might cache responses aggressively.
    """

    @app.middleware("http")
    async def _no_cache_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)

        # Only touch API routes; keep docs/static behavior unchanged.
        if request.url.path.startswith("/api/"):
            response.headers.setdefault(
                "Cache-Control",
                "no-store, no-cache, max-age=0, must-revalidate",
            )
            response.headers.setdefault("Pragma", "no-cache")
            response.headers.setdefault("Expires", "0")

        return response
