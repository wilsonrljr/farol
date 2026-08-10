"""API middlewares.

Kept separate from main.py so the application entrypoint remains focused on wiring.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from collections import deque
from typing import TYPE_CHECKING

from fastapi.responses import JSONResponse

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from fastapi import FastAPI, Request
    from starlette.responses import Response
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

    from ..config import AppConfig

logger = logging.getLogger(__name__)

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_BODY_METHODS = frozenset({"POST", "PUT", "PATCH"})


class RequestBodyLimitMiddleware:
    """Reject oversized API bodies before JSON parsing or model validation.

    The reverse proxy enforces the same limit in production. Keeping this
    boundary in the ASGI app protects direct deployments and tests too. Bodies
    without ``Content-Length`` are buffered only up to the configured limit and
    then replayed to FastAPI, so chunked transfer encoding cannot bypass it.
    """

    def __init__(self, app: ASGIApp, *, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def _reject(self, scope: Scope, receive: Receive, send: Send) -> None:
        response = JSONResponse(
            status_code=413,
            content={
                "detail": (
                    f"Request body is too large (maximum {self.max_body_bytes} bytes)"
                )
            },
        )
        await response(scope, receive, send)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") not in _BODY_METHODS
            or not str(scope.get("path", "")).startswith("/api/")
        ):
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        raw_content_length = headers.get(b"content-length")
        if raw_content_length is not None:
            try:
                if int(raw_content_length) > self.max_body_bytes:
                    await self._reject(scope, receive, send)
                    return
            except ValueError:
                # The ASGI server normally rejects malformed framing. If a
                # custom server forwards it, the measured limit below remains
                # authoritative.
                pass

        messages: deque[Message] = deque()
        received = 0
        while True:
            message = await receive()
            messages.append(message)

            if message["type"] != "http.request":
                break

            received += len(message.get("body", b""))
            if received > self.max_body_bytes:
                await self._reject(scope, receive, send)
                return
            if not message.get("more_body", False):
                break

        async def replay_receive() -> Message:
            if messages:
                return messages.popleft()
            return await receive()

        await self.app(scope, replay_receive, send)


def _request_id_from_header(request: Request) -> str:
    candidate = request.headers.get("X-Request-ID", "")
    if _REQUEST_ID_PATTERN.fullmatch(candidate):
        return candidate
    return str(uuid.uuid4())


def install_request_context_middleware(app: FastAPI, config: AppConfig) -> None:
    @app.middleware("http")
    async def _request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id: str | None = None
        if config.enable_request_id:
            request_id = _request_id_from_header(request)
            request.state.request_id = request_id

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:  # pragma: no cover - exercised through TestClient integration
            # ServerErrorMiddleware sits outside user middleware and would
            # otherwise create a headerless response. The error response adds
            # CORS itself because this middleware intentionally wraps CORS.
            logger.exception(
                "Unhandled exception on %s %s rid=%s",
                request.method,
                request.url.path,
                request_id or "-",
            )
            from .errors import internal_error_response

            response = internal_error_response(request, config)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        if request_id is not None:
            response.headers["X-Request-ID"] = request_id

        logger.info(
            "%s %s -> %s (%.1fms) rid=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id or "-",
        )
        return response


def install_no_cache_middleware(app: FastAPI) -> None:
    """Disable HTTP caching for API endpoints.

    This prevents stale/mismatched simulation results when running behind
    intermediaries that might cache responses aggressively.
    """

    @app.middleware("http")
    async def _no_cache_headers(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
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
