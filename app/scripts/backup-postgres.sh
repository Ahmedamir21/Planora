#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL in your shell first; never put credentials in this script." >&2
  exit 2
fi
command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump was not found; install PostgreSQL client tools first." >&2; exit 2; }

BACKUP_DIR="${PLANORA_BACKUP_DIR:-$HOME/planora-backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT="$BACKUP_DIR/planora-postgres-$TIMESTAMP.sql.gz"
TEMP="$OUTPUT.partial"
trap 'rm -f "$TEMP"' EXIT

pg_dump --dbname="$DATABASE_URL" --format=plain --no-owner --no-privileges 2>"$BACKUP_DIR/planora-postgres-$TIMESTAMP.log" | gzip -9 > "$TEMP"
gzip -t "$TEMP"
mv "$TEMP" "$OUTPUT"
chmod 600 "$OUTPUT" "$BACKUP_DIR/planora-postgres-$TIMESTAMP.log"
sha256sum "$OUTPUT" > "$OUTPUT.sha256"
chmod 600 "$OUTPUT.sha256"

echo "Backup created: $OUTPUT"
echo "Keep it outside Git and test restore into a separate empty database."
echo "Restore with: gzip -dc BACKUP.sql.gz | psql RESTORE_DATABASE_URL"
