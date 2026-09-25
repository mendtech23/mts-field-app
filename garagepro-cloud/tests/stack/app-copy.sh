#!/bin/bash
# copy the app for the Level 2 browser test, pointed at the local Supabase stand-in
rm -rf /tmp/pgt/l2app && cp -r /home/user/mts-field-app/garagepro /tmp/pgt/l2app
ANON=$(node -e "console.log(require('/tmp/pgt/stack/keys.json').anon)")
cat > /tmp/pgt/l2app/js/config.js <<CFG
window.GP_CONFIG = { mode: 'preview', previewCloud: true, dbName: 'gp-l2test', supabaseUrl: 'http://localhost:8200', supabaseKey: '$ANON', garageId: '' };
CFG
