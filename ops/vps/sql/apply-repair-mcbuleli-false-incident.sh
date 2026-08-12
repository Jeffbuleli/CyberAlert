#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
COMPOSE_DIR="$REPO_DIR/ops/vps"
SQL="$REPO_DIR/ops/vps/sql/0135_repair_mcbuleli_false_incident.sql"
cd "$COMPOSE_DIR"
docker compose exec -T db psql -U cyberalert -d cyberalert < "$SQL"
echo "MCBULELI_FALSE_INCIDENT_REPAIR_OK"
