#!/usr/bin/env bash
# Assembles src/ into a single index.html
# Uses awk to replace placeholders with file contents (safe for any content)
set -euo pipefail
cd "$(dirname "$0")"

{
  # head.html with CSS inlined at /* STYLES */
  awk '/\/\* STYLES \*\//{system("cat src/css/style.css"); next}1' src/head.html

  # all sections in order
  for f in src/sections/*.html; do
    cat "$f"
  done

  # foot.html with JS inlined at /* SCRIPT */
  awk '/\/\* SCRIPT \*\//{system("cat src/js/main.js"); next}1' src/foot.html
} > index.html

echo "Built index.html ($(wc -c < index.html | tr -d ' ') bytes)"
