#!/usr/bin/env bash
# Verify the DEPLOYED scraper works for every retailer/link type used to post products.
# Run from anywhere with network access to api.branv.in AFTER:
#   1) deploy/enable-scraper-keys.sh has set the keys on the VM
#   2) the new docker-compose.yml is deployed and the api container restarted
#
# Usage:
#   ADMIN_EMAIL='you@branv.in' ADMIN_PASSWORD='****' bash deploy/verify-scraper-prod.sh
#
# It logs in as admin, calls the real /api/admin/products/scrape-url for each link,
# and asserts images>0 AND debug.blocked=false (the exact condition QuickAddModal
# uses at line 351 to decide whether to show the "retailer blocked" banner).

set -u
API="${API_BASE:-https://api.branv.in/api}"
: "${ADMIN_EMAIL:?set ADMIN_EMAIL}"
: "${ADMIN_PASSWORD:?set ADMIN_PASSWORD}"
JAR="$(mktemp)"

echo "→ Logging in to $API as $ADMIN_EMAIL"
login_code=$(curl -s -o /tmp/login.json -w "%{http_code}" -c "$JAR" \
  -X POST "$API/auth/admin/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
if [ "$login_code" != "200" ]; then
  echo "✗ Login failed (HTTP $login_code): $(cat /tmp/login.json)"; exit 1
fi
echo "✓ Logged in"

# retailer|url  — the exact link forms used to post products
LINKS=(
  "Amazon-affiliate|https://link.amazon/B09lgPKwW"
  "Amazon-direct|https://amzn.in/d/0aC2gMj0"
  "Flipkart-earnkaro|https://fktr.in/2rQ04Ew"
)
# Add your real EarnKaro Myntra/Ajio links here when you have them, e.g.:
#   "Myntra-earnkaro|https://ekaro.in/enkr..."
#   "Ajio-earnkaro|https://ekaro.in/enkr..."

pass=0; total=0
for entry in "${LINKS[@]}"; do
  tag="${entry%%|*}"; url="${entry#*|}"; total=$((total+1))
  body=$(curl -s -b "$JAR" -X POST "$API/admin/products/scrape-url" \
    -H "Content-Type: application/json" -d "{\"url\":\"$url\"}")
  # parse with python for reliability
  read -r imgs blocked title < <(python3 -c "
import sys,json
try:
    d=json.loads('''$body''')
    print(len(d.get('images') or []), str(d.get('debug',{}).get('blocked')).lower(), (d.get('title') or '')[:30])
except Exception as e:
    print('0 error parse')
")
  if [ "$imgs" -gt 0 ] 2>/dev/null && [ "$blocked" = "false" ]; then
    echo "  [PASS] $tag  imgs=$imgs blocked=$blocked  title='$title'"; pass=$((pass+1))
  else
    echo "  [FAIL] $tag  imgs=$imgs blocked=$blocked  raw=$body"
  fi
done

rm -f "$JAR"
echo ""
echo "RESULT: $pass/$total passed"
[ "$pass" = "$total" ]
