# Cyber Alert DRC

Plateforme de cybersécurité et de confiance numérique pour la RDC.

**Slogan :** Vérifiez avant de faire confiance.

## Stack

- Next.js (App Router) + React + Tailwind CSS 4
- PostgreSQL + Drizzle ORM
- Python FastAPI AI gateway (McBuleli AI explain layer)
- PawaPay (Mobile Money)
- Deploy VPS : Docker Compose + nginx → `https://cyberalert-rdc.org`

## Développement local

```bash
cp .env.example .env
# Start Postgres (port 5433)
docker compose -f ops/vps/docker-compose.yml up -d db
npm install
npm run db:push
npm run seed
npm run dev
```

App : http://localhost:3010

AI gateway (optionnel pour explications IA) :

```bash
cd services/ai-gateway
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8090
```

## Sécurité

- Ne jamais committer `.env`, clés API, tokens ou mots de passe.
- Le Link Checker bloque SSRF (localhost, IP privées, metadata).
- Les paiements ne sont activés qu'après vérification serveur du webhook PawaPay.

## Licence

Proprietary — McBuleli / Cyber Alert DRC.
