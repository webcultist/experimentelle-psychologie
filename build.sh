#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

shared_dir="topics/shared/src"
built=0

for topic_dir in topics/*/; do
  # Skip the shared directory itself
  [ "$(basename "$topic_dir")" = "shared" ] && continue

  if [ -f "$topic_dir/build.sh" ]; then
    # Copy shared files if topic doesn't have overrides
    if [ -d "$shared_dir" ]; then
      # CSS: use shared if no local override
      if [ -f "$shared_dir/css/style.css" ] && [ ! -f "$topic_dir/src/css/style.css.local" ]; then
        cp "$shared_dir/css/style.css" "$topic_dir/src/css/style.css"
      fi
      # JS: use shared if no local override
      if [ -f "$shared_dir/js/main.js" ] && [ ! -f "$topic_dir/src/js/main.js.local" ]; then
        cp "$shared_dir/js/main.js" "$topic_dir/src/js/main.js"
      fi
      # Footer: use shared if no local override
      if [ -f "$shared_dir/foot.html" ] && [ ! -f "$topic_dir/src/foot.html.local" ]; then
        cp "$shared_dir/foot.html" "$topic_dir/src/foot.html"
      fi
    fi

    echo "Building: $(basename "$topic_dir")"
    bash "$topic_dir/build.sh"
    built=$((built + 1))
  fi
done

echo "Built $built topic(s)."
