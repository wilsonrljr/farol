"""Centralized API error handling.

Goal: keep route handlers clean and ensure consistent HTTP responses.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def install_exception_handlers(app: FastAPI) -> None:
    """Install exception handlers on the FastAPI app."""

    @app.exception_handler(ValueError)
    async def _value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(
        request: Request,
        _exc: Exception,
    ) -> JSONResponse:
        # Avoid leaking internal details; log for diagnosis.
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )


def configure_logging() -> None:
    """Basic logging configuration (safe defaults).

    Respects user-defined logging config if already configured.
    """
    logging.basicConfig(level=logging.INFO)
