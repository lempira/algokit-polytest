#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(dirname "$0")
MOCK_SERVER_DIR="$SCRIPT_DIR/.."

# Validate argument
if [[ $# -lt 1 ]] || [[ ! "$1" =~ ^(algod|kmd|indexer)$ ]]; then
    echo "Usage: $0 {algod|kmd|indexer}"
    echo ""
    echo "Starts a mock server for the specified client type using bun."
    echo ""
    echo "Examples:"
    echo "  $0 algod     # Start algod mock on port 8000"
    echo "  $0 kmd       # Start kmd mock on port 8001"
    echo "  $0 indexer   # Start indexer mock on port 8002"
    exit 1
fi

CLIENT="$1"

# Select port based on client type
case "$CLIENT" in
    algod)   PORT=8000 ;;
    kmd)     PORT=8001 ;;
    indexer) PORT=8002 ;;
esac

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: bun is not installed. Install it with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Install dependencies if needed
if [[ ! -d "$MOCK_SERVER_DIR/node_modules" ]]; then
    echo "Installing dependencies..."
    cd "$MOCK_SERVER_DIR"
    bun install --frozen-lockfile
fi

# Set port and start server
cd "$MOCK_SERVER_DIR"
echo "Starting $CLIENT mock server on port $PORT..."
export "${CLIENT^^}_PORT=$PORT"
exec bun bin/server.ts "$CLIENT"
