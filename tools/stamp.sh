#!/bin/sh
# Stamps every stylesheet and script link in the pages with the current
# minute, so a phone that already cached the old files is forced to fetch
# the new ones instead of mixing the two. Run before committing a change.

set -e
cd "$(dirname "$0")/.."

V=$(date +%Y%m%d%H%M)

for f in index.html plan.html calendar.html; do
  # assets/thing.css?v=… and assets/thing.js?v=… (adds the ?v= if missing)
  perl -pi -e 's{(assets/[a-z0-9-]+\.(?:css|js))(\?v=[0-9]+)?}{$1?v='"$V"'}g' "$f"
done

echo "stamped assets with v=$V"
