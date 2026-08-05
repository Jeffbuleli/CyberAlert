# Local development (npm, no Docker)

Postgres local already running (same instance as McBuleli) + separate DB `cyberalert`.

```bash
cd /Users/mac/Documents/CyberAlert
# .env already points to localhost:5432/cyberalert
npm run db:push
npm run seed
npm run dev
```

App: **http://localhost:3010** (ports 3000/3001 free for McBuleli)

Admin seed (change password in prod):
- email: `admin@cyberalert.local`
- password: from `ADMIN_SEED_PASSWORD` in `.env`

AI gateway optional — without it, explanations use French templates.

## Production

See [ops/vps/SERVER.md](../ops/vps/SERVER.md) for `cyberalert-rdc.org` + deploy-vps.
