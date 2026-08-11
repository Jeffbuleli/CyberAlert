#!/usr/bin/env bash
# Apply SafeFind tables (idempotent).
# Usage (root on VPS): bash /opt/cyberalert/ops/vps/sql/apply-safefind-schema.sh
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
SQL="$REPO_DIR/ops/vps/sql/0126_safefind.sql"
COMPOSE_DIR="$REPO_DIR/ops/vps"
if [[ ! -f "$SQL" ]]; then
  echo "ERROR: missing $SQL" >&2
  exit 1
fi
cd "$COMPOSE_DIR"
echo "==> Applying $SQL via db"
docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" < "$SQL"
echo "==> Verify"
docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" -c '\dt safefind_*'
echo "SAFEFIND_SCHEMA_OK"
