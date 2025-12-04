#!/bin/bash

DOCKER_DIR=$(dirname "$0")

# Stop and remove any existing container with the same name
docker rm --force mock-$1-instance 2>/dev/null || true

# Select port based on the arg
if [ "$1" == "algod" ]; then
    PORT=8000
elif [ "$1" == "kmd" ]; then
    PORT=8001
elif [ "$1" == "indexer" ]; then
    PORT=8002
else
    echo "Usage: $0 {algod|kmd|indexer}"
    exit 1
fi

docker buildx build -t mock-server $DOCKER_DIR/..
docker run -d --rm -p $PORT:$PORT --name mock-$1-instance mock-server $1
