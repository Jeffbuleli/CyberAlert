#!/usr/bin/env bash
set -euo pipefail
# Usage (root on VPS): bash /opt/cyberalert/ops/vps/sql/apply-safefind-location.sh
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
SQL="$REPO_DIR/ops/vps/sql/0128_safefind_location.sql"
COMPOSE_DIR="$REPO_DIR/ops/vps"
cd "$COMPOSE_DIR"

echo "Applying SafeFind location migration (PostGIS best-effort)..."
docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" \
  -v ON_ERROR_STOP=0 -c "CREATE EXTENSION IF NOT EXISTS postgis;" || true

docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" < "$SQL"
echo "SAFEFIND_LOCATION_SCHEMA_OK"
