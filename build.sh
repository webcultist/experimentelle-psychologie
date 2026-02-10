#!/usr/bin/env bash
# Assembles src/ into a single index.html
set -euo pipefail
cd "$(dirname "$0")"

CSS=$(cat src/css/style.css)
JS=$(cat src/js/main.js)

{
  # head.html with CSS inlined
  sed "s|/\* STYLES \*/|$(echo "$CSS" | sed 's/[&/\]/\\&/g; s/$/\\/' | sed '$ s/\\$//')|" src/head.html

  # all sections in order
  for f in src/sections/*.html; do
    cat "$f"
  done

  # foot.html with JS inlined
  sed "s|/\* SCRIPT \*/|$(echo "$JS" | sed 's/[&/\]/\\&/g; s/$/\\/' | sed '$ s/\\$//')|" src/foot.html
} > index.html

echo "Built index.html ($(wc -c < index.html | tr -d ' ') bytes)"
