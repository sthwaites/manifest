#!/bin/sh
set -eu

port="${PORT:-3001}"
host="${BIND_HOST:-0.0.0.0}"
health_url="http://127.0.0.1:${port}"
failure_count=0
server_pid=""

start_server() {
  rm -rf .next
  npm run dev -- --hostname "$host" --port "$port" &
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
sleep 20

while true; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    wait "$server_pid" 2>/dev/null || true
    start_server
    sleep 20
    continue
  fi

  if probe_server; then
    failure_count=0
  else
    failure_count=$((failure_count + 1))
  fi

  if [ "$failure_count" -ge 3 ]; then
    echo "Sandbox dev server failed health checks; clearing cache and restarting." >&2
    stop_server
    start_server
    sleep 20
    continue
  fi

  sleep 10
done
