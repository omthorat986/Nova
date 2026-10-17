# ==============================================================================
# NOVA Deep Space Observatory — Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build Dependencies
FROM python:3.12-slim AS builder

WORKDIR /build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Minimal Runtime Environment
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    PORT=8080

# Install runtime curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python dependencies from builder stage
COPY --from=builder /install /usr/local

# Create non-root system user and group
RUN groupadd -g 10001 nova && \
    useradd -u 10001 -g nova -s /bin/false -M -d /app nova

# Copy application codebase
COPY server.py manage.py gunicorn.conf.py requirements.txt ./
COPY *.html ./
COPY robots.txt sitemap.xml manifest.json ./
COPY css/ ./css/
COPY js/ ./js/
COPY data/ ./data/
COPY migrations/ ./migrations/

# Create runtime logs directory with non-root ownership
RUN mkdir -p /app/logs && chown -R nova:nova /app

# Switch to non-root execution user
USER nova

# Standard container healthcheck targeting /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["gunicorn", "--config", "gunicorn.conf.py", "server:app"]
