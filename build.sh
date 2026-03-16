#!/usr/bin/env bash
# Builds all topics. Run from project root.
set -euo pipefail
cd "$(dirname "$0")"

built=0
for topic_dir in topics/*/; do
  if [ -f "$topic_dir/build.sh" ]; then
    echo "Building: $(basename "$topic_dir")"
    bash "$topic_dir/build.sh"
    built=$((built + 1))
  fi
done

echo "Built $built topic(s)."
