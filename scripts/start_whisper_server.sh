#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
VENV_DIR="$PROJECT_DIR/venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "Virtual environment not found. Running setup first..."
    bash "$SCRIPT_DIR/setup_whisper_env.sh"
fi

source "$VENV_DIR/bin/activate"

export PORT=${PORT:-8000}
export HOST=${HOST:-"0.0.0.0"}
export WHISPER_MODEL=${WHISPER_MODEL:-"base"}

echo "Starting Local Whisper server on http://$HOST:$PORT (Model: $WHISPER_MODEL)..."
python "$SCRIPT_DIR/whisper_server.py"
