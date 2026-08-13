#!/usr/bin/env bash
# Restaura um backup gerado por scripts/backup.sh.
#
# Uso:
#   bash scripts/restore.sh backups/pontocerto_2026-08-12_030000.dump
#   bash scripts/restore.sh backups/pontocerto_2026-08-12_030000.sqlite
#
# ATENÇÃO: isso SOBRESCREVE os dados atuais do banco de destino. Confirme
# duas vezes que está apontando para o banco certo antes de rodar em produção.

set -euo pipefail
cd "$(dirname "$0")/.."

ARQUIVO="${1:-}"
if [ -z "$ARQUIVO" ] || [ ! -f "$ARQUIVO" ]; then
  echo "Uso: bash scripts/restore.sh <arquivo-de-backup>" >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "⚠️  Isso vai SOBRESCREVER o banco de dados atual com o conteúdo de: $ARQUIVO"
read -p "Digite 'restaurar' para confirmar: " CONFIRMACAO
if [ "$CONFIRMACAO" != "restaurar" ]; then
  echo "Cancelado."
  exit 1
fi

case "$ARQUIVO" in
  *.sqlite)
    DESTINO="${DB_STORAGE:-./data/ponto.sqlite}"
    echo "Restaurando SQLite: $ARQUIVO -> $DESTINO"
    echo "Certifique-se de que o servidor está PARADO antes de continuar."
    cp "$ARQUIVO" "$DESTINO"
    echo "OK."
    ;;
  *.dump)
    if [ -n "${DATABASE_URL:-}" ]; then
      echo "Restaurando Postgres via DATABASE_URL..."
      pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$ARQUIVO"
    else
      echo "Restaurando Postgres via DB_HOST/DB_NAME..."
      PGPASSWORD="${DB_PASS:-}" pg_restore --clean --if-exists --no-owner \
        --host="${DB_HOST:-localhost}" --port="${DB_PORT:-5432}" \
        --username="${DB_USER:-postgres}" --dbname="${DB_NAME:-ponto_certo}" \
        "$ARQUIVO"
    fi
    echo "OK."
    ;;
  *)
    echo "Extensão de arquivo não reconhecida (esperado .sqlite ou .dump)." >&2
    exit 1
    ;;
esac

echo "Restauração concluída. Reinicie a aplicação."
