# Local development with Docker Postgres + optional AI gateway

## Quick start

```bash
cp .env.example .env
docker compose -f ops/vps/docker-compose.yml up -d db
npm install
npm run db:push
npm run seed
npm run dev
```

Open http://localhost:3010

## AI gateway (optional)

```bash
cd services/ai-gateway
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export AI_GATEWAY_SECRET=change-me-ai-gateway-secret
uvicorn main:app --host 127.0.0.1 --port 8090
```

Without the gateway, link explanations use grounded French templates.

## Production

See [ops/vps/SERVER.md](ops/vps/SERVER.md) for `cyberalert.mcbuleli.org` + deploy-vps.
