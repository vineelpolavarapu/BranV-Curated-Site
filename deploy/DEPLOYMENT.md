# BranV Deployment Guide

End-to-end runbook for migrating BranV from Railway to **Vercel (web) + Oracle Cloud Free VM (API + Postgres)** behind **Cloudflare**.

**Target cost:** $0/month recurring (domain renewal excluded).

Each step has a **What** (goal), **How** (exact commands / clicks), and **Verify** (proof it worked). Do them in order — every later step assumes earlier ones succeeded.

---

## Architecture

```
                      Cloudflare DNS (free)
                              |
          +-------------------+--------------------+
          |                                        |
   www.<domain>                              api.<domain>
   (DNS-only, grey)                          (Proxied, orange)
          |                                        |
   Vercel (free)                       Oracle Cloud Free VM
   Next.js 15 app                      (ARM Ampere, arm64)
   apps/web                            Ubuntu 22.04 LTS
                                       |
                                       Docker Compose:
                                         - Caddy   (TLS, :80/:443)
                                         - API     (NestJS, :4000 internal)
                                         - Postgres 16 (:5432 internal)
                                         - backup  (nightly pg_dump -> R2)
```

---

## Prerequisites (one-time)

Accounts needed: **GitHub**, **Cloudflare**, **Oracle Cloud**, **Vercel**, **Resend** (or similar mail provider). A domain you own.

---

## STEP 1 — Finalize the repo locally

**What:** Refresh the lockfile after removing `ioredis` + `bullmq`, generate the Prisma migration for `ClickIntent`, commit, push.

**How** (from `c:\vineel\BranV`):

```powershell
# Reinstall to drop ioredis + bullmq from the lockfile
pnpm install

# Create the migration. Needs your local Postgres running (the Docker one is fine).
pnpm --filter @branv/api db:migrate
# When prompted for a name, type: remove_redis_add_click_intent

# Sanity check the API still builds
pnpm --filter @branv/api typecheck
pnpm --filter @branv/api build

# Commit & push to GitHub
git add -A
git commit -m "chore: remove Redis, add ClickIntent table, add deploy/ artifacts"
git push origin BranV-main
```

**Verify:** `apps/api/prisma/migrations/<timestamp>_remove_redis_add_click_intent/migration.sql` exists; `git status` is clean; GitHub shows the new commit.

---

## STEP 2 — Point your domain at Cloudflare

**What:** Move DNS to Cloudflare so you get free DNS, TLS, and DDoS in front of both the VM and Vercel.

**How:**

1. Log in to **dash.cloudflare.com** → **Add a site** → enter your domain → **Free** plan.
2. Cloudflare shows you 2 nameservers (e.g., `bob.ns.cloudflare.com`).
3. Log in to your domain registrar → set those 2 nameservers as the authoritative NS.
4. Back in Cloudflare → wait for the green "Active" badge (usually < 1 hour, can be 24).
5. While waiting, in Cloudflare → **SSL/TLS → Overview** → set mode to **Full (strict)**.

**Verify:** `nslookup -type=NS yourdomain.com` returns the Cloudflare nameservers.

---

## STEP 3 — Create the Oracle Cloud Always Free VM

**What:** Provision the Ubuntu ARM VM that will run API + Postgres + Caddy.

**How:**

1. Log in to **cloud.oracle.com**. Pick a home region with capacity (Mumbai/Hyderabad usually have ARM stock for India).
2. **Menu → Compute → Instances → Create instance.**
3. **Name:** `branv-prod`.
4. **Image & shape:** click **Edit** → **Change shape** → tab **Ampere** → pick **VM.Standard.A1.Flex** → **2 OCPU, 12 GB RAM**. Image: **Canonical Ubuntu 22.04**.
5. **Networking:** create a new VCN (defaults are fine). Public IPv4: **Assign a public IPv4 address**.
6. **SSH keys:** select **Generate a key pair for me** → **Download both** (private + public). Save the private key somewhere safe (e.g., `C:\Users\Lenovo\.ssh\branv-prod.key`).
7. **Create.** Wait ~2 min for state = Running.
8. Copy the **Public IP address** from the instance page — you need it in the next steps.

**Verify:** From your laptop, you can SSH in:

```powershell
# Fix permissions on the key (Windows SSH refuses world-readable keys)
icacls C:\Users\Lenovo\.ssh\branv-prod.key /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i C:\Users\Lenovo\.ssh\branv-prod.key ubuntu@<VM_PUBLIC_IP>
```

You should land in an Ubuntu shell.

---

## STEP 4 — Open the VM's firewall

**What:** Oracle blocks everything except port 22 by default. You need 80 + 443 open both at the cloud level and at the OS level (Oracle Ubuntu images have stricter iptables than typical Ubuntu).

**How — at the cloud level:**

1. In the Oracle console → your instance → **Subnet** link → **Default security list** → **Add Ingress Rules**.
2. Add two rules, both with **Source CIDR `0.0.0.0/0`**, **Protocol TCP**:
   - Destination port **80**
   - Destination port **443**

**How — at the OS level** (on the VM via SSH):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

**Verify:** From your laptop, `curl -v http://<VM_PUBLIC_IP>` should connect (it will return "connection refused" until Caddy starts — that's fine — but it must not time out).

---

## STEP 5 — Install Docker on the VM

**What:** The compose stack needs Docker Engine + the compose plugin.

**How** (SSH'd into the VM):

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
exit   # log out so the new group membership takes effect
```

Re-SSH back in.

**Verify:**

```bash
docker --version          # Docker version 24.x
docker compose version    # Docker Compose version v2.x
docker ps                 # should not error (empty list is fine)
```

---

## STEP 6 — Clone the repo onto the VM

**What:** Pull the code so the compose `build` can run.

**How** (on the VM):

```bash
sudo mkdir -p /opt/branv
sudo chown ubuntu:ubuntu /opt/branv
cd /opt/branv
git clone https://github.com/<your-user>/<your-repo>.git repo
cd repo/deploy
```

If your repo is private, use a GitHub deploy key or a Personal Access Token in the clone URL (`https://<token>@github.com/...`).

**Verify:** `ls /opt/branv/repo/deploy` lists `docker-compose.yml`, `Caddyfile`, `.env.production.example`.

---

## STEP 7 — Fill in production secrets

**What:** Create `deploy/.env` with real values.

**How** (on the VM):

```bash
cd /opt/branv/repo/deploy
cp .env.production.example .env

# Generate strong secrets — copy each output line into the .env
echo "DB_PASSWORD=$(openssl rand -hex 32)"
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"

nano .env
```

Fill in (at minimum) the values above, plus:

- `API_HOSTNAME=api.yourdomain.com`
- `ACME_EMAIL=you@yourdomain.com`
- `COOKIE_DOMAIN=.yourdomain.com` (leading dot covers subdomains)
- `WEB_ORIGIN=https://www.yourdomain.com`
- **Cloudflare R2** — Create 2 R2 buckets in Cloudflare → R2 (`branv-uploads`, `branv-pg-backups`). Create an R2 API token with read/write on both. Paste keys + your R2 account ID.
- **Cuelinks / Amazon / EarnKaro** — leave blank if you don't have them yet; the affiliate worker stays in mock mode until you fill them.
- **Resend** — sign up at resend.com (free), verify your domain, paste API key, set `MAIL_FROM=hello@yourdomain.com`.

Save and exit nano (Ctrl+O, Enter, Ctrl+X).

**Verify:** `cat .env | grep -v '^#' | grep '='` shows every line has a value after the `=`.

---

## STEP 8 — Point DNS at the VM

**What:** Create the `api.yourdomain.com` DNS record so Caddy can get a TLS cert.

**How:**

1. In Cloudflare → **DNS → Records → Add record**:
   - Type: **A**
   - Name: **api**
   - IPv4 address: `<VM_PUBLIC_IP>`
   - Proxy status: **DNS only** (grey cloud) — *critical for the first TLS issuance*
   - Save.

You'll switch to Proxied/orange after Caddy gets its cert in Step 10.

**Verify:** From your laptop:

```powershell
nslookup api.yourdomain.com
```

Should resolve to the VM's IP within a few minutes.

---

## STEP 9 — Start the stack

**What:** Build the API image and bring everything up.

**How** (on the VM):

```bash
cd /opt/branv/repo/deploy
docker compose up -d --build
```

First build takes 5–10 min on the Ampere ARM VM (pnpm install + nest build + prisma generate). Subsequent builds are faster thanks to layer caching.

Watch the logs:

```bash
docker compose logs -f api
```

You should see Prisma run `migrate deploy` and then NestJS start on port 4000.

**Verify:**

```bash
# From the VM
curl -i http://localhost:4000/health   # 200 OK
docker compose exec postgres psql -U branv -d branv -c '\dt'   # lists tables incl. click_intents

# From your laptop (still grey cloud, so direct hit)
curl -i https://api.yourdomain.com/health
```

The Caddy log (`docker compose logs caddy`) should show a successful Let's Encrypt cert issuance.

---

## STEP 10 — Switch DNS to Proxied

**What:** Now that Caddy has its origin cert, flip Cloudflare to Proxied to get the CDN, DDoS, and WAF.

**How:**

1. Cloudflare → **DNS → Records** → the `api` A record → click the grey cloud → it turns **orange (Proxied)**.
2. Cloudflare → **SSL/TLS → Overview** → confirm mode is **Full (strict)**.

**Verify:**

```powershell
curl -I https://api.yourdomain.com/health
```

Response headers now include `Server: cloudflare` and `CF-RAY: ...`. Body is still `{"status":"ok",...}`.

---

## STEP 11 — Seed the admin account

**What:** Create your first admin user so you can log into `/admin` from the web app once it's deployed.

**How** (on the VM):

```bash
cd /opt/branv/repo/deploy
docker compose exec -e ADMIN_EMAIL=you@yourdomain.com -e ADMIN_PASSWORD='<strong-password>' api node dist/scripts/seed-admin.js
```

If that path isn't compiled into the image, fall back to running the TS source:

```bash
docker compose exec api sh -c "cd /api && ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD='<strong-password>' pnpm seed:admin"
```

**Verify:**

```bash
docker compose exec postgres psql -U branv -d branv -c "select email, role from users;"
```

Lists your admin row.

---

## STEP 12 — Deploy the web app on Vercel

**What:** Hook the GitHub repo into Vercel so every push to `BranV-main` redeploys the storefront.

**How:**

1. **vercel.com/new** → Import the GitHub repo.
2. **Root Directory:** `apps/web` (click Edit → pick the folder).
3. **Framework Preset:** Next.js (auto-detected).
4. Leave Build/Install commands as the defaults — your `apps/web/vercel.json` already overrides them for the monorepo.
5. **Environment Variables** → add:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://api.yourdomain.com/api`
   - `NEXT_PUBLIC_SITE_NAME` = `BranV`
6. Click **Deploy**. Wait ~3 min.
7. Once green, **Settings → Domains** → add `www.yourdomain.com` and the apex `yourdomain.com`. Vercel will show DNS records to create.

**How (DNS records for web in Cloudflare):**

- Type **CNAME**, Name **www**, Target **`cname.vercel-dns.com`**, Proxy status **DNS only** (grey).
- Type **A**, Name **@** (apex), IPv4 **`76.76.21.21`**, Proxy status **DNS only** (grey).

Vercel's TLS handshake doesn't tolerate Cloudflare's proxy on these records — keep them grey. You still get Vercel's CDN.

**Verify:** Visit `https://www.yourdomain.com` → home page loads, product images render, "Buy now" redirects to the affiliate URL.

---

## STEP 13 — End-to-end smoke test

Run through these in a browser / shell:

1. **Health:** `https://api.yourdomain.com/health` returns 200.
2. **Catalog:** `https://www.yourdomain.com` shows products.
3. **Admin login:** `https://www.yourdomain.com/admin/login` → log in with the seeded admin → you reach the dashboard.
4. **Affiliate redirect:** click a product's **Buy now** → 302 to retailer. Then on the VM:

   ```bash
   docker compose exec postgres psql -U branv -d branv -c "select count(*) from click_events; select count(*) from click_intents;"
   ```

   `click_events` ≥ 1, `click_intents` is small (consumed rows are deleted).
5. **TLS:** SSL Labs scan `api.yourdomain.com` → grade A or better.
6. **Backup:** `docker compose logs backup` shows `uploaded; sleeping 24h` within 30 s of stack start. Check the R2 console for `branv-<timestamp>.sql.gz`.

If any of these fail, fix before continuing. Don't move to Step 14 until all 6 are green.

---

## STEP 14 — Add a Cloudflare WAF rate-limit rule

**What:** Defence-in-depth in front of `/auth/*` since the in-app rate limiter is now per-process (no shared store).

**How:** Cloudflare → **Security → WAF → Rate limiting rules → Create rule**:

- Name: `auth-throttle`
- If incoming requests match: **URI Path** `contains` `/auth/`
- When rate exceeds **5 requests** per **1 minute** per **IP address**
- Then: **Block** for **1 minute**.

**Verify:** Hit `https://api.yourdomain.com/auth/login` 10 times in a row from one IP — Cloudflare blocks the 6th onwards.

---

## STEP 15 — Decommission Railway

**What:** Stop paying for Railway and remove the unused config from the repo.

**How:**

1. Log in to Railway → your project → **Settings → Danger → Delete project**.
2. On your laptop:

   ```powershell
   git rm railway.toml
   git commit -m "chore: remove Railway config after migration to Oracle Cloud"
   git push
   ```

**Verify:** Railway dashboard no longer lists the project. Web + API still serve traffic after the push.

---

## STEP 16 — Keep-alive so Oracle doesn't reclaim the VM

**What:** Oracle reclaims Always-Free VMs that look idle. A 5-minute uptime ping prevents that.

**How:**

1. Sign up at **uptimerobot.com** (free).
2. **Add New Monitor → HTTP(s)** → URL `https://api.yourdomain.com/health` → interval **5 minutes** → save.

**Verify:** After 10 min, UptimeRobot dashboard shows 2 green checks.

---

## Ongoing operations cheat sheet

| Task | Command (on the VM) |
|---|---|
| Deploy a new commit | `cd /opt/branv/repo && git pull && cd deploy && docker compose up -d --build` |
| Tail API logs | `docker compose logs -f api` |
| Run a Prisma migration manually | `docker compose exec api prisma migrate deploy` |
| Restart only the API | `docker compose restart api` |
| Shell into the DB | `docker compose exec postgres psql -U branv -d branv` |
| Manual backup now | `docker compose exec backup sh -c 'TS=$(date -u +%Y%m%dT%H%M%SZ); pg_dump | gzip > /tmp/manual-$TS.sql.gz && aws --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com s3 cp /tmp/manual-$TS.sql.gz s3://$R2_BUCKET/'` |
| Restore from backup | Download the `.sql.gz` from R2 → `gunzip -c file.sql.gz \| docker compose exec -T postgres psql -U branv -d branv` |

---

## Troubleshooting

**Build fails on the VM with "out of memory":**
The Ampere VM has 12 GB by default, but if you picked 1 OCPU / 6 GB Node can run out during `nest build`. Resize the instance in the Oracle console to 2 OCPU / 12 GB (still free).

**Caddy can't get a cert ("acme: error 400"):**
The `api` DNS record must be **grey-cloud (DNS only)** during initial issuance. If you flipped it to Proxied too early, flip back, then `docker compose restart caddy`, watch logs.

**API container restart loops with "Prisma client did not initialize":**
Run `docker compose exec api prisma generate` once, then `docker compose restart api`. Happens if the build skipped client generation.

**`502 Bad Gateway` from Cloudflare:**
Caddy is up but the API container is down. `docker compose ps` — bring back any exited containers with `docker compose up -d`. Check API logs for the crash reason.

**Wishlist / wardrobe / 2FA / member features look broken:**
Member auth is wired but those flows weren't part of the catalog+affiliate MVP scope. They'll function once the seed data and email-sending are configured. Not blockers for launch.

---

**Total monthly cost: $0** (domain renewal ~$10/yr at Cloudflare Registrar).
