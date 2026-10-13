#!/bin/bash
# GaragePro session start (cloud sessions only): start the browser-test web server and print a short status
# that Claude reads at the start of the session. Fast: nothing to install (Playwright + Chromium are pre-installed).
set -uo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT" || exit 0
if [ ! -f garagepro/js/core.js ]; then
  echo "GaragePro: garagepro/ is not on this branch ($(git branch --show-current 2>/dev/null)). The app lives on branch claude/handoff-continuation-l39e0b until it is merged into main."
  exit 0
fi
mkdir -p /tmp/pgt
if ! curl -s -o /dev/null -m 2 http://localhost:8099/new/index.html; then
  (setsid nohup node garagepro-cloud/tests/stack/serve-app.mjs > /tmp/gp-web.log 2>&1 &) ; sleep 1
fi
V=$(grep -oE "APP_VERSION = '[^']+'" garagepro/js/core.js | cut -d"'" -f2)
UP=$(curl -s -o /dev/null -m 2 -w "%{http_code}" http://localhost:8099/new/index.html || true)
echo "GaragePro v$V on branch $(git branch --show-current 2>/dev/null). Test server :8099 → ${UP:-down}. Read CLAUDE.md and docs/garagepro/NOTES.md before changing the app."
exit 0
