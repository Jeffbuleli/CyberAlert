# VPS bootstrap notes — Cyber Alert DRC
#
# 1. DNS
#    A/AAAA or CNAME: cyberalert.mcbuleli.org → same VPS as mcbuleli.org
#
# 2. Clone (once)
#    git clone https://github.com/Jeffbuleli/CyberAlert.git /opt/cyberalert
#    cp /opt/cyberalert/ops/vps/.env.example /opt/cyberalert/ops/vps/.env
#    # fill secrets
#
# 3. Nginx
#    cp ops/vps/nginx-cyberalert.conf /etc/nginx/sites-available/cyberalert
#    ln -s /etc/nginx/sites-available/cyberalert /etc/nginx/sites-enabled/
#    certbot --nginx -d cyberalert.mcbuleli.org
#    nginx -t && systemctl reload nginx
#
# 4. First deploy
#    bash /opt/cyberalert/ops/vps/deploy.sh
#    docker compose -f /opt/cyberalert/ops/vps/docker-compose.yml exec web \
#      node -e "console.log('ok')" 
#    # Run migrations/seed from a one-off container with DATABASE_URL
#
# 5. GitHub Actions secrets (same VPS SSH as McBuleli, different VPS_REPO_DIR)
#    VPS_REPO_DIR=/opt/cyberalert
