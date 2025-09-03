## syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile installing deps from pyproject (PEP 621) – avoids drift.
# Stages:
# 1. builder (instala deps + extras de dev)
# 2. test (roda pytest)
# 3. runtime (imagem final enxuta só com deps necessários em produção)

ARG PYTHON_VERSION=3.13-slim

FROM python:${PYTHON_VERSION} AS uv-base
ENV PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1 \
        UV_SYSTEM_PYTHON=1 \
        UV_LINK_MODE=copy \
        UV_NO_PROGRESS=1
WORKDIR /app

# Instala uv (gerenciador rápido com lock)
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir uv

# Copiamos manifestos primeiro para cache de resolução
COPY pyproject.toml ./
COPY uv.lock ./

# Cria ambiente (usa system python por simplicidade) e sincroniza deps + extras dev
RUN uv sync --no-install-project --extra dev

# Copia código e instala o pacote editável (sem reinstalar deps já resolvidas)
COPY backend ./backend
RUN uv pip install -e .

FROM uv-base AS test
ENV PYTHONPATH=/app
RUN uv run pytest -q || (echo "Tests failed during image build" && exit 1)

# Runtime enxuto: somente deps de produção
FROM python:${PYTHON_VERSION} AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1 \
        UV_SYSTEM_PYTHON=1 \
        UV_NO_PROGRESS=1
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml ./
COPY uv.lock ./
RUN uv sync --no-install-project
COPY backend ./backend
RUN uv pip install .

ENV PYTHONPATH=/app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import socket,sys,os;import time;import errno;import contextlib;import socket as sck;port=int(os.environ.get('PORT',8000));s=sck.socket();code=0\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\ntry: s.connect(('127.0.0.1',port)); s.close()\nexcept Exception: code=1\nsys.exit(code)" || exit 1

CMD ["uv", "run", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
