#!/bin/bash
cd "$(dirname "$0")"

# Kill existing processes
pkill -f "python main.py" 2>/dev/null || true
pkill -f "uvicorn main:app" 2>/dev/null || true

# Activate virtual environment
source venv/bin/activate

# Start the server with SQLAlchemy
echo "Starting Mythical Helper API with SQLAlchemy database..."
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
