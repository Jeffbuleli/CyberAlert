# VPS bootstrap notes — Cyber Alert DRC
#
# Production host (dedicated, away from McBuleli):
#   VPS: 153.75.235.176 (Ubuntu 26.04)
#   Domain: https://cyberalert-rdc.org  (DNS → Cloudflare → this VPS)
#   App path: /opt/cyberalert
#
# Legacy (McBuleli VPS 162.35.181.98): cyberalert.mcbuleli.org — redirect only after cutover.
#
# 1. DNS (Cloudflare)
#    A cyberalert-rdc.org → 153.75.235.176 (proxied)
#    A www → 153.75.235.176 (proxied)
#    SSL mode: Full (strict) once Let's Encrypt is on the origin
#
# 2. Clone (once)
#    git clone https://github.com/Jeffbuleli/CyberAlert.git /opt/cyberalert
#    cp /opt/cyberalert/ops/vps/.env.example /opt/cyberalert/ops/vps/.env
#    # fill secrets; set:
#    #   NEXT_PUBLIC_APP_URL=https://cyberalert-rdc.org
#    #   APP_URL=https://cyberalert-rdc.org
#
# 3. Nginx
#    cp ops/vps/nginx-cyberalert.conf /etc/nginx/sites-available/cyberalert
#    ln -sf /etc/nginx/sites-available/cyberalert /etc/nginx/sites-enabled/cyberalert
#    nginx -t && systemctl reload nginx
#    certbot --nginx -d cyberalert-rdc.org -d www.cyberalert-rdc.org
#
# 4. First deploy
#    bash /opt/cyberalert/ops/vps/deploy.sh
#    # seed / migrate as needed
#
# 5. Deploy later
#    bash /opt/cyberalert/ops/vps/deploy.sh
#
# Ports (localhost only):
#   web 3010 · ai 8090 · postgres 5433
