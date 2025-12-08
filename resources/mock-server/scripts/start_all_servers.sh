#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(dirname "$0")
MOCK_SERVER_DIR="$SCRIPT_DIR/.."

echo "=== AlgoKit Polytest Mock Servers ==="
echo ""

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

cd "$MOCK_SERVER_DIR"

# Function to start a server in background
start_server() {
    local client=$1
    local port=$2
    local env_var="${client^^}_PORT"
    
    echo "Starting $client mock server on port $port..."
    export "$env_var=$port"
    nohup bun bin/server.ts "$client" > "/tmp/mock-$client.log" 2>&1 &
    echo "  PID: $!"
}

# Start all servers
start_server algod 8000
start_server kmd 8001
start_server indexer 8002

echo ""
echo "Waiting for servers to be ready..."

# Wait for all servers to be healthy
all_healthy=true
for port in 8000 8001 8002; do
    for i in {1..30}; do
        # Accept ANY HTTP response (even 500) as server being ready
        # The mock server returns 500 for unrecorded endpoints like /health
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://localhost:$port/health" 2>/dev/null || echo "000")
        if [[ "$HTTP_CODE" != "000" ]]; then
            echo "  Port $port: ready (HTTP $HTTP_CODE)"
            break
        fi
        if [[ $i -eq 30 ]]; then
            echo "  Port $port: FAILED (timeout)"
            all_healthy=false
        fi
        sleep 1
    done
done

if [[ "$all_healthy" != true ]]; then
    echo ""
    echo "Some servers failed to start. Check logs in /tmp/mock-*.log"
    exit 1
fi

echo ""
echo "=== All mock servers are running ==="
echo ""
echo "Environment variables to set:"
echo "  export MOCK_ALGOD_URL=http://localhost:8000"
echo "  export MOCK_KMD_URL=http://localhost:8001"
echo "  export MOCK_INDEXER_URL=http://localhost:8002"
echo ""
echo "Server logs:"
echo "  /tmp/mock-algod.log"
echo "  /tmp/mock-kmd.log"
echo "  /tmp/mock-indexer.log"
echo ""
echo "To stop servers: pkill -f 'bun bin/server.ts'"
