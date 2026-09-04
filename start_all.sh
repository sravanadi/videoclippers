#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================="
echo " Starting VideoClipper Infrastructure Locally"
echo "=================================================="

# Stop any previously running whisper server instance
pkill -f whisper_server.py 2>/dev/null || true

# 1. Start Local Whisper Server
echo "[1/2] Starting Local Whisper Server (port 8000)..."
bash scripts/start_whisper_server.sh &
WHISPER_PID=$!

trap "echo 'Shutting down services...'; kill $WHISPER_PID 2>/dev/null || true" EXIT INT TERM

# 2. Start Next.js App
echo "[2/2] Starting Next.js Web App (port 3000)..."
npm run dev
