#!/bin/bash
cd /tmp/pgt/stack
[ -f gw.pid ] && kill $(cat gw.pid) 2>/dev/null; sleep 0.5
JWT_SECRET='local-test-secret-with-at-least-32-characters!!' FN_PORTS='{"login":8301,"staff-admin":8302,"notify":8303}' nohup node gateway.js > gateway.log 2>&1 &
echo $! > gw.pid
