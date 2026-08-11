#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SQL="$ROOT/ops/vps/sql/0128_safefind_location.sql"
: "${DATABASE_URL:?DATABASE_URL required}"
echo "Applying SafeFind location migration..."
# PostGIS may be missing on slim Postgres — continue without if CREATE EXTENSION fails
psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -c "CREATE EXTENSION IF NOT EXISTS postgis;" || true
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "Done."
