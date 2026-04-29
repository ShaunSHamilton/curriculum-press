#!/usr/bin/env bash
set -euo pipefail

trap 'kill 0' EXIT

cargo run &
bun run dev &

wait
