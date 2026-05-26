#!/bin/sh
set -eu

port="${PORT:-3001}"
host="${BIND_HOST:-0.0.0.0}"
base_path="${SANDBOX_BASE_PATH:-${NEXT_PUBLIC_SANDBOX_BASE_PATH:-}}"
health_url="http://127.0.0.1:${port}${base_path:-/}"
restart_marker="${SANDBOX_RESTART_MARKER:-.manifest-restart}"
clear_cache_marker="${SANDBOX_CLEAR_CACHE_MARKER:-.manifest-clear-cache}"
bundler="${SANDBOX_NEXT_DEV_BUNDLER:-webpack}"
dist_dir="${SANDBOX_DIST_DIR:-.next-${port}}"
failure_count=0
server_pid=""

start_server() {
  export SANDBOX_DIST_DIR="$dist_dir"
  if [ -f "$clear_cache_marker" ]; then
    rm -rf "$dist_dir"
    rm -f "$clear_cache_marker"
  fi

  if [ "$bundler" = "webpack" ]; then
    ./node_modules/.bin/next dev --webpack --hostname "$host" --port "$port" &
  else
    ./node_modules/.bin/next dev --hostname "$host" --port "$port" &
  fi
  server_pid="$!"
  failure_count=0
}

stop_server() {
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}

probe_server() {
  node -e "
    const timeout = AbortSignal.timeout(3000);
    fetch(process.argv[1], { signal: timeout })
      .then((response) => process.exit(response.ok ? 0 : 2))
      .catch(() => process.exit(1));
  " "$health_url"
}

trap 'stop_server; exit 0' INT TERM

start_server
sleep "${SANDBOX_START_GRACE_SECONDS:-45}"

while true; do
  if [ -f "$restart_marker" ]; then
    echo "Sandbox restart requested." >&2
    rm -f "$restart_marker"
    stop_server
    start_server
    sleep "${SANDBOX_START_GRACE_SECONDS:-45}"
    continue
  fi

  if ! kill -0 "$server_pid" 2>/dev/null; then
    wait "$server_pid" 2>/dev/null || true
    start_server
    sleep "${SANDBOX_START_GRACE_SECONDS:-45}"
    continue
  fi

  if probe_server; then
    failure_count=0
  else
    failure_count=$((failure_count + 1))
  fi

  if [ "$failure_count" -ge 3 ]; then
    echo "Sandbox dev server failed health checks; restarting." >&2
    if [ "$failure_count" -ge 6 ]; then
      touch "$clear_cache_marker"
    fi
    stop_server
    start_server
    sleep "${SANDBOX_START_GRACE_SECONDS:-45}"
    continue
  fi

  sleep "${SANDBOX_HEALTH_INTERVAL_SECONDS:-15}"
done
