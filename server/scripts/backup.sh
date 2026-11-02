#!/usr/bin/env bash
# One backup: copies the database, encrypts the copy and stores it (see server/README.md, "Backups").
# Needs Docker (the database's own tools, the right version), gpg and node. Settings: BACKUP_DATABASE_URL,
# BACKUP_PASSPHRASE, and those of backup-store.js. Keeps BACKUP_DAYS days (30) and never fewer than the last 7.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?is not set}"
: "${BACKUP_PASSPHRASE:?is not set}"
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

docker run --rm -e BACKUP_DATABASE_URL --add-host=host.docker.internal:host-gateway pgvector/pgvector:pg16 \
  sh -c 'pg_dump "$BACKUP_DATABASE_URL" --format=custom --no-owner --no-privileges' > "$work/quilts.dump"
[ -s "$work/quilts.dump" ] || { echo "The copy of the database came out empty." >&2; exit 1; }

gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 \
  --output "$work/quilts.dump.gpg" "$work/quilts.dump" 3<<< "$BACKUP_PASSPHRASE"

node "$here/backup-store.js" put "$work/quilts.dump.gpg"
node "$here/backup-store.js" prune "${BACKUP_DAYS:-30}" 7
