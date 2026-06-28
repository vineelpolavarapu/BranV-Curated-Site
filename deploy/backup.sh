#!/bin/sh
# Nightly pg_dump -> Cloudflare R2 backup.
# Runs on the VM host (not in a container) to save ~150 MB of memory vs.
# bundling pg_dump + aws-cli into a long-running container on a 1 GB VM.
#
# Install: see deploy/install-backup-cron.sh on the VM.
# Reads secrets from deploy/.env so we don't duplicate them.

set -eu

DEPLOY_DIR="${DEPLOY_DIR:-/opt/branv/deploy}"
# shellcheck disable=SC1091
. "${DEPLOY_DIR}/.env"

TS=$(date -u +%Y%m%dT%H%M%SZ)
TMP="/tmp/branv-${TS}.sql.gz"

# Dump from inside the postgres container so we don't need pg_dump on the host.
docker exec -i \
    "$(docker compose -f "${DEPLOY_DIR}/docker-compose.yml" ps -q postgres)" \
    pg_dump -U branv branv \
  | gzip > "${TMP}"

AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_KEY}" \
AWS_DEFAULT_REGION=auto \
aws --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    s3 cp "${TMP}" "s3://${R2_BACKUP_BUCKET:-branv-pg-backups}/"

rm -f "${TMP}"
echo "[backup] uploaded branv-${TS}.sql.gz to R2"
