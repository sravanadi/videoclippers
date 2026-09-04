#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
VENV_DIR="$PROJECT_DIR/venv"

echo "=== Setting up Python environment for Local Whisper ==="

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment at $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

echo "Upgrading pip..."
pip install --upgrade pip setuptools wheel

echo "Installing required Python packages..."
pip install fastapi uvicorn python-multipart faster-whisper torch --extra-index-url https://download.pytorch.org/whl/cpu

echo "=== Local Whisper Python Environment Ready! ==="
