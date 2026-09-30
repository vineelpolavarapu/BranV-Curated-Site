#!/usr/bin/env bash
# Run this ONCE on the OCI VM, from the deploy folder (OCI_DEPLOY_PATH, e.g. /opt/branv).
# It adds the scraper escalation keys that docker-compose.yml references via ${...}.
# These keys let the datacenter-IP server recover from retailer 403s. Idempotent.
set -e
cd "$(dirname "$0")"
touch .env
add_key() {  # add_key NAME VALUE  (skips if NAME already present)
  local name="$1" val="$2"
  if grep -q "^${name}=" .env; then
    echo "  ${name} already set — leaving as-is"
  else
    echo "${name}=${val}" >> .env
    echo "  ${name} added"
  fi
}
echo "Adding scraper keys to $(pwd)/.env:"
add_key FIRECRAWL_API_KEY   "fc-0ec1b554d8cc41b681e4ed4b9ed43972"
add_key FIRECRAWL_JSON_FALLBACK "true"
add_key SCRAPER_PROVIDER    "scrapingant"
add_key SCRAPER_API_KEY     "03b53f374ac34d8f910090e7418ae9eb"
echo "Restarting API with new config..."
docker compose up -d api
echo "Done. Check: docker compose logs api --tail 20"
