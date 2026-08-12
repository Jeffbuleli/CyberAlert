#!/usr/bin/env bash
# Seed classic ZRE permis specimen listing.
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
COMPOSE_DIR="$REPO_DIR/ops/vps"
SQL="$REPO_DIR/ops/vps/sql/0133_safefind_specimen_permis_zre.sql"

cd "$COMPOSE_DIR"
docker compose exec -T db psql -U cyberalert -d cyberalert < "$SQL"
echo "SPECIMEN_PERMIS_ZRE_OK"
