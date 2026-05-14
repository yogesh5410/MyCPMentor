FROM debian:bookworm-slim

# ── Language runtimes ──────────────────────────────────────────────────────────
# python3, g++ (C++17), nodejs are all we need for the three supported languages.
# coreutils provides the 'timeout' command.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        g++ \
        nodejs \
        coreutils \
    && rm -rf /var/lib/apt/lists/* \
    # Smoke-test each runtime
    && python3 --version \
    && g++ --version | head -1 \
    && node --version

# ── Sandbox user (non-root) ────────────────────────────────────────────────────
RUN useradd --no-create-home --shell /usr/sbin/nologin sandbox

# ── Entrypoint ────────────────────────────────────────────────────────────────
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Workspace is a tmpfs mount supplied by the host (rw,exec,size=128m).
# Declare it as a volume so Docker knows it will be writable at runtime.
WORKDIR /workspace
VOLUME ["/workspace"]

USER sandbox
ENTRYPOINT ["/entrypoint.sh"]
