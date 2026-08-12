#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
COMPOSE_DIR="$REPO_DIR/ops/vps"
SQL="$REPO_DIR/ops/vps/sql/0134_safefind_reward_policy_update.sql"
cd "$COMPOSE_DIR"
docker compose exec -T db psql -U cyberalert -d cyberalert < "$SQL"
echo "REWARD_POLICY_UPDATE_OK"
