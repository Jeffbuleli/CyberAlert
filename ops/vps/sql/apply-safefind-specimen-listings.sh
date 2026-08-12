#!/usr/bin/env bash
# Apply specimen marketplace listings on VPS.
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
COMPOSE_DIR="$REPO_DIR/ops/vps"
SQL="$REPO_DIR/ops/vps/sql/0131_safefind_specimen_listings.sql"

cd "$COMPOSE_DIR"
docker compose exec -T db psql -U cyberalert -d cyberalert < "$SQL"
echo "SPECIMEN_SEED_OK"
