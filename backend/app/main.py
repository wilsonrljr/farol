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

import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.errors import configure_logging, install_exception_handlers
from .api.routers.exports import router as exports_router
from .api.routers.simulations import router as simulations_router

APP_NAME = os.getenv("APP_NAME", "Farol")
API_TITLE = os.getenv("API_TITLE", f"{APP_NAME} API")
API_DESCRIPTION = os.getenv(
    "API_DESCRIPTION",
    "Plataforma Farol: simulação e planejamento financeiro (imóveis hoje; outros objetivos no futuro).",
)

app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version="0.1.0",
)

configure_logging()
install_exception_handlers(app)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulations_router)
app.include_router(exports_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": f"{API_TITLE}", "name": APP_NAME}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
