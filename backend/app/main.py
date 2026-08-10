"""FastAPI application entrypoint for Farol.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .api.errors import configure_logging, install_exception_handlers
from .api.middleware import (
    RequestBodyLimitMiddleware,
    install_no_cache_middleware,
    install_request_context_middleware,
)
from .api.routers.exports import router as exports_router
from .api.routers.simulations import router as simulations_router
from .api.routers.tools import router as tools_router
from .config import load_config

config = load_config()

app = FastAPI(
    title=config.api_title,
    description=config.api_description,
    version=config.version,
)

configure_logging()
install_exception_handlers(app, config)

# Register inner middleware first. This ordering is intentional:
# - GZip sees concrete response sizes before function middleware turns them
#   into streams, so minimum_size is actually honored.
# - the body limit protects direct API deployments as well as nginx.
# - request context/no-cache wrap CORS, including preflight responses.
app.add_middleware(GZipMiddleware, minimum_size=1_000, compresslevel=5)
app.add_middleware(
    RequestBodyLimitMiddleware,
    max_body_bytes=config.max_request_body_bytes,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_allow_origins,
    allow_credentials=config.cors_allow_credentials,
    allow_methods=config.cors_allow_methods,
    allow_headers=config.cors_allow_headers,
    expose_headers=config.cors_expose_headers,
)
install_request_context_middleware(app, config)
install_no_cache_middleware(app)

app.include_router(simulations_router)
app.include_router(exports_router)
app.include_router(tools_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": f"{config.api_title}", "name": config.app_name}


@app.get("/healthz", include_in_schema=False)
async def healthcheck() -> dict[str, str]:
    """Liveness probe: the process and ASGI stack are responding."""
    return {"status": "ok"}


@app.get("/readyz", include_in_schema=False)
async def readiness() -> dict[str, str]:
    """Readiness probe: all stateless application routes were loaded."""
    return {"status": "ready"}


if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host=config.api_host,
        port=config.api_port,
    )
