#!/bin/bash
# runs the three edge functions locally with Deno (like Supabase does)
cd /tmp/pgt/stack
for f in fn-*.pid mm.pid; do [ -f "$f" ] && kill $(cat "$f") 2>/dev/null; done; sleep 0.5
nohup node mockmail.js > mockmail.log 2>&1 & echo $! > mm.pid
K=$(cat keys.json)
export SUPABASE_URL=http://localhost:8200 SUPABASE_ANON_KEY=$(node -e "console.log(require('./keys.json').anon)") SUPABASE_SERVICE_ROLE_KEY=$(node -e "console.log(require('./keys.json').service)")
export RESEND_API_KEY=re_test_key RESEND_URL=http://localhost:8310/emails APP_URL=https://mendtech-preview.netlify.app
DENO=/tmp/pgt/denotest/package/deno
SRC=/home/user/mts-field-app/garagepro-cloud/functions
for pair in login:8301 staff-admin:8302 notify:8303; do n=${pair%%:*}; p=${pair##*:}
  DENO_NO_UPDATE_CHECK=1 DENO_SERVE_ADDRESS=tcp:127.0.0.1:$p NO_COLOR=1 nohup $DENO run --allow-net --allow-env $SRC/$n/index.ts > fn-$n.log 2>&1 & echo $! > fn-$n.pid
done
