#!/bin/bash
set -e
cd "$(dirname "$0")/.."

node test/server.mjs > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 1

export SCRAPER_START_URL="http://127.0.0.1:4173/index.html"
node src/index.js || true

kill $SERVER_PID 2>/dev/null || true
