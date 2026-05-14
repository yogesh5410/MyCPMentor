#!/usr/bin/env bash
# =============================================================================
# MyCPMentor – setup.sh
# One-time project setup: install dependencies, build Docker images, create
# environment files for every service.
#
# Usage: ./setup.sh [--skip-docker] [--skip-npm] [--skip-python]
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}━━  $*  ━━${RESET}"; }

# ── Argument parsing ───────────────────────────────────────────────────────────
SKIP_DOCKER=false; SKIP_NPM=false; SKIP_PYTHON=false
for arg in "$@"; do
  case $arg in
    --skip-docker) SKIP_DOCKER=true ;;
    --skip-npm)    SKIP_NPM=true    ;;
    --skip-python) SKIP_PYTHON=true ;;
  esac
done

# ── Dependency checks ──────────────────────────────────────────────────────────
section "Checking required tools"

require() {
  if ! command -v "$1" &>/dev/null; then
    error "$1 is not installed. $2"
  fi
  success "$1 found: $(command -v "$1")"
}

require node   "Install Node.js from https://nodejs.org"
require npm    "Install Node.js from https://nodejs.org"
require python3 "Install Python 3.10+ from https://python.org"

if [[ "$SKIP_DOCKER" == false ]]; then
  require docker "Install Docker from https://docs.docker.com/get-docker/"
  if ! docker compose version &>/dev/null; then
    error "Docker Compose plugin is required. Run: docker plugin install compose"
  fi
  success "docker compose found"
  if ! docker info &>/dev/null; then
    warn "Docker daemon is not running. Start it before running start.sh."
  fi
fi

# ── Backend (Node.js) ──────────────────────────────────────────────────────────
if [[ "$SKIP_NPM" == false ]]; then
  section "Installing backend dependencies"
  cd "$ROOT/backend"
  npm install --prefer-offline 2>&1 | tail -5
  success "backend/node_modules installed"
fi

# ── Frontend (Vite / React) ────────────────────────────────────────────────────
if [[ "$SKIP_NPM" == false ]]; then
  section "Installing frontend dependencies"
  cd "$ROOT/frontend"
  npm install --prefer-offline 2>&1 | tail -5
  success "frontend/node_modules installed"
fi

# ── Judge Service (Python) ─────────────────────────────────────────────────────
if [[ "$SKIP_PYTHON" == false ]]; then
  section "Setting up judge-service Python environment"
  cd "$ROOT/judge-service"

  if [[ ! -d ".venv" ]]; then
    python3 -m venv .venv
    success "Created judge-service/.venv"
  else
    info "judge-service/.venv already exists"
  fi

  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r requirements.txt
  success "judge-service Python dependencies installed"
fi

# ── Environment files ──────────────────────────────────────────────────────────
section "Creating .env files (if missing)"

copy_env() {
  local dir="$1"
  if [[ ! -f "$ROOT/$dir/.env" ]]; then
    if [[ -f "$ROOT/$dir/.env.example" ]]; then
      cp "$ROOT/$dir/.env.example" "$ROOT/$dir/.env"
      success "Created $dir/.env from .env.example"
    else
      warn "No .env.example found in $dir – skipping"
    fi
  else
    info "$dir/.env already exists – skipping"
  fi
}

copy_env backend
copy_env judge-service

# ── Build Docker images ────────────────────────────────────────────────────────
if [[ "$SKIP_DOCKER" == false ]]; then
  section "Building Docker images"

  info "Building judge sandbox image (judge-sandbox:latest)…"
  docker build -t judge-sandbox:latest "$ROOT/judge-service/sandbox"
  success "judge-sandbox:latest built"

  info "Building judge service image (judge-service:latest)…"
  docker build -t judge-service:latest "$ROOT/judge-service"
  success "judge-service:latest built"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
section "Setup complete"
echo -e "${GREEN}All dependencies installed and images built.${RESET}"
echo ""
echo "  Next step:  ${BOLD}./start.sh${RESET}"
echo ""
echo "  Services that will start:"
echo "    Backend  →  http://localhost:5000"
echo "    Frontend →  http://localhost:5173"
echo "    Judge    →  http://localhost:8001"
echo "    Flower   →  http://localhost:5555  (Celery monitor)"
echo ""
