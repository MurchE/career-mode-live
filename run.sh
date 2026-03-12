#!/usr/bin/env bash
# Career Mode Live — local dev launcher
# Starts backend (FastAPI) and frontend (Next.js) in parallel

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==================================="
echo " Career Mode Live — Local Dev"
echo "==================================="
echo ""

# Check for API key
if [ -z "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
    if [ -f "$ROOT_DIR/backend/.env" ]; then
        echo "[*] Loading API key from backend/.env"
        export $(grep -v '^#' "$ROOT_DIR/backend/.env" | xargs)
    else
        echo "[!] WARNING: No GEMINI_API_KEY set. Copy backend/.env.example to backend/.env and add your key."
    fi
fi

# Backend
echo "[1/2] Starting backend (FastAPI on :8000)..."
cd "$ROOT_DIR/backend"
if [ ! -d ".venv" ]; then
    echo "  -> Installing backend dependencies..."
    uv sync
fi
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Frontend
echo "[2/2] Starting frontend (Next.js on :3000)..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "  -> Installing frontend dependencies..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!

echo ""
echo "==================================="
echo " Backend:  http://localhost:8000"
echo " Frontend: http://localhost:3000"
echo " Health:   http://localhost:8000/health"
echo "==================================="
echo ""
echo "Press Ctrl+C to stop both services."

# Trap Ctrl+C to kill both
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for either to exit
wait
