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
