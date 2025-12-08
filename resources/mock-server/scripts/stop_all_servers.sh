#!/bin/bash

echo "Stopping all mock servers..."
pkill -f 'bun bin/server.ts' 2>/dev/null || true
echo "Done."
