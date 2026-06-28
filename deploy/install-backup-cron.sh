#!/bin/sh
# Install the nightly backup cron entry on the VM.
# Run once, after deploy/ has been moved to /opt/branv/deploy.
# Idempotent: re-running won't create duplicates.

set -eu

DEPLOY_DIR="/opt/branv/deploy"
SCRIPT="${DEPLOY_DIR}/backup.sh"
LOG="/var/log/branv-backup.log"

chmod +x "${SCRIPT}"

CRON_LINE="0 3 * * * ${SCRIPT} >> ${LOG} 2>&1"

# Remove any existing branv-backup line, then re-add.
( crontab -l 2>/dev/null | grep -v "${SCRIPT}" ; echo "${CRON_LINE}" ) | crontab -

echo "Installed cron:"
crontab -l | grep "${SCRIPT}"
echo
echo "Logs will go to ${LOG}"
echo "Run a manual test now: ${SCRIPT}"
