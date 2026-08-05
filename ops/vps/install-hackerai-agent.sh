#!/usr/bin/env bash
# Install Node.js (for npx) + start HackerAI local agent on the Cyber Alert VPS.
# App itself runs in Docker — this is only for the optional HackerAI agent on the host.
#
# Usage (as root or with sudo):
#   bash /opt/cyberalert/ops/vps/install-hackerai-agent.sh
#   bash /opt/cyberalert/ops/vps/install-hackerai-agent.sh --install-only
set -euo pipefail

COMPOSE_ENV="${CYBERALERT_ENV:-/opt/cyberalert/ops/vps/.env}"
INSTALL_ONLY=0
if [[ "${1:-}" == "--install-only" ]]; then
  INSTALL_ONLY=1
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

install_node() {
  if need_cmd node && need_cmd npx; then
    echo "==> Node already present: $(node -v) / npx $(npx -v 2>/dev/null || true)"
    return 0
  fi

  echo "==> Installing Node.js 20.x (NodeSource) for npx / @hackerai/local"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
  echo "==> Installed $(node -v) / npm $(npm -v)"
}

load_token() {
  TOKEN="${HACKERAI_API_KEY:-}"
  if [[ -z "$TOKEN" && -f "$COMPOSE_ENV" ]]; then
    # shellcheck disable=SC1090
    set -a
    # Only pull HackerAI vars (avoid sourcing secrets into shell history broadly)
    TOKEN="$(grep -E '^HACKERAI_API_KEY=' "$COMPOSE_ENV" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    QS="$(grep -E '^HACKERAI_QUICKSTART_TOKEN=' "$COMPOSE_ENV" | tail -1 | cut -d= -f2- || true)"
    set +a
    if [[ -z "$TOKEN" && -n "${QS:-}" ]]; then
      TOKEN="$(echo "$QS" | sed -n 's/.*--token[[:space:]]\+\([^[:space:]]\+\).*/\1/p')"
    fi
  fi
  if [[ -z "$TOKEN" ]]; then
    echo "ERROR: set HACKERAI_API_KEY in $COMPOSE_ENV (or export it)." >&2
    exit 1
  fi
  if [[ "$TOKEN" != hsb_* ]]; then
    echo "WARN: token does not start with hsb_ — verify Settings → Agents on hackerai.co" >&2
  fi
}

install_node

if [[ "$INSTALL_ONLY" -eq 1 ]]; then
  echo "INSTALL_OK (node only)"
  exit 0
fi

load_token
echo "==> Starting HackerAI local agent (Ctrl+C to stop)"
echo "    Then in hackerai.co UI: select this machine as Local / Remote control."
exec npx --yes @hackerai/local@latest --token "$TOKEN"
