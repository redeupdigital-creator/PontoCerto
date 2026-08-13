#!/usr/bin/env bash
# Deploy de uma atualização do PontoCerto já instalado na VPS.
# Faz backup antes de migrar (por segurança), atualiza dependências, roda
# migrations pendentes, e reinicia o processo via PM2.
#
# Uso: bash scripts/deploy.sh
# (Rode de dentro da pasta do projeto, depois de já ter subido os arquivos
# novos via git pull, scp ou rsync.)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "--- Backup de segurança antes do deploy ---"
bash scripts/backup.sh ./backups-pre-deploy

echo "--- Instalando dependências ---"
npm install --omit=dev

echo "--- Rodando migrations pendentes ---"
npx sequelize-cli db:migrate

echo "--- Reiniciando aplicação (PM2) ---"
pm2 restart pontocerto

echo "--- Status ---"
pm2 status pontocerto

echo ""
echo "Deploy concluído. Confira os logs se algo parecer errado: pm2 logs pontocerto --lines 50"
