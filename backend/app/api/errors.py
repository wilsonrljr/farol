"""Centralized API error handling.

Goal: keep route handlers clean and ensure consistent HTTP responses.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi.responses import JSONResponse

if TYPE_CHECKING:
    from fastapi import FastAPI, Request

    from ..config import AppConfig

logger = logging.getLogger(__name__)


class PublicInputError(ValueError):
    """A deliberate, user-safe business-rule error exposed as HTTP 400."""


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _error_headers(request: Request, config: AppConfig) -> dict[str, str]:
    """Headers that must survive even when Starlette handles a server error."""
    headers: dict[str, str] = {}
    request_id = _request_id(request)
    if request_id is not None:
        headers["X-Request-ID"] = request_id

    if request.url.path.startswith("/api/"):
        headers.update(
            {
                "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )

    origin = request.headers.get("Origin")
    if origin:
        if "*" in config.cors_allow_origins:
            headers["Access-Control-Allow-Origin"] = "*"
        elif origin in config.cors_allow_origins:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Vary"] = "Origin"

        if "Access-Control-Allow-Origin" in headers:
            if config.cors_allow_credentials:
                headers["Access-Control-Allow-Credentials"] = "true"
            if config.cors_expose_headers:
                headers["Access-Control-Expose-Headers"] = ", ".join(
                    config.cors_expose_headers
                )

    return headers


def internal_error_response(request: Request, config: AppConfig) -> JSONResponse:
    content: dict[str, str] = {"detail": "Internal server error"}
    request_id = _request_id(request)
    if request_id is not None:
        content["request_id"] = request_id
    return JSONResponse(
        status_code=500,
        content=content,
        headers=_error_headers(request, config),
    )


def install_exception_handlers(app: FastAPI, config: AppConfig) -> None:
    """Install exception handlers on the FastAPI app."""

    @app.exception_handler(PublicInputError)
    async def _public_input_error_handler(
        request: Request, exc: PublicInputError
    ) -> JSONResponse:
        content: dict[str, str] = {"detail": str(exc)}
        request_id = _request_id(request)
        if request_id is not None:
            content["request_id"] = request_id
        return JSONResponse(
            status_code=400,
            content=content,
            headers=_error_headers(request, config),
        )

    @app.exception_handler(ValueError)
    async def _unexpected_value_error_handler(
        request: Request, _exc: ValueError
    ) -> JSONResponse:
        # ValueError is also raised by serializers and third-party libraries.
        # Treat only PublicInputError as safe to show to a caller.
        logger.exception(
            "Unexpected value error on %s %s rid=%s",
            request.method,
            request.url.path,
            _request_id(request) or "-",
        )
        return internal_error_response(request, config)

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(
        request: Request,
        _exc: Exception,
    ) -> JSONResponse:
        # Avoid leaking internal details; log for diagnosis.
        logger.exception(
            "Unhandled exception on %s %s rid=%s",
            request.method,
            request.url,
            _request_id(request) or "-",
        )
        return internal_error_response(request, config)


def configure_logging() -> None:
    """Basic logging configuration (safe defaults).

    Respects user-defined logging config if already configured.
    """
    logging.basicConfig(level=logging.INFO)
