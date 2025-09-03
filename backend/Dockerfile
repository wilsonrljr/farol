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
    pip install --no-cache-dir fastapi uvicorn pydantic numpy pandas matplotlib python-multipart requests httpx

# Copy application code
COPY backend/app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
