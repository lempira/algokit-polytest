# Run Mock Server Action

A GitHub Actions composite action to start mock servers for testing Algorand API clients (algod, indexer, kmd).

## Inputs

| Input    | Required | Default | Description                                           |
| -------- | -------- | ------- | ----------------------------------------------------- |
| `client` | Yes      | -       | The client type to mock: `algod`, `indexer`, or `kmd` |
| `port`   | No       | *       | Port to run the server on                             |

\* Default ports: `algod`: 8000, `kmd`: 8001, `indexer`: 8002

## Outputs

Environment variables exported for use in subsequent steps:

| Client    | Environment Variable | Default Value           |
| --------- | -------------------- | ----------------------- |
| `algod`   | `MOCK_ALGOD_URL`     | `http://localhost:8000` |
| `kmd`     | `MOCK_KMD_URL`       | `http://localhost:8001` |
| `indexer` | `MOCK_INDEXER_URL`   | `http://localhost:8002` |

## Usage

```yaml
- name: Start algod mock server
  uses: algorandfoundation/algokit-polytest/.github/actions/run-mock-server@main
  with:
    client: algod

- name: Start kmd mock server
  uses: algorandfoundation/algokit-polytest/.github/actions/run-mock-server@main
  with:
    client: kmd

- name: Start indexer mock server
  uses: algorandfoundation/algokit-polytest/.github/actions/run-mock-server@main
  with:
    client: indexer

- name: Run tests
  run: npm test  # Uses $MOCK_ALGOD_URL, $MOCK_KMD_URL, $MOCK_INDEXER_URL
```

## Troubleshooting

- **Server logs**: `/tmp/mock-server-{client}.log`
- **Custom port**: Add `port: 9000` to the `with` block
- **Health check timeout**: Action waits up to 30 seconds for server readiness
