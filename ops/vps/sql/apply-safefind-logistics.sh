#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
SQL="$REPO_DIR/ops/vps/sql/0127_safefind_logistics.sql"
COMPOSE_DIR="$REPO_DIR/ops/vps"
cd "$COMPOSE_DIR"
docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" < "$SQL"
echo "SAFEFIND_LOGISTICS_SCHEMA_OK"
