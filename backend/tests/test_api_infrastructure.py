from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from backend.app.api.errors import install_exception_handlers
from backend.app.api.middleware import (
    RequestBodyLimitMiddleware,
    install_no_cache_middleware,
    install_request_context_middleware,
)
from backend.app.config import AppConfig, load_config
from backend.app.main import app

if TYPE_CHECKING:
    from collections.abc import Iterator

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _isolated_config() -> AppConfig:
    return AppConfig(
        app_name="Farol Test",
        api_title="Farol Test API",
        api_description="test",
        version="test",
        api_host="127.0.0.1",
        api_port=8000,
        cors_allow_origins=["https://farol.example"],
        cors_allow_credentials=False,
        cors_allow_methods=["*"],
        cors_allow_headers=["*"],
        cors_expose_headers=["Content-Disposition", "X-Request-ID"],
        enable_request_id=True,
    )


def test_health_and_readiness_probes() -> None:
    client = TestClient(app)

    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").json() == {"status": "ready"}


def test_unhandled_error_keeps_cors_cache_and_request_context_headers() -> None:
    config = _isolated_config()
    isolated_app = FastAPI()
    install_exception_handlers(isolated_app, config)
    install_request_context_middleware(isolated_app, config)
    install_no_cache_middleware(isolated_app)
    isolated_app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_allow_origins,
        allow_credentials=config.cors_allow_credentials,
        allow_methods=config.cors_allow_methods,
        allow_headers=config.cors_allow_headers,
        expose_headers=config.cors_expose_headers,
    )

    @isolated_app.get("/api/boom")
    async def _boom() -> None:
        raise RuntimeError("sensitive implementation detail")

    client = TestClient(isolated_app, raise_server_exceptions=False)
    response = client.get(
        "/api/boom",
        headers={
            "Origin": "https://farol.example",
            "X-Request-ID": "client-request-123",
        },
    )

    assert response.status_code == 500
    assert response.json() == {
        "detail": "Internal server error",
        "request_id": "client-request-123",
    }
    assert response.headers["x-request-id"] == "client-request-123"
    assert response.headers["access-control-allow-origin"] == "https://farol.example"
    assert "Content-Disposition" in response.headers["access-control-expose-headers"]
    assert "no-store" in response.headers["cache-control"]


def test_unexpected_value_error_does_not_expose_internal_details() -> None:
    config = _isolated_config()
    isolated_app = FastAPI()
    install_exception_handlers(isolated_app, config)

    @isolated_app.get("/api/value-error")
    async def _value_error() -> None:
        raise ValueError("sensitive serializer or library detail")

    response = TestClient(isolated_app, raise_server_exceptions=False).get(
        "/api/value-error"
    )

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert "sensitive" not in response.text


def test_invalid_client_request_id_is_replaced() -> None:
    client = TestClient(app)
    response = client.get("/healthz", headers={"X-Request-ID": "not valid / unsafe"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] != "not valid / unsafe"
    assert len(response.headers["x-request-id"]) == 36


def test_cors_preflight_keeps_request_context_and_no_cache_headers() -> None:
    response = TestClient(app).options(
        "/api/fire",
        headers={
            "Origin": "https://farol.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-request-id",
            "X-Request-ID": "preflight-request-123",
        },
    )

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "preflight-request-123"
    assert "no-store" in response.headers["cache-control"]
    assert response.headers["access-control-allow-origin"] == "*"


def test_gzip_threshold_is_honored_for_small_api_responses() -> None:
    response = TestClient(app).get(
        "/api/not-found",
        headers={"Accept-Encoding": "gzip"},
    )

    assert response.status_code == 404
    assert "content-encoding" not in response.headers


def test_api_rejects_declared_and_chunked_bodies_above_limit() -> None:
    client = TestClient(app)
    limit_middleware = next(
        middleware
        for middleware in app.user_middleware
        if middleware.cls is RequestBodyLimitMiddleware
    )
    maximum = limit_middleware.kwargs["max_body_bytes"]

    declared = client.post(
        "/api/fire",
        content=b"{}",
        headers={
            "Content-Length": str(maximum + 1),
            "Origin": "https://farol.example",
            "X-Request-ID": "oversized-request-123",
        },
    )

    def _chunked_body() -> Iterator[bytes]:
        yield b"x" * maximum
        yield b"x"

    chunked = client.post("/api/fire", content=_chunked_body())

    for response in (declared, chunked):
        assert response.status_code == 413
        assert response.json()["detail"].startswith("Request body is too large")
        assert "no-store" in response.headers["cache-control"]
        assert response.headers["x-request-id"]

    assert declared.headers["access-control-allow-origin"] == "*"
    assert declared.headers["x-request-id"] == "oversized-request-123"


def test_api_body_limit_replays_valid_bodies_unchanged() -> None:
    response = TestClient(app).post(
        "/api/fire",
        json={
            "monthly_expenses": 5_000.0,
            "current_portfolio": 100_000.0,
            "horizon_months": 12,
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["monthly_data"]


def test_tool_responses_omit_inapplicable_null_fields() -> None:
    response = TestClient(app).post(
        "/api/fire",
        json={
            "monthly_expenses": 5_000.0,
            "current_portfolio": 100_000.0,
            "horizon_months": 12,
            "fire_mode": "traditional",
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "fi_age" not in data
    assert "coast_fire_number" not in data
    assert "age" not in data["monthly_data"][0]


def test_config_fails_fast_for_invalid_cors_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", '["https://farol.example"')

    with pytest.raises(ValueError, match="CORS_ALLOW_ORIGINS"):
        load_config()


def test_config_rejects_credentials_with_wildcard(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "*")
    monkeypatch.setenv("CORS_ALLOW_CREDENTIALS", "true")

    with pytest.raises(ValueError, match="explicit"):
        load_config()


def test_config_rejects_invalid_request_body_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MAX_REQUEST_BODY_BYTES", "not-a-number")

    with pytest.raises(ValueError, match="MAX_REQUEST_BODY_BYTES"):
        load_config()


def test_large_api_responses_are_gzipped_and_exclude_none() -> None:
    route = next(
        route
        for route in app.routes
        if getattr(route, "path", None) == "/api/compare-scenarios-enhanced"
    )
    assert route.response_model_exclude_none is True  # type: ignore[attr-defined]

    payload = {
        "property_value": 300_000.0,
        "down_payment": 60_000.0,
        "loan_term_years": 2,
        "annual_interest_rate": 9.6,
        "loan_type": "PRICE",
        "rent_value": 1_000.0,
        "investment_returns": [{"start_month": 1, "annual_rate": 6.0}],
        "additional_costs": {
            "itbi_percentage": 0.0,
            "deed_percentage": 0.0,
            "monthly_hoa": 0.0,
            "monthly_property_tax": 0.0,
        },
        "inflation_rate": 0.0,
        "rent_inflation_rate": 0.0,
        "property_appreciation_rate": 0.0,
    }
    response = TestClient(app).post(
        "/api/compare-scenarios-enhanced",
        json=payload,
        headers={"Accept-Encoding": "gzip"},
    )

    assert response.status_code == 200, response.text
    assert response.headers.get("content-encoding") == "gzip"


def test_production_runtime_and_browser_headers_are_hardened() -> None:
    backend_dockerfile = (REPOSITORY_ROOT / "backend" / "Dockerfile").read_text()
    frontend_dockerfile = (REPOSITORY_ROOT / "frontend" / "Dockerfile").read_text()
    production_compose = (REPOSITORY_ROOT / "docker-compose.prod.yml").read_text()
    nginx_config = (REPOSITORY_ROOT / "frontend" / "nginx.conf").read_text()
    security_headers = (
        REPOSITORY_ROOT / "frontend" / "security-headers.conf"
    ).read_text()
    frontend_index = (REPOSITORY_ROOT / "frontend" / "index.html").read_text()

    assert "USER farol" in backend_dockerfile
    assert "read_only: true" in production_compose
    assert "no-new-privileges:true" in production_compose
    assert "cap_drop:" in production_compose
    assert production_compose.count("- ALL") >= 2
    assert production_compose.count("read_only: true") >= 2
    assert "USER nginx" in frontend_dockerfile
    assert "EXPOSE 8080" in frontend_dockerfile
    assert "listen 8080;" in nginx_config
    assert "client_max_body_size 4m;" in nginx_config

    # Locations with their own add_header directives do not inherit the server
    # headers in nginx 1.28, so every such location includes the shared policy.
    assert nginx_config.count("include /etc/nginx/security-headers.conf;") >= 5
    assert "default-src 'self'" in security_headers
    assert "script-src 'self'" in security_headers
    assert "frame-ancestors 'none'" in security_headers
    assert 'add_header X-Frame-Options "DENY" always;' in security_headers
    assert "Permissions-Policy" in security_headers
    assert '<script src="/color-scheme.js"></script>' in frontend_index
    assert "<script>" not in frontend_index
