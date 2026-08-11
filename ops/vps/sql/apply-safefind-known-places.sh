#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
SQL="$REPO_DIR/ops/vps/sql/0129_safefind_known_places.sql"
COMPOSE_DIR="$REPO_DIR/ops/vps"
cd "$COMPOSE_DIR"
docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" < "$SQL"
echo "SAFEFIND_KNOWN_PLACES_OK"
