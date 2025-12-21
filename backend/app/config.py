"""Application configuration.

Centralizes environment-driven settings so the entrypoint (main.py) stays thin.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    raw = raw.strip().lower()
    return raw in {"1", "true", "yes", "y", "on"}


def _env_str(name: str, default: str) -> str:
    return os.getenv(name, default)


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if raw is None:
        return default

    raw = raw.strip()
    if not raw:
        return []

    # Accept JSON arrays (preferred) or comma-separated strings.
    if raw.startswith("["):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return default
        if isinstance(data, list) and all(isinstance(v, str) for v in data):
            return [v.strip() for v in data if v.strip()]
        return default

    return [part.strip() for part in raw.split(",") if part.strip()]


@dataclass(frozen=True)
class AppConfig:
    app_name: str
    api_title: str
    api_description: str
    version: str

    cors_allow_origins: list[str]
    cors_allow_credentials: bool
    cors_allow_methods: list[str]
    cors_allow_headers: list[str]

    enable_request_id: bool


def load_config() -> AppConfig:
    app_name = _env_str("APP_NAME", "Farol")
    api_title = _env_str("API_TITLE", f"{app_name} API")
    api_description = _env_str(
        "API_DESCRIPTION",
        "Plataforma Farol: simulação e planejamento financeiro (imóveis hoje; outros objetivos no futuro).",
    )
    version = _env_str("API_VERSION", "0.1.0")

    cors_allow_origins = _env_list("CORS_ALLOW_ORIGINS", ["*"])
    cors_allow_credentials = _env_bool("CORS_ALLOW_CREDENTIALS", False)
    cors_allow_methods = _env_list("CORS_ALLOW_METHODS", ["*"])
    cors_allow_headers = _env_list("CORS_ALLOW_HEADERS", ["*"])

    # Browser CORS rules: allow_origins cannot be "*" when allow_credentials=True.
    if cors_allow_credentials and "*" in cors_allow_origins:
        cors_allow_credentials = False

    enable_request_id = _env_bool("ENABLE_REQUEST_ID", True)

    return AppConfig(
        app_name=app_name,
        api_title=api_title,
        api_description=api_description,
        version=version,
        cors_allow_origins=cors_allow_origins,
        cors_allow_credentials=cors_allow_credentials,
        cors_allow_methods=cors_allow_methods,
        cors_allow_headers=cors_allow_headers,
        enable_request_id=enable_request_id,
    )
