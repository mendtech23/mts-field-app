#!/usr/bin/env bash
#
# Rebuilds the schema from migrations in a throwaway database and runs the
# authorization suite against it. Proves the migrations work from nothing —
# not just against a database that happens to be in the right state.
#
# Usage:  ./scripts/db-test.sh
# Requires a local PostgreSQL and permission to create databases.

set -euo pipefail

DB="${MTS_TEST_DB:-mts_authz_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Run psql as the postgres superuser when invoked as root (typical in CI
# containers); otherwise as the current user.
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  psql_run() { su postgres -c "psql $*"; }
else
  psql_run() { psql "$@"; }
fi

echo "==> dropping and recreating $DB"
psql_run "-q -c 'drop database if exists $DB'" >/dev/null
psql_run "-q -c 'create database $DB'" >/dev/null

echo "==> applying migrations"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "    $(basename "$file")"
  psql_run "-q -v ON_ERROR_STOP=1 -d $DB -f $file"
done

echo "==> running authorization tests"
psql_run "-v ON_ERROR_STOP=1 -d $DB -f $ROOT/tests/authorization.test.sql"

echo "==> dropping $DB"
psql_run "-q -c 'drop database $DB'" >/dev/null

echo "==> database tests passed"
