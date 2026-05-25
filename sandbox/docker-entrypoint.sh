#!/bin/sh
set -eu

template_dir="/sandbox-template"
workspace_dir="/sandbox"
lock_marker="$workspace_dir/node_modules/.manifest-package-lock.sha256"

copy_template() {
  find "$template_dir" -mindepth 1 -maxdepth 1 ! -name node_modules -exec cp -a {} "$workspace_dir/" \;
}

workspace_is_clean() {
  if [ ! -d "$workspace_dir/.git" ]; then
    return 0
  fi

  [ -z "$(git -C "$workspace_dir" status --porcelain 2>/dev/null)" ]
}

package_lock_hash() {
  sha256sum "$template_dir/package-lock.json" | awk '{print $1}'
}

sync_node_modules() {
  expected_hash="$(package_lock_hash)"
  current_hash=""

  if [ -f "$lock_marker" ]; then
    current_hash="$(cat "$lock_marker")"
  fi

  if [ "$current_hash" != "$expected_hash" ]; then
    mkdir -p "$workspace_dir/node_modules"
    find "$workspace_dir/node_modules" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "$template_dir/node_modules/." "$workspace_dir/node_modules/"
    printf '%s' "$expected_hash" > "$lock_marker"
  fi
}

mkdir -p "$workspace_dir"

if [ ! -f "$workspace_dir/package.json" ] || [ ! -d "$workspace_dir/src" ]; then
  copy_template
elif workspace_is_clean; then
  copy_template
else
  for file in package.json package-lock.json next.config.js postcss.config.mjs tsconfig.json vitest.config.ts vitest.setup.ts; do
    if [ -f "$template_dir/$file" ]; then
      cp -a "$template_dir/$file" "$workspace_dir/$file"
    fi
  done
fi

sync_node_modules

rm -rf "$workspace_dir/.next"

exec "$@"
