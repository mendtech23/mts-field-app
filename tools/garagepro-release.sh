#!/bin/bash
# GaragePro release helper.
#   tools/garagepro-release.sh <version> [out-dir] [--sql]
# 1. sets APP_VERSION (garagepro/js/core.js) and the service-worker cache name (garagepro/sw.js) to <version>
# 2. rebuilds garagepro-cloud/sql/all-in-one.sql from level2.sql (everything after the "3. Security Level 2" marker)
# 3. builds GaragePro-v<version>-LIVE.zip (folder GaragePro-LIVE, live config as in the repo)
#    and GaragePro-v<version>-PREVIEW.zip (folder GaragePro-PREVIEW, garagepro-cloud/preview/config.js)
# 4. with --sql also copies all-in-one-v<version>.sql (send it only when the SQL changed)
# It does not commit, push or deploy anything.
set -euo pipefail
V="${1:?usage: tools/garagepro-release.sh <version> [out-dir] [--sql]}"
OUT="${2:-${CLAUDE_SCRATCHPAD:-/tmp}/garagepro-out}"
SQL=no; for a in "$@"; do [ "$a" = "--sql" ] && SQL=yes; done
[[ "$OUT" == --* ]] && OUT="${CLAUDE_SCRATCHPAD:-/tmp}/garagepro-out"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must look like 3.8.3"; exit 1; }

sed -i -E "s/const APP_VERSION = '[^']+';/const APP_VERSION = '$V';/" "$ROOT/garagepro/js/core.js"
sed -i -E "s/const CACHE = 'garagepro-v[^']+';/const CACHE = 'garagepro-v$V';/" "$ROOT/garagepro/sw.js"
grep -q "APP_VERSION = '$V'" "$ROOT/garagepro/js/core.js" && grep -q "garagepro-v$V'" "$ROOT/garagepro/sw.js" || { echo "version bump failed"; exit 1; }

# all-in-one.sql = parts 1-2 as they are + the current level2.sql
AIO="$ROOT/garagepro-cloud/sql/all-in-one.sql"
MARK='-- ===== 3. Security Level 2 ====='
grep -qF -- "$MARK" "$AIO" || { echo "marker missing in all-in-one.sql"; exit 1; }
{ sed -n "1,/^$MARK/p" "$AIO"; cat "$ROOT/garagepro-cloud/sql/level2.sql"; } > "$AIO.new" && mv "$AIO.new" "$AIO"

for f in "$ROOT"/garagepro/js/*.js "$ROOT"/garagepro/sw.js; do node --check "$f"; done

mkdir -p "$OUT"; B="$(mktemp -d)"
cp -r "$ROOT/garagepro" "$B/GaragePro-LIVE"
cp -r "$ROOT/garagepro" "$B/GaragePro-PREVIEW"
cp "$ROOT/garagepro-cloud/preview/config.js" "$B/GaragePro-PREVIEW/js/config.js"
rm -f "$OUT/GaragePro-v$V-LIVE.zip" "$OUT/GaragePro-v$V-PREVIEW.zip"
(cd "$B" && zip -qr "$OUT/GaragePro-v$V-LIVE.zip" GaragePro-LIVE && zip -qr "$OUT/GaragePro-v$V-PREVIEW.zip" GaragePro-PREVIEW)
rm -rf "$B"
[ "$SQL" = yes ] && cp "$AIO" "$OUT/all-in-one-v$V.sql"

# sanity: the LIVE zip must carry the live project, the PREVIEW zip the preview project
unzip -p "$OUT/GaragePro-v$V-LIVE.zip" GaragePro-LIVE/js/config.js | grep -q otdmnzvmlqjppydokcfv || { echo "LIVE zip does not have the live config!"; exit 1; }
unzip -p "$OUT/GaragePro-v$V-PREVIEW.zip" GaragePro-PREVIEW/js/config.js | grep -q ugpaqdthrxbulrxeijpz || { echo "PREVIEW zip does not have the preview config!"; exit 1; }
echo "Built v$V in $OUT:"; ls -la "$OUT" | grep -E "v$V" || true
