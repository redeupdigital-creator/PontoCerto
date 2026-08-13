#!/usr/bin/env bash
# Setup automatizado do PontoCerto numa VPS nova (Ubuntu 22.04/24.04 ou Debian
# — é o que a Hostgator oferece nos planos de VPS Linux). Idempotente: pode
# rodar de novo sem quebrar nada se algo já estiver instalado.
#
# Uso (como root, ou usuário com sudo):
#   bash scripts/setup-vps.sh
#
# O script vai perguntar o domínio e o e-mail (para o certificado SSL) e
# fazer o resto sozinho: Node.js, PM2, Nginx, firewall, certificado HTTPS.
# Ele NÃO decide sozinho sobre banco de dados nem preenche o .env por você
# — isso fica pra você revisar (ver DEPLOY_HOSTGATOR_VPS.md).

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MAJOR=22

echo "======================================================"
echo " Setup do PontoCerto — $APP_DIR"
echo "======================================================"

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode este script como root (ou com sudo)." >&2
  exit 1
fi

read -rp "Domínio que vai apontar pra essa VPS (ex: ponto.suaempresa.com.br): " DOMINIO
read -rp "E-mail para o certificado SSL (Let's Encrypt): " EMAIL_SSL

# ---------------------------------------------------------
# 1) Atualiza o sistema e instala dependências básicas
# ---------------------------------------------------------
echo "--- Atualizando pacotes do sistema ---"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git build-essential ufw

# ---------------------------------------------------------
# 2) Node.js (via NodeSource) — só instala se não existir/versão errada
# ---------------------------------------------------------
if ! command -v node >/dev/null || [ "$(node -v | sed 's/v//;s/\..*//')" -lt "$NODE_MAJOR" ]; then
  echo "--- Instalando Node.js ${NODE_MAJOR}.x ---"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
else
  echo "--- Node.js já instalado ($(node -v)), pulando ---"
fi

# ---------------------------------------------------------
# 3) PM2 (gerenciador de processo)
# ---------------------------------------------------------
if ! command -v pm2 >/dev/null; then
  echo "--- Instalando PM2 ---"
  npm install -g pm2
else
  echo "--- PM2 já instalado, pulando ---"
fi

# ---------------------------------------------------------
# 4) Nginx
# ---------------------------------------------------------
if ! command -v nginx >/dev/null; then
  echo "--- Instalando Nginx ---"
  apt-get install -y nginx
else
  echo "--- Nginx já instalado, pulando ---"
fi

# ---------------------------------------------------------
# 5) Certbot (SSL grátis via Let's Encrypt)
# ---------------------------------------------------------
if ! command -v certbot >/dev/null; then
  echo "--- Instalando Certbot ---"
  apt-get install -y certbot python3-certbot-nginx
else
  echo "--- Certbot já instalado, pulando ---"
fi

# ---------------------------------------------------------
# 6) Firewall — só libera SSH, HTTP e HTTPS. A porta 3000 (Node)
#    NUNCA fica exposta diretamente; só o Nginx conversa com ela.
# ---------------------------------------------------------
echo "--- Configurando firewall (ufw) ---"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ---------------------------------------------------------
# 7) Dependências da aplicação
# ---------------------------------------------------------
echo "--- Instalando dependências do PontoCerto (npm install) ---"
cd "$APP_DIR"
npm install --omit=dev
mkdir -p logs data uploads backups

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  Criei o .env a partir do .env.example — EDITE ELE AGORA antes de continuar:"
  echo "    nano $APP_DIR/.env"
  echo "    (defina DATABASE_URL ou DB_*, JWT_SECRET, SUPABASE_*, etc — ver DEPLOY_HOSTGATOR_VPS.md)"
  echo ""
  read -rp "Pressione Enter depois de editar o .env para continuar (ou Ctrl+C para editar e rodar o script de novo)... " _
fi

# ---------------------------------------------------------
# 8) Nginx: site do PontoCerto
# ---------------------------------------------------------
echo "--- Configurando site no Nginx ---"
sed "s/SEU_DOMINIO_AQUI/${DOMINIO}/g" "$APP_DIR/nginx/pontocerto.conf" > /etc/nginx/sites-available/pontocerto
ln -sf /etc/nginx/sites-available/pontocerto /etc/nginx/sites-enabled/pontocerto
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ---------------------------------------------------------
# 9) Migrations do banco (precisa do .env já configurado)
# ---------------------------------------------------------
echo "--- Rodando migrations ---"
npx sequelize-cli db:migrate

read -rp "Primeira instalação — rodar o seed (cria o usuário admin)? [s/N] " RODAR_SEED
if [[ "$RODAR_SEED" =~ ^[Ss]$ ]]; then
  node src/seed.js
fi

# ---------------------------------------------------------
# 10) Sobe a aplicação com PM2 e configura pra iniciar sozinha no boot
# ---------------------------------------------------------
echo "--- Subindo a aplicação com PM2 ---"
grep -q "SKIP_SYNC=true" .env || echo "SKIP_SYNC=true" >> .env
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ---------------------------------------------------------
# 11) Certificado SSL
# ---------------------------------------------------------
echo "--- Emitindo certificado SSL (Let's Encrypt) ---"
certbot --nginx -d "$DOMINIO" -d "www.$DOMINIO" --non-interactive --agree-tos -m "$EMAIL_SSL" --redirect || \
  echo "⚠️  Certbot falhou — confira se o DNS do domínio já está apontando pra essa VPS antes de tentar de novo: certbot --nginx -d $DOMINIO"

# ---------------------------------------------------------
# 12) Cron do backup diário
# ---------------------------------------------------------
echo "--- Agendando backup diário (3h da manhã) ---"
(crontab -l 2>/dev/null | grep -v "scripts/backup.sh"; echo "0 3 * * * cd $APP_DIR && bash scripts/backup.sh $APP_DIR/backups >> $APP_DIR/logs/backup.log 2>&1") | crontab -

echo ""
echo "======================================================"
echo " Setup concluído!"
echo " Acesse: https://$DOMINIO/painel  (painel administrativo)"
echo "         https://$DOMINIO/app     (app mobile)"
echo " Ver status: pm2 status"
echo " Ver logs:   pm2 logs pontocerto"
echo "======================================================"
