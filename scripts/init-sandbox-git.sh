#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox_dir="$repo_root/sandbox"

if [ ! -d "$sandbox_dir/.git" ]; then
  git -C "$sandbox_dir" init -b main
fi

if ! git -C "$sandbox_dir" rev-parse --verify HEAD >/dev/null 2>&1; then
  git -C "$sandbox_dir" add -A
  git -C "$sandbox_dir" \
    -c user.name="Manifest" \
    -c user.email="manifest@example.invalid" \
    commit -m "baseline"
  git -C "$sandbox_dir" tag -f baseline HEAD
elif [ "${REFRESH_SANDBOX_BASELINE:-false}" = "true" ]; then
  git -C "$sandbox_dir" add -A
  if ! git -C "$sandbox_dir" diff --cached --quiet; then
    git -C "$sandbox_dir" \
      -c user.name="Manifest" \
      -c user.email="manifest@example.invalid" \
      commit -m "chore(repo): refresh sandbox baseline"
  fi
  git -C "$sandbox_dir" tag -f baseline HEAD
elif ! git -C "$sandbox_dir" rev-parse --verify baseline >/dev/null 2>&1; then
  git -C "$sandbox_dir" tag baseline HEAD
fi

echo "Sandbox baseline ready at $(git -C "$sandbox_dir" rev-parse --short HEAD)"
