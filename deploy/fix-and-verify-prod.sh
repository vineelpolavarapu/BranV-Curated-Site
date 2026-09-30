#!/usr/bin/env bash
# ONE-SHOT production fix + proof. Run ON THE OCI VM from the deploy folder.
#
#   cd <OCI_DEPLOY_PATH>            # e.g. /opt/branv
#   ADMIN_EMAIL='you@branv.in' ADMIN_PASSWORD='****' bash deploy/fix-and-verify-prod.sh
#
# Step 1: ensure the scraper escalation keys exist in the VM's deploy/.env
#         (docker-compose.yml references them via ${...}; without them the
#          datacenter IP stays 403-blocked and QuickAddModal shows the banner).
# Step 2: restart the api container so it picks up the keys.
# Step 3: log into the LIVE api and scrape each retailer link, asserting
#         images>0 AND debug.blocked=false (the exact QuickAddModal:351 gate).
set -u
cd "$(dirname "$0")/.."   # repo/deploy-root
API="${API_BASE:-https://api.branv.in/api}"
: "${ADMIN_EMAIL:?set ADMIN_EMAIL}"
: "${ADMIN_PASSWORD:?set ADMIN_PASSWORD}"

echo "── Step 1: ensure escalation keys in deploy/.env ──"
touch deploy/.env 2>/dev/null || touch .env
ENVF="deploy/.env"; [ -f "$ENVF" ] || ENVF=".env"
add() { grep -q "^$1=" "$ENVF" && echo "  $1 present" || { echo "$1=$2" >> "$ENVF"; echo "  $1 added"; }; }
add FIRECRAWL_API_KEY   "fc-0ec1b554d8cc41b681e4ed4b9ed43972"
add FIRECRAWL_JSON_FALLBACK "true"
add SCRAPER_PROVIDER    "scrapingant"
add SCRAPER_API_KEY     "03b53f374ac34d8f910090e7418ae9eb"

echo "── Step 2: restart api ──"
docker compose up -d api
echo "  waiting 15s for health..."; sleep 15

echo "── Step 3: verify against LIVE $API ──"
JAR="$(mktemp)"
lc=$(curl -s -o /tmp/l.json -w "%{http_code}" -c "$JAR" -X POST "$API/auth/admin/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
[ "$lc" = "200" ] || { echo "  ✗ login failed HTTP $lc: $(cat /tmp/l.json)"; exit 1; }
echo "  ✓ logged in"

LINKS=(
  "Amazon-affiliate|https://link.amazon/B09lgPKwW"
  "Amazon-direct|https://amzn.in/d/0aC2gMj0"
  "Flipkart-earnkaro|https://fktr.in/2rQ04Ew"
  # Add your real EarnKaro Myntra/Ajio links:
  # "Myntra-earnkaro|https://ekaro.in/..."
  # "Ajio-earnkaro|https://ekaro.in/..."
)
pass=0; total=0
for e in "${LINKS[@]}"; do
  tag="${e%%|*}"; url="${e#*|}"; total=$((total+1))
  b=$(curl -s -b "$JAR" -X POST "$API/admin/products/scrape-url" \
    -H "Content-Type: application/json" -d "{\"url\":\"$url\"}")
  read -r imgs blocked <<<"$(python3 -c "
import json
d=json.loads('''$b''')
print(len(d.get('images') or []), str(d.get('debug',{}).get('blocked')).lower())
" 2>/dev/null || echo "0 err")"
  if [ "${imgs:-0}" -gt 0 ] 2>/dev/null && [ "$blocked" = "false" ]; then
    echo "  [PASS] $tag imgs=$imgs blocked=$blocked"; pass=$((pass+1))
  else
    echo "  [FAIL] $tag imgs=$imgs blocked=$blocked raw=$b"
  fi
done
rm -f "$JAR"
echo ""; echo "RESULT: $pass/$total passed"
[ "$pass" = "$total" ] && echo "✓ PRODUCTION FIXED" || echo "✗ still failing — paste output"
