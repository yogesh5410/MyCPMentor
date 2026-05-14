#!/usr/bin/env bash
# =============================================================================
# MyCPMentor – start.sh
# Start all project services in the correct order.
#
# Services:
#   1. Judge Service stack  (Redis + API + Celery Worker + Flower) via Docker Compose
#   2. Backend              (Node.js / Express)
#   3. Frontend             (Vite dev server)
#
# Usage:
#   ./start.sh                  – start everything
#   ./start.sh --judge-only     – start only the judge stack
#   ./start.sh --no-judge       – start backend + frontend only
#   ./start.sh --no-frontend    – start backend + judge only
#   ./start.sh stop             – stop all services
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JUDGE_DIR="$ROOT/judge-service"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
LOG_DIR="$ROOT/.logs"

mkdir -p "$LOG_DIR"

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}━━  $*  ━━${RESET}"; }

# ── Stop helper ────────────────────────────────────────────────────────────────
_stop() {
  section "Stopping all MyCPMentor services"

  # Judge stack
  if [[ -f "$JUDGE_DIR/docker-compose.yml" ]]; then
    info "Stopping judge stack…"
    (cd "$JUDGE_DIR" && docker compose down 2>/dev/null) || true
    success "Judge stack stopped"
  fi

  # Backend
  if [[ -f "$LOG_DIR/backend.pid" ]]; then
    _pid=$(cat "$LOG_DIR/backend.pid")
    kill "$_pid" 2>/dev/null && success "Backend stopped (PID $_pid)" || warn "Backend was not running"
    rm -f "$LOG_DIR/backend.pid"
  fi

  # Frontend
  if [[ -f "$LOG_DIR/frontend.pid" ]]; then
    _pid=$(cat "$LOG_DIR/frontend.pid")
    kill "$_pid" 2>/dev/null && success "Frontend stopped (PID $_pid)" || warn "Frontend was not running"
    rm -f "$LOG_DIR/frontend.pid"
  fi
}

# ── Argument parsing ───────────────────────────────────────────────────────────
JUDGE_ONLY=false; NO_JUDGE=false; NO_FRONTEND=false

for arg in "$@"; do
  case $arg in
    stop)           _stop; exit 0 ;;
    --judge-only)   JUDGE_ONLY=true ;;
    --no-judge)     NO_JUDGE=true ;;
    --no-frontend)  NO_FRONTEND=true ;;
  esac
done

# ── Prerequisite check ─────────────────────────────────────────────────────────
section "Starting MyCPMentor"

if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start Docker and re-run this script."
fi

if [[ ! -f "$JUDGE_DIR/.env" ]]; then
  warn "judge-service/.env missing – copying from .env.example"
  cp "$JUDGE_DIR/.env.example" "$JUDGE_DIR/.env"
fi

# ── Ensure sandbox image exists ────────────────────────────────────────────────
if ! docker image inspect judge-sandbox:latest &>/dev/null; then
  info "judge-sandbox:latest not found – building now…"
  docker build -t judge-sandbox:latest "$JUDGE_DIR/sandbox"
  success "judge-sandbox:latest built"
fi

# ── 1. Judge Service stack (Docker Compose) ────────────────────────────────────
if [[ "$NO_JUDGE" == false ]]; then
  section "Starting Judge Service (Redis + API + Worker + Flower)"
  cd "$JUDGE_DIR"

  docker compose up -d --build 2>&1 | tail -10
  success "Judge stack is up"
  info "  API    → http://localhost:8001/api/judge/health"
  info "  Flower → http://localhost:5555"
fi

if [[ "$JUDGE_ONLY" == true ]]; then
  success "Judge-only mode – done."
  exit 0
fi

# ── 2. Backend (Node.js) ───────────────────────────────────────────────────────
section "Starting Backend"
if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  warn "node_modules missing in backend – run ./setup.sh first"
fi

cd "$BACKEND_DIR"
npm run dev > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$LOG_DIR/backend.pid"
success "Backend started (PID $BACKEND_PID) → http://localhost:5000"
info "  Logs: tail -f $LOG_DIR/backend.log"

# ── 3. Frontend (Vite) ────────────────────────────────────────────────────────
if [[ "$NO_FRONTEND" == false ]]; then
  section "Starting Frontend"
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    warn "node_modules missing in frontend – run ./setup.sh first"
  fi

  cd "$FRONTEND_DIR"
  npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
  success "Frontend started (PID $FRONTEND_PID) → http://localhost:5173"
  info "  Logs: tail -f $LOG_DIR/frontend.log"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
section "All services running"
echo ""
echo -e "  ${BOLD}Frontend${RESET}  →  http://localhost:5173"
echo -e "  ${BOLD}Backend${RESET}   →  http://localhost:5000"
echo -e "  ${BOLD}Judge API${RESET} →  http://localhost:8001"
echo -e "  ${BOLD}Flower${RESET}    →  http://localhost:5555"
echo ""
echo -e "  Stop everything:  ${BOLD}./start.sh stop${RESET}"
echo -e "  Backend logs:     ${BOLD}tail -f .logs/backend.log${RESET}"
echo -e "  Frontend logs:    ${BOLD}tail -f .logs/frontend.log${RESET}"
echo -e "  Judge logs:       ${BOLD}docker compose -f judge-service/docker-compose.yml logs -f${RESET}"
echo ""
