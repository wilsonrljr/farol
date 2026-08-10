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
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean (true/false, 1/0, yes/no, on/off)")


def _env_str(name: str, default: str) -> str:
    return os.getenv(name, default)


def _env_int(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if raw is None:
        return list(default)

    raw = raw.strip()
    if not raw:
        return []

    # Accept JSON arrays (preferred) or comma-separated strings.
    if raw.startswith("["):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{name} must be a valid JSON array") from exc
        if isinstance(data, list) and all(isinstance(v, str) for v in data):
            return [v.strip() for v in data if v.strip()]
        raise ValueError(f"{name} must be a JSON array of strings")

    return [part.strip() for part in raw.split(",") if part.strip()]


@dataclass(frozen=True)
class AppConfig:
    app_name: str
    api_title: str
    api_description: str
    version: str

    api_host: str
    api_port: int

    cors_allow_origins: list[str]
    cors_allow_credentials: bool
    cors_allow_methods: list[str]
    cors_allow_headers: list[str]
    cors_expose_headers: list[str]

    enable_request_id: bool
    max_request_body_bytes: int = 4 * 1024 * 1024


def load_config() -> AppConfig:
    app_name = _env_str("APP_NAME", "Farol")
    api_title = _env_str("API_TITLE", f"{app_name} API")
    api_description = _env_str(
        "API_DESCRIPTION",
        "Plataforma Farol: simulação e planejamento financeiro (imóveis hoje; outros objetivos no futuro).",
    )
    version = _env_str("API_VERSION", "0.1.0")

    api_host = _env_str("API_HOST", "0.0.0.0")
    # API_PORT is the canonical name. PORT remains supported for common PaaS
    # environments, but is only read when API_PORT is absent.
    port_env = "API_PORT" if os.getenv("API_PORT") is not None else "PORT"
    api_port = _env_int(port_env, 8000, minimum=1, maximum=65535)

    origins_env = (
        "CORS_ALLOW_ORIGINS"
        if os.getenv("CORS_ALLOW_ORIGINS") is not None
        else "CORS_ORIGINS"
    )
    cors_allow_origins = _env_list(origins_env, ["*"])
    cors_allow_credentials = _env_bool("CORS_ALLOW_CREDENTIALS", False)
    cors_allow_methods = _env_list("CORS_ALLOW_METHODS", ["*"])
    cors_allow_headers = _env_list("CORS_ALLOW_HEADERS", ["*"])
    cors_expose_headers = _env_list(
        "CORS_EXPOSE_HEADERS", ["Content-Disposition", "X-Request-ID"]
    )

    # Browser CORS rules: allow_origins cannot be "*" when allow_credentials=True.
    if "*" in cors_allow_origins and len(cors_allow_origins) != 1:
        raise ValueError("CORS_ALLOW_ORIGINS cannot mix '*' with explicit origins")
    if cors_allow_credentials and "*" in cors_allow_origins:
        raise ValueError(
            "CORS_ALLOW_CREDENTIALS=true requires an explicit "
            "CORS_ALLOW_ORIGINS allowlist"
        )

    enable_request_id = _env_bool("ENABLE_REQUEST_ID", True)
    max_request_body_bytes = _env_int(
        "MAX_REQUEST_BODY_BYTES",
        4 * 1024 * 1024,
        minimum=1024,
        maximum=50 * 1024 * 1024,
    )

    return AppConfig(
        app_name=app_name,
        api_title=api_title,
        api_description=api_description,
        version=version,
        api_host=api_host,
        api_port=api_port,
        cors_allow_origins=cors_allow_origins,
        cors_allow_credentials=cors_allow_credentials,
        cors_allow_methods=cors_allow_methods,
        cors_allow_headers=cors_allow_headers,
        cors_expose_headers=cors_expose_headers,
        enable_request_id=enable_request_id,
        max_request_body_bytes=max_request_body_bytes,
    )
