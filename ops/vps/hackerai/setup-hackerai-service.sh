#!/usr/bin/env bash
# Organize HackerAI Local Agent as a separate systemd service on the Cyber Alert VPS.
# Does NOT enable Docker sandbox by default. Does NOT use --dangerous.
# Does NOT change Cyber Alert app behavior.
#
# Usage (root on VPS):
#   bash /opt/cyberalert/ops/vps/hackerai/setup-hackerai-service.sh
#   bash /opt/cyberalert/ops/vps/hackerai/setup-hackerai-service.sh --enable   # start after token set
#   bash /opt/cyberalert/ops/vps/hackerai/setup-hackerai-service.sh --status
set -euo pipefail

REPO_DIR="${CYBERALERT_REPO:-/opt/cyberalert}"
UNIT_SRC="$REPO_DIR/ops/vps/hackerai/hackerai-local.service"
ENV_EXAMPLE="$REPO_DIR/ops/vps/hackerai/hackerai.env.example"
ENV_FILE="/etc/cyberalert/hackerai.env"
UNIT_DST="/etc/systemd/system/hackerai-local.service"
ENABLE=0
STATUS_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --enable) ENABLE=1 ;;
    --status) STATUS_ONLY=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root" >&2
  exit 1
fi

if [[ "$STATUS_ONLY" -eq 1 ]]; then
  systemctl status hackerai-local.service --no-pager || true
  id hackerai 2>/dev/null || echo "user hackerai: missing"
  test -f "$ENV_FILE" && echo "env: $ENV_FILE present" || echo "env: missing"
  exit 0
fi

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "ERROR: missing $UNIT_SRC — deploy/sync repo first" >&2
  exit 1
fi

echo "==> Creating dedicated user hackerai (no login shell)"
if ! id hackerai >/dev/null 2>&1; then
  useradd --system --home /var/lib/hackerai --shell /usr/sbin/nologin --create-home hackerai
fi
mkdir -p /var/lib/hackerai /etc/cyberalert /var/log/cyberalert
chown hackerai:hackerai /var/lib/hackerai
chmod 750 /var/lib/hackerai
chmod 750 /etc/cyberalert

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 640 -o root -g hackerai "$ENV_EXAMPLE" "$ENV_FILE"
  echo "==> Wrote $ENV_FILE — EDIT and set HACKERAI_API_KEY=hsb_… before --enable"
else
  echo "==> Keeping existing $ENV_FILE"
  chown root:hackerai "$ENV_FILE"
  chmod 640 "$ENV_FILE"
fi

# Optional: docker group only if sandbox gate later allows (not by default)
# usermod -aG docker hackerai

if ! command -v node >/dev/null || ! command -v npx >/dev/null; then
  echo "==> Node/npx missing — installing via install-hackerai-agent.sh --install-only"
  bash "$REPO_DIR/ops/vps/install-hackerai-agent.sh" --install-only
fi

install -m 644 "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload

# Refuse enable if placeholder token
TOKEN="$(grep -E '^HACKERAI_API_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ "$ENABLE" -eq 1 ]]; then
  if [[ -z "$TOKEN" || "$TOKEN" == hsb_REPLACE_ME* || "$TOKEN" != hsb_* ]]; then
    echo "ERROR: set a real HACKERAI_API_KEY (hsb_…) in $ENV_FILE before --enable" >&2
    exit 1
  fi
  if grep -qE '^HACKERAI_DANGEROUS=1' "$ENV_FILE" 2>/dev/null; then
    echo "ERROR: HACKERAI_DANGEROUS=1 is forbidden on this VPS" >&2
    exit 1
  fi
  # RAM gate for Docker sandbox flag
  if grep -qE '^HACKERAI_ALLOW_DOCKER_SANDBOX=1' "$ENV_FILE" 2>/dev/null; then
    MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
    if [[ "$MEM_MB" -lt 3500 ]]; then
      echo "ERROR: HACKERAI_ALLOW_DOCKER_SANDBOX=1 requires ≥ ~4 GiB RAM (host has ${MEM_MB} MiB)." >&2
      echo "        Keep sandbox off; use UI cloud sandbox or upgrade VPS first." >&2
      exit 1
    fi
  fi
  systemctl enable hackerai-local.service
  systemctl restart hackerai-local.service
  systemctl --no-pager --full status hackerai-local.service || true
  echo "OK: agent started. In hackerai.co select Remote control → cyberalert-vps"
else
  systemctl disable hackerai-local.service 2>/dev/null || true
  systemctl stop hackerai-local.service 2>/dev/null || true
  echo "OK: unit installed but NOT enabled (safe). Set token then re-run with --enable"
fi
