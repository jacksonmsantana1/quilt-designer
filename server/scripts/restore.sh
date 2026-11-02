#!/usr/bin/env bash
# Brings a backup back, into an EMPTY database (it refuses any other, so it can't overwrite what is there):
#   bash server/scripts/restore.sh latest
#   bash server/scripts/restore.sh backups/2026-11-03T060000Z.dump.gpg
# Settings: RESTORE_DATABASE_URL (a new, empty database), BACKUP_PASSPHRASE, and those of backup-store.js.
set -euo pipefail

: "${RESTORE_DATABASE_URL:?is not set}"
: "${BACKUP_PASSPHRASE:?is not set}"
which="${1:?say which backup: latest, or its name (backup-store.js list)}"
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

in_db() {
  docker run --rm -i -e RESTORE_DATABASE_URL --add-host=host.docker.internal:host-gateway pgvector/pgvector:pg16 sh -c "$1"
}

tables="$(in_db 'psql "$RESTORE_DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema = '\''public'\''"' | tr -d '\r')"
if [ "$tables" != "0" ]; then
  echo "That database already has $tables tables: nothing was changed. Use a new, empty one." >&2
  exit 1
fi

node "$here/backup-store.js" get "$which" "$work/quilts.dump.gpg"
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt \
  --output "$work/quilts.dump" "$work/quilts.dump.gpg" 3<<< "$BACKUP_PASSPHRASE"

in_db 'pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-privileges --exit-on-error' < "$work/quilts.dump"

echo "Restored. What came back:"
in_db 'psql "$RESTORE_DATABASE_URL" -Atc "select '\''users '\'' || count(*) from users union all select '\''designs '\'' || count(*) from designs union all select '\''fabrics '\'' || count(*) from fabrics union all select '\''shared quilts '\'' || count(*) from shared_designs"'
