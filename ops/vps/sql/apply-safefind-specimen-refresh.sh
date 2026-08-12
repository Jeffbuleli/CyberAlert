#!/usr/bin/env bash
# Refresh specimen marketplace listings with R2 preview URLs.
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
COMPOSE_DIR="$REPO_DIR/ops/vps"
SQL="$REPO_DIR/ops/vps/sql/0132_safefind_specimen_refresh.sql"

cd "$COMPOSE_DIR"
docker compose exec -T db psql -U cyberalert -d cyberalert < "$SQL"
echo "SPECIMEN_REFRESH_OK"
