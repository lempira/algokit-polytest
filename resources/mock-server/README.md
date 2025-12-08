# Mock Server

A PollyJS and Fastify-based mock server that replays pre-recorded HAR files for deterministic API testing of Algorand clients (algod, indexer, kmd).

## Prerequisites

- [Bun](https://bun.sh/) runtime installed (`curl -fsSL https://bun.sh/install | bash`)

## Quick Start

### Start All Servers (Recommended for Testing)

```bash
./scripts/start_all_servers.sh
```

This starts all three mock servers in the background:
- **algod** on port 8000
- **kmd** on port 8001  
- **indexer** on port 8002

Then set the environment variables shown in the output:

```bash
export MOCK_ALGOD_URL=http://localhost:8000
export MOCK_KMD_URL=http://localhost:8001
export MOCK_INDEXER_URL=http://localhost:8002
```

### Start Individual Server

```bash
./scripts/start_server.sh algod     # Port 8000
./scripts/start_server.sh kmd       # Port 8001
./scripts/start_server.sh indexer   # Port 8002
```

### Stop All Servers

```bash
./scripts/stop_all_servers.sh
```

## Direct Bun Usage

You can also run the server directly with bun:

```bash
# Install dependencies (first time only)
bun install

# Start server (runs in foreground)
ALGOD_PORT=8000 bun bin/server.ts algod
```

## Behavior

The mock server replays pre-recorded HAR files from the `recordings/` directory. If a request is made to an endpoint that is not recorded, the server responds with a 500 error.

## Adding New Recordings

1. Edit `src/record.ts` to add the requests you want to record
2. Set the server to record mode by modifying the mode in `src/index.ts`
3. Run the server - it will record new requests to the HAR files
4. Commit the updated HAR files

See `src/requests/` for examples of existing request definitions.

## Server Logs

When using `start_all_servers.sh`, logs are written to:
- `/tmp/mock-algod.log`
- `/tmp/mock-kmd.log`
- `/tmp/mock-indexer.log`

## Debugging

To debug in VS Code/Cursor:
1. Install the [Bun extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode) (`oven.bun-vscode`)
2. Press F5 to start the debugger

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALGOD_PORT` | Port for algod server | 8000 |
| `KMD_PORT` | Port for kmd server | 8001 |
| `INDEXER_PORT` | Port for indexer server | 8002 |
| `LOG_LEVEL` | Server log level | info |
| `NODE_ENV` | Set to `production` to disable pretty logging | - |
