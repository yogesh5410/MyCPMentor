# Judge Service – Dockerfile
# Builds the image used by both the API container and the Celery worker container.
# The sandbox image is built separately (see sandbox/Dockerfile).

# ── Stage 1: grab the Docker CLI binary from the official image ───────────────
FROM docker:27-cli AS docker-cli

# ── Stage 2: the actual service image ────────────────────────────────────────
FROM python:3.12-slim

# ── System deps ────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy docker CLI from the official docker image (no apt-repo needed)
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

# ── Python deps ────────────────────────────────────────────────────────────────
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ───────────────────────────────────────────────────────────
COPY . .

# ── Expose API port ────────────────────────────────────────────────────────────
EXPOSE 8001

# Default: run the FastAPI server.
# Override the CMD in docker-compose for the worker service.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
