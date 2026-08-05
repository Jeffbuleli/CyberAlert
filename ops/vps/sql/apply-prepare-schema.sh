#!/usr/bin/env bash
# Apply additive Phase B/C/D schema prep on VPS Postgres (idempotent).
# Does not restart app containers. Does not enable HackerAI or deep-worker.
#
# Usage (root on VPS):
#   bash /opt/cyberalert/ops/vps/sql/apply-prepare-schema.sh
set -euo pipefail

REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
SQL="$REPO_DIR/ops/vps/sql/001_prepare_phase_bcd_schema.sql"
COMPOSE_DIR="$REPO_DIR/ops/vps"

if [[ ! -f "$SQL" ]]; then
  echo "ERROR: missing $SQL" >&2
  exit 1
fi

cd "$COMPOSE_DIR"
echo "==> Applying $SQL via cyberalert-db-1"
docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" < "$SQL"
echo "==> Verify tables"
docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" -c '\dt analysis_*'
docker compose exec -T db psql -U "${POSTGRES_USER:-cyberalert}" -d "${POSTGRES_DB:-cyberalert}" -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='link_checks' AND column_name IN ('verdict','needs_deep_analysis','hackerai_json','status') ORDER BY 1;"
echo "SCHEMA_PREP_OK"
