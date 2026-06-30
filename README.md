# AlgoKit Polytest

Test configuration files and mock server infrastructure for cross-language testing of AlgoKit libraries.

## Overview

This repository provides:

- **Test Configurations** (`test_configs/`) - Shared test plans for polytest CLI, ensuring consistent test coverage across Python, TypeScript, Rust, and other language implementations
- **Custom Targets** (`templates/rust/`) - A polytest custom target that generates Rust/nextest test stubs, consumed by implementation repos via the polytest `--git` flag
- **Mock Server** (`resources/mock-server/`) - Bun-based HTTP server that replays pre-recorded HAR files for deterministic API testing
- **GitHub Actions** (`.github/actions/`) - Reusable composite actions for CI integration

## Directory Structure

```
├── .github/
│   └── actions/
│       ├── setup-polytest/     # Install polytest CLI
│       └── run-mock-server/    # Start mock server for testing
├── resources/
│   └── mock-server/            # Bun/Fastify mock server
│       ├── recordings/         # HAR files for algod, indexer, kmd
│       └── src/                # Server implementation
├── templates/                  # Custom polytest target templates
│   └── rust/                    # Rust/nextest target (suite/group/test .rs.jinja)
├── test_configs/               # Polytest configuration files
│   ├── algod_client.jsonc
│   ├── indexer_client.jsonc
│   ├── kmd_client.jsonc
│   └── transact.jsonc
└── docs/                       # Generated test plan documentation
```

## GitHub Actions

### `setup-polytest`

Installs Rust toolchain and the polytest CLI.

```yaml
- uses: algorandfoundation/algokit-polytest/.github/actions/setup-polytest@main
  with:
    version: "0.6.0"  # Optional: pin to specific version
```

### `run-mock-server`

Starts a mock server for testing Algorand API clients.

```yaml
- uses: algorandfoundation/algokit-polytest/.github/actions/run-mock-server@main
  with:
    client: algod  # Required: algod, indexer, or kmd

# After this step, MOCK_ALGOD_URL, MOCK_INDEXER_URL, MOCK_KMD_URL is available (e.g., http://localhost:8000)
```

See [run-mock-server README](.github/actions/run-mock-server/README.md) for full documentation.

## Local Development

### Prerequisites

- [Bun](https://bun.sh/) runtime: `curl -fsSL https://bun.sh/install | bash`

### Running the Mock Server

**Start all servers (recommended):**

```bash
cd resources/mock-server
./scripts/start_all_servers.sh
```

This starts algod (port 8000), kmd (port 8001), and indexer (port 8002) in the background and outputs the environment variables to set.

**Start a single server:**

```bash
cd resources/mock-server
./scripts/start_server.sh algod     # Port 8000
./scripts/start_server.sh kmd       # Port 8001
./scripts/start_server.sh indexer   # Port 8002
```

**Stop all servers:**

```bash
cd resources/mock-server
./scripts/stop_all_servers.sh
```

See [mock-server README](resources/mock-server/README.md) for more details.

### Recording New HAR Files

Edit `resources/mock-server/src/record.ts` to add new requests, then restart the server. It will record any missing requests to the HAR files.

## Integration with Implementation Repos

Implementation repositories (e.g., `algokit-utils-py`, `algokit-utils-ts`) use this repo via:

1. **Test Generation**: polytest CLI with `--git` flag pulls configs from this repo
2. **Mock Server**: GitHub Action starts the mock server in CI