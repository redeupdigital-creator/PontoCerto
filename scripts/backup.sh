#!/usr/bin/env bash
# Backup do banco de dados do PontoCerto. Detecta automaticamente se é
# SQLite (dev/local) ou Postgres (produção/Supabase) a partir do .env.
#
# Uso:
#   bash scripts/backup.sh              # salva em ./backups/AAAA-MM-DD_HHmmss.*
#   bash scripts/backup.sh /caminho/dir  # salva num diretório específico
#
# Ver BACKUP.md para a política completa (frequência, retenção, restauração).

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DESTINO="${1:-./backups}"
mkdir -p "$DESTINO"
CARIMBO=$(date -u +"%Y-%m-%d_%H%M%S")

if [ -n "${DATABASE_URL:-}" ]; then
  # Supabase ou qualquer Postgres via URL única
  ARQUIVO="$DESTINO/pontocerto_${CARIMBO}.dump"
  echo "Fazendo backup via pg_dump (DATABASE_URL) -> $ARQUIVO"
  pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$ARQUIVO"
  echo "OK. Para restaurar: pg_restore --clean --if-exists --no-owner --dbname=\"\$DATABASE_URL\" \"$ARQUIVO\""

elif [ "${DB_DIALECT:-sqlite}" = "postgres" ]; then
  # Postgres tradicional (Docker/VPS/Render/Railway), variáveis separadas
  ARQUIVO="$DESTINO/pontocerto_${CARIMBO}.dump"
  echo "Fazendo backup via pg_dump (DB_HOST/DB_NAME) -> $ARQUIVO"
  PGPASSWORD="${DB_PASS:-}" pg_dump \
    --host="${DB_HOST:-localhost}" --port="${DB_PORT:-5432}" \
    --username="${DB_USER:-postgres}" --dbname="${DB_NAME:-ponto_certo}" \
    --format=custom --no-owner --no-privileges --file="$ARQUIVO"
  echo "OK. Para restaurar: pg_restore --clean --if-exists --no-owner -h HOST -U USER -d BANCO \"$ARQUIVO\""

else
  # SQLite: o "backup" é copiar o arquivo (com o banco parado, ou aceitando
  # o pequeno risco de ler no meio de uma escrita — aceitável para
  # desenvolvimento; produção de verdade deve usar Postgres, não SQLite)
  ORIGEM="${DB_STORAGE:-./data/ponto.sqlite}"
  if [ ! -f "$ORIGEM" ]; then
    echo "Arquivo SQLite não encontrado em $ORIGEM — nada para copiar." >&2
    exit 1
  fi
  ARQUIVO="$DESTINO/pontocerto_${CARIMBO}.sqlite"
  echo "Copiando banco SQLite ($ORIGEM) -> $ARQUIVO"
  cp "$ORIGEM" "$ARQUIVO"
  echo "OK. Para restaurar: pare o servidor e copie \"$ARQUIVO\" de volta para \"$ORIGEM\"."
fi

echo "Backup concluído: $ARQUIVO"
