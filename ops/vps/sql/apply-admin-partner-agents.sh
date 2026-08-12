#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
SQL="$REPO_DIR/ops/vps/sql/0136_admin_partner_agents.sql"
COMPOSE_DIR="$REPO_DIR/ops/vps"
cd "$COMPOSE_DIR"
docker compose exec -T db psql -U cyberalert -d cyberalert -v ON_ERROR_STOP=1 -f - < "$SQL"
echo "APPLY_OK 0136_admin_partner_agents"
