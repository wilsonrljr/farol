# syntax=docker/dockerfile:1.7
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app

# System deps (kept minimal; uncomment if compiled deps appear later)
# RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

# Copy project metadata and install dependencies
# Using pip to install based on pyproject.toml (PEP 621). For lock reproducibility you can add `uv` or `pip-tools` later.
COPY pyproject.toml ./

RUN pip install --upgrade pip && \
    pip install --no-cache-dir fastapi uvicorn pydantic numpy pandas matplotlib python-multipart requests httpx pytest

ENV PYTHONPATH=/app

# Copy full backend directory to preserve package structure for tests (imports like backend.app.finance)
COPY backend ./backend

# Copy tests (both root tests and backend/app/tests if exist)
# Copy test directories if they exist
COPY backend/app/tests ./backend/app/tests
COPY backend/tests ./backend/tests
COPY test_*.py ./tests_root/

# Run tests (pytest auto-discovers). If some copied dirs don't exist, that's fine.
RUN pytest -q || (echo "Tests failed during image build" && exit 1)

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
