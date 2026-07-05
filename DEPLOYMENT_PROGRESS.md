# BranV Deployment — Full Progress Log + Continuation Guide

> **This file is your handoff document.** It records everything done so far in plain English, then gives you the remaining steps to finish the deployment. You can resume from any new chat session using this file as context.

---

## Quick Facts Sheet (memorize these)

| Thing | Value |
|---|---|
| **Project** | BranV — curated affiliate site (`branv.in`) |
| **Frontend** | Next.js, deployed on Vercel (free tier) |
| **Backend** | FastAPI (Python 3.12), deployed on Oracle Cloud VM |
| **Database** | Postgres 16, running in Docker on the same VM |
| **Reverse proxy** | Caddy, running in Docker on the VM (handles HTTPS) |
| **DNS / CDN** | Cloudflare (free tier) in front of everything |
| **Object storage** | Cloudflare R2 (free tier — 10 GB) for product images + backups |
| **Domain** | `branv.in` (registered at GoDaddy) |
| **Oracle VM IP** | `68.233.118.28` |
| **Oracle VM shape** | VM.Standard.E2.1.Micro (AMD x86, 1 GB RAM, Always Free) |
| **Oracle VM region** | India South (Hyderabad), AD-1 |
| **SSH key (private)** | `C:\Users\Lenovo\.ssh\branv-prod.key` |
| **SSH user** | `ubuntu` |
| **GitHub username** | `vineelpolavarapu` |
| **Repo** | `https://github.com/vineelpolavarapu/BranV-Curated-Site` |
| **Container image** | `ghcr.io/vineelpolavarapu/branv-api:latest` |
| **Image visibility** | Private |
| **Target monthly cost** | $0 |

---

## Architecture (final picture)

```
                          Cloudflare DNS + CDN (free)
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
       www.branv.in                                    api.branv.in
       (DNS-only, grey)                                (Proxied, orange)
              │                                             │
        Vercel (free)                              Oracle Cloud Free VM
        Next.js 15 app                             AMD x86, 1 GB RAM
                                                          │
                                                          ▼
                                                  Docker Compose:
                                                  ┌────────────────┐
                                                  │ Caddy (TLS)    │ :80, :443
                                                  ├────────────────┤
                                                  │ FastAPI app    │ :5000 internal
                                                  ├────────────────┤
                                                  │ Postgres 16    │ :5432 internal
                                                  ├────────────────┤
                                                  │ migrate (once) │ Prisma migrate deploy
                                                  └────────────────┘
                                                          │
                                                          ▼
                                                   Cloudflare R2
                                                   (uploads + backups)
```

---

# PART 1 — What's been done (in order)

Every section says: **What** (we did), **Why** (the use case), **How** (the key actions).

---

## Phase 1 — Code changes on the laptop

**What:** Removed Redis from the NestJS code, added a new database table called `ClickIntent`, fixed a TypeScript config error, then committed and pushed to GitHub.

**Why:** Redis is a separate caching service that costs money to host. By using Postgres (which we already need) and small in-memory caches inside the app, we avoid running a second service on our tiny 1 GB VM.

**How:**
- Replaced Redis usage in 5 places: clicks tracking, settings cache, scrape cache, rate limiter, health check.
- Created a new Prisma migration named `remove_redis_add_click_intent`.
- Deleted the Redis module folder.
- Removed `ioredis` and `bullmq` from `package.json`.
- Fixed `apps/api/tsconfig.json` (TypeScript 5.9 didn't accept the old `ignoreDeprecations` value).
- Committed and pushed.

> ⚠️ **Important note:** Later we discovered the user had migrated from NestJS to **FastAPI (Python)** as the actual deployed backend. So all this Redis-removal work in NestJS is harmless but unused. The FastAPI code already had no Redis. We deploy FastAPI from here on.

---

## Phase 2 — Cloudflare onboarding

**What:** Pointed the domain `branv.in` at Cloudflare so Cloudflare manages DNS and provides free TLS, CDN, and DDoS protection.

**Why:** Without Cloudflare we'd need to pay for DNS hosting and SSL certificates separately. Cloudflare bundles all of this for free and sits between visitors and our servers.

**How:**
1. Created a free Cloudflare account at `dash.cloudflare.com`.
2. Clicked **Add a site**, entered `branv.in`, picked **Free plan**.
3. Cloudflare scanned existing DNS records — found 0 (the domain was brand new).
4. Cloudflare gave 2 nameservers (e.g., `bob.ns.cloudflare.com` and `lisa.ns.cloudflare.com`).
5. Logged into **GoDaddy** → My Products → `branv.in` → Nameservers → set custom nameservers → pasted both Cloudflare names → saved.
6. Waited ~15 min — Cloudflare status flipped from 🟡 Pending → 🟢 Active.
7. In Cloudflare: **SSL/TLS → Overview** → set mode to **Full (strict)**.

**Verify:** `nslookup -type=NS branv.in 8.8.8.8` returned the Cloudflare nameservers.

---

## Phase 3 — Map the frontend to the domain (Vercel)

**What:** Connected `www.branv.in` and `branv.in` to the existing Vercel deployment of the Next.js frontend.

**Why:** The frontend was already on Vercel but only accessible via the random `*.vercel.app` URL. Visitors want to type `www.branv.in`.

**How:**
1. Vercel dashboard → BranV project → **Settings → Domains**.
2. Added `branv.in` → Vercel offered redirect to `www.branv.in` → accepted → both domains added.
3. Vercel showed 2 DNS records needed.
4. In Cloudflare DNS:
   - **A record:** Name `@`, IPv4 `76.76.21.21`, Proxy status **DNS only (grey cloud)**.
   - **CNAME record:** Name `www`, target `cname.vercel-dns.com`, Proxy status **DNS only (grey cloud)**.
   - **Critical:** Grey cloud (not orange). Vercel needs to handle TLS itself; Cloudflare's orange proxy interferes with Vercel's certificate.
5. Vercel auto-issued Let's Encrypt certificates for both domains within 5 min.

**Verify:** `https://www.branv.in` loads in the browser, shows the hero carousel. (API calls inside the page fail because the backend isn't live yet — expected.)

---

## Phase 4 — Created the Oracle Cloud VM (with detour)

**What:** Got a free Linux server in the cloud where the backend will live.

**Why:** Vercel hosts the frontend but cannot run our Python API + Postgres database. We need an actual computer for that. Oracle Cloud Free Tier gives one for $0/month.

**How:**

1. Signed up at `cloud.oracle.com` → Free Trial → home region **India South (Hyderabad)**.

2. **First attempt — ARM (didn't work):**
   - Tried to create a `VM.Standard.A1.Flex` instance (ARM Ampere, 12 GB RAM target).
   - Got error: **"Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-1."**
   - **Why:** Oracle gave away too many free ARM VMs; capacity is rarely available.

3. **Pivoted to AMD:**
   - Used **VM.Standard.E2.1.Micro** instead (AMD x86, 1 GB RAM).
   - Almost always available. Trade-off: only 1 GB RAM, so we have to be careful about memory.

4. **Instance settings:**
   - Name: `branv-prod` (Oracle later named it `branv-vcn` based on the VCN — harmless cosmetic mismatch)
   - Image: Canonical Ubuntu 22.04
   - Shape: VM.Standard.E2.1.Micro (Always Free Eligible)
   - Public IPv4: assigned automatically → `68.233.118.28`
   - SSH keys: clicked **Generate a key pair for me** → downloaded both files.

5. **Saved SSH keys** to `C:\Users\Lenovo\.ssh\`:
   - `branv-prod.key` — private key (the secret)
   - `branv-prod.key.pub` — public key
   - Hit a snag: both files initially had `.pub` extension; renamed correctly based on file size (private = 1679 bytes, public = 399 bytes).

---

## Phase 5 — Networking fix (Internet Gateway)

**What:** Connected the VM's network to the public internet.

**Why:** Even though the VM had a public IP, it couldn't be reached from outside because the underlying Virtual Cloud Network (VCN) had no "front door" — no Internet Gateway. Without that, no traffic enters or leaves.

**How:**

1. SSH attempts timed out. Diagnosed by:
   - Confirming the VM was 🟢 RUNNING in Oracle Console
   - Confirming `Test-NetConnection github.com -Port 22` from the laptop succeeded (so user's network is fine)
   - Checking the Security List ingress rules — port 22 was correctly open
   - **Found the cause:** VCN had no Internet Gateway listed.

2. **Created the Internet Gateway:**
   - Oracle Console → **Networking → Virtual Cloud Networks → branv-vcn → Internet Gateways → Create Internet Gateway**.
   - Name: `branv-igw`.

3. **Added the default route:**
   - Same VCN → **Route Tables → Default Route Table → Add Route Rules**.
   - Target Type: **Internet Gateway**
   - Destination CIDR: `0.0.0.0/0`
   - Target: `branv-igw`

4. **Re-tested SSH — succeeded.** Landed at `ubuntu@branv-vcn:~$`.

**Verify:** `ssh -i C:\Users\Lenovo\.ssh\branv-prod.key ubuntu@68.233.118.28` lands at the Ubuntu shell.

---

## Phase 6 — VM provisioning (firewall + Docker + swap)

**What:** Prepared the VM to run our containerized backend.

**Why:** The bare VM has no Docker, no web ports open, and not enough RAM to handle traffic spikes. We need to fix all three before deploying anything.

**How:**

1. **Opened ports 80 + 443 in Oracle Security List:**
   - Oracle Console → Compute → branv-prod → Subnet → Default Security List → Add Ingress Rules.
   - Added 2 rules: Source `0.0.0.0/0`, Protocol TCP, Destination Port 80 and 443.

2. **Opened the same ports in the VM's iptables (Oracle Ubuntu has strict firewall):**
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

3. **Installed Docker:**
   ```bash
   sudo apt-get update -y
   sudo apt-get install -y docker.io git awscli
   ```
   - **Hit error:** `docker-compose-plugin` package not in Ubuntu 22.04 repos.
   - **Fix:** Installed Docker Compose v2 as a standalone binary:
     ```bash
     sudo mkdir -p /usr/local/lib/docker/cli-plugins
     sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
       -o /usr/local/lib/docker/cli-plugins/docker-compose
     sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
     ```

4. **Enabled Docker + added user to docker group:**
   ```bash
   sudo systemctl enable --now docker
   sudo usermod -aG docker ubuntu
   ```

5. **Created 2 GB swapfile (critical for 1 GB RAM):**
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

6. **Logged out and back in** so docker-group membership took effect.

**Verify:** `docker ps` worked without "permission denied" — empty container list returned.

---

## Phase 7 — Discovered the FastAPI migration

**What:** Realized the backend code we were deploying is FastAPI (Python), not NestJS (TypeScript).

**Why:** When we tried to build the Docker image, it ran a Python build, not Node. The `apps/api/Dockerfile` had been updated to build the Python FastAPI port. The user confirmed they had completed the NestJS → FastAPI migration.

**How:** Switched our deployment plan:
- **Image:** `ghcr.io/vineelpolavarapu/branv-api:latest` (Python image, ~300 MB)
- **Port:** 5000 (FastAPI uvicorn default), not 4000 (NestJS default)
- **Env vars:** FastAPI-shaped (SCHEDULER_OWNER, PY_LOG_LEVEL — no NODE_ENV)
- **Migrations:** Prisma still owns the schema. FastAPI's SQLAlchemy models are read-only auto-generated from the Prisma schema. So we need a one-shot Node container to run `prisma migrate deploy` before FastAPI starts.
- **Updated `deploy/docker-compose.yml`** to reflect all of the above.
- **Updated `deploy/Caddyfile`** to reverse-proxy to `api:5000`.

---

## Phase 8 — Built the API image on the laptop

**What:** Compiled the FastAPI code into a Docker container image on the laptop, then uploaded it to GitHub Container Registry (GHCR).

**Why:** The 1 GB VM cannot build the image (it would run out of memory). Building on the laptop (which has plenty of RAM) and shipping just the finished container is the standard pattern for tight VMs.

**How:**

1. **Created a GitHub Personal Access Token (PAT):**
   - Went to `https://github.com/settings/tokens/new` (classic tokens).
   - Name: `branv-ghcr-push`, expiration: No expiration.
   - Scopes ticked: `write:packages`, `read:packages`, `delete:packages`.
   - Copied the token (starts with `ghp_`).

2. **Logged Docker into GHCR on the laptop:**
   ```powershell
   echo ghp_xxxxxxxx | docker login ghcr.io -u vineelpolavarapu --password-stdin
   ```
   Got `Login Succeeded`.

3. **Built the image (build context = `apps/api`, NOT the repo root):**
   ```powershell
   cd c:\vineel\BranV
   docker build -t ghcr.io/vineelpolavarapu/branv-api:latest apps/api
   ```
   - First attempt with `.` as context failed because the Python Dockerfile expects `pyproject.toml` at the context root.
   - With `apps/api` as context, build succeeded in ~5 min.

4. **Pushed to GHCR:**
   ```powershell
   docker push ghcr.io/vineelpolavarapu/branv-api:latest
   ```
   - Failed once with `use of closed network connection` (Docker Desktop proxy hiccup).
   - Retried — succeeded. Image visible at `https://github.com/vineelpolavarapu?tab=packages`.
   - Package is **private** by GHCR default.

---

## Phase 9 — Prepared deploy/ folder + copied Prisma

**What:** Bundled everything the VM needs into a single `deploy/` folder.

**Why:** The VM does not need the entire codebase — only the compose file, Caddy config, environment template, and the Prisma migrations (so the one-shot migrate container can run them).

**How:**

1. Updated [deploy/docker-compose.yml](deploy/docker-compose.yml):
   - Pulls `ghcr.io/vineelpolavarapu/branv-api:latest` instead of building
   - Drops the in-container backup service (host cron handles that)
   - Tunes Postgres for low memory
   - Adds a one-shot `migrate` service that runs Prisma migrations before the API starts

2. Created [deploy/backup.sh](deploy/backup.sh) — runs nightly `pg_dump` and ships to R2 from the VM host (not in a container, to save memory).

3. Created [deploy/install-backup-cron.sh](deploy/install-backup-cron.sh) — one-time installer for the cron entry.

4. Copied the Prisma folder into deploy/:
   ```powershell
   Copy-Item -Recurse -Force prisma deploy\prisma
   ```
   - **Note:** `prisma/` lives at the repo **root**, not under `apps/api/`. The FastAPI migration moved it.
   - `deploy/prisma/` now contains `schema.prisma` and `migrations/`.

---

## Phase 10 — Shipped deploy/ to the VM

**What:** Sent the deploy folder from laptop to VM and moved it to its final home.

**Why:** The VM needs the compose file and Caddy config locally. We use `scp` (secure copy) over the same SSH connection.

**How:**

1. From PowerShell on the laptop:
   ```powershell
   scp -i C:\Users\Lenovo\.ssh\branv-prod.key -r deploy ubuntu@68.233.118.28:/tmp/branv-deploy
   ```

2. SSH in and move it to `/opt/branv`:
   ```bash
   ssh -i C:\Users\Lenovo\.ssh\branv-prod.key ubuntu@68.233.118.28
   sudo mv /tmp/branv-deploy /opt/branv
   sudo chown -R ubuntu:ubuntu /opt/branv
   cd /opt/branv
   ```

3. Copied the env template:
   ```bash
   cp .env.production.example .env
   ```

---

## Phase 11 — Cloudflare R2 buckets

**What:** Created two free object-storage buckets in Cloudflare R2 — one for product images, one for database backups. Created an API token to access them.

**Why:** Storing images on the VM disk is wasteful (the VM only has 50 GB) and dangerous (if VM dies, images die). R2 gives 10 GB free with zero data-egress fees.

**How:**

1. Cloudflare → **R2 Object Storage** → subscribed to R2 (free tier, $0 — but requires a card on file for safety).

2. Created bucket: `branv-uploads` (location auto / APAC).

3. Created bucket: `branv-pg-backups` (same location).

4. Created API token:
   - R2 → Manage R2 API Tokens → Create API token
   - Name: `branv-prod`
   - Permissions: **Object Read & Write**
   - Specify buckets: both `branv-uploads` and `branv-pg-backups`
   - TTL: Forever

5. **Saved 4 values** (token shown only once):
   - **Access Key ID** → use as `S3_ACCESS_KEY` and `R2_ACCESS_KEY` in `.env`
   - **Secret Access Key** → use as `S3_SECRET_KEY` and `R2_SECRET_KEY`
   - **Endpoint URL** → like `https://<account-id>.r2.cloudflarestorage.com` → use as `S3_ENDPOINT`
   - **Account ID** → the random string before `.r2.cloudflarestorage.com` → use as `R2_ACCOUNT_ID`

6. Pasted R2 values into `/opt/branv/.env` on the VM (current state).

---

# PART 2 — What's left to do (continuation)

**Current state (2026-07-03):** Phases 1–11 complete AND Steps 12–14 of Part 2 complete. **⚠️ STUCK PARTWAY THROUGH STEP 15 — the FastAPI `api` container is in a restart loop.** All other services are healthy: `postgres` is Up and healthy, `migrate` exited 0 (migrations applied cleanly), and `caddy` is Up on 80/443. `.env` is fully populated, GHCR login is active on the VM, and the `api.branv.in` A record is live in Cloudflare as **grey cloud (DNS only)** — we have NOT yet flipped it to orange because Caddy cannot finish confirming its Let's Encrypt cert until the API is stable.

> **Fix already applied to `deploy/docker-compose.yml` during Step 15:** the `migrate` service originally used `node:20-alpine`, which crashed Prisma's schema engine with `Could not parse schema engine response: SyntaxError: Unexpected token 'E', "Error load"... is not valid JSON` because Alpine (musl) lacks the libssl variant Prisma's default binary needs. **Fix:** switched image to `node:20-bullseye-slim` and prepended `apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates &&` to the entrypoint. Migrations then applied. Keep this modified compose file — do not revert.

> **⚠️ Open issue — RESUME HERE:** the `api` container is crash-looping. Symptom: `docker compose exec api ...` returns `Container … is restarting, wait until the container is running`. Root cause is unknown because we never captured the crash logs. **First action in the next session:**
>
> ```bash
> cd /opt/branv
> docker compose ps
> docker compose logs api --tail 200
> ```
>
> Paste the traceback. Most likely culprits: (a) a missing/misnamed env var the FastAPI settings module requires (see `apps/api/app/core/settings.py`); (b) a `DATABASE_URL` mismatch (the API may expect a different var name than migrate uses); (c) an import-time failure in `app.main`. Fix, then re-run `docker compose up -d api` and confirm `docker compose ps` shows `api` as `Up` (not `Restarting`). Only after the API is stable and `curl -I https://api.branv.in/api/health` from the laptop returns 200 with a Caddy cert, proceed to Step 16.

---

## Step 12 — Finish filling `.env` on the VM ✅ DONE

**What:** Fill in the remaining environment variables in `/opt/branv/.env`.

**Why:** The app reads secrets and connection strings from this file. Empty values mean the app won't start (or will start but features will silently fail).

**How:**

1. SSH into the VM if not already in:
   ```powershell
   ssh -i C:\Users\Lenovo\.ssh\branv-prod.key ubuntu@68.233.118.28
   ```

2. Check which variables are still empty (safe — only shows names, not values):
   ```bash
   cd /opt/branv
   grep -v '^#' .env | grep '=' | awk -F= '{ if ($2 == "") print $1 " ❌ EMPTY"; else print $1 " ✅ filled" }'
   ```

3. **Required values (the app won't start without these):**

   | Variable | What to set |
   |---|---|
   | `API_HOSTNAME` | `api.branv.in` |
   | `ACME_EMAIL` | your real email — Let's Encrypt uses this for cert expiry alerts |
   | `DB_PASSWORD` | Generate with `openssl rand -hex 32` |
   | `JWT_ACCESS_SECRET` | Generate with `openssl rand -hex 64` |
   | `JWT_REFRESH_SECRET` | Generate with `openssl rand -hex 64` |
   | `COOKIE_DOMAIN` | `.branv.in` (with leading dot — covers all subdomains) |
   | `WEB_ORIGIN` | `https://www.branv.in` |
   | `S3_ENDPOINT` | `https://<your-account-id>.r2.cloudflarestorage.com` (from R2) |
   | `S3_REGION` | `auto` |
   | `S3_BUCKET` | `branv-uploads` |
   | `S3_ACCESS_KEY` | R2 token Access Key |
   | `S3_SECRET_KEY` | R2 token Secret |
   | `R2_ACCOUNT_ID` | the Account ID alone (no URL) |
   | `R2_ACCESS_KEY` | same as `S3_ACCESS_KEY` |
   | `R2_SECRET_KEY` | same as `S3_SECRET_KEY` |
   | `R2_BACKUP_BUCKET` | `branv-pg-backups` |

4. **Optional values (can stay blank for first launch):**

   - `CUELINKS_API_KEY` (affiliate URL converter — leave blank, app falls back to raw URLs)
   - `AMAZON_ASSOCIATES_TAG`, `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`
   - `EARNKARO_API_KEY`
   - `MAIL_API_KEY`, `MAIL_FROM` (email won't send — affects member signup/reset)

5. **Generate strong secrets and edit `.env`:**
   ```bash
   echo "DB_PASSWORD=$(openssl rand -hex 32)"
   echo "JWT_ACCESS_SECRET=$(openssl rand -hex 64)"
   echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
   nano .env
   ```
   In nano: `Ctrl+O`, Enter (save), `Ctrl+X` (exit).

**Verify:** Re-run the awk command. All required rows show ✅.

---

## Step 13 — Docker login on the VM ✅ DONE

**What:** Make the VM able to pull your private container image from GHCR.

**Why:** The image is private. Without authentication, `docker compose pull` would fail with `unauthorized`.

**How:**

1. On the VM:
   ```bash
   docker login ghcr.io -u vineelpolavarapu
   ```
2. When it asks for password, paste your **GitHub Personal Access Token** (the `ghp_xxx...` you generated in Phase 8). It will not show as you type — that's normal.
3. Expected: `Login Succeeded`.

**Note:** If you forgot the token, generate a new one at `https://github.com/settings/tokens/new` with `read:packages` scope (you don't need write on the VM, just read).

---

## Step 14 — Create the `api.branv.in` DNS record ✅ DONE

**What:** Add a DNS record pointing `api.branv.in` to your VM's IP.

**Why:** The Caddy reverse proxy on the VM listens for the hostname `api.branv.in`. Without this record, browsers can't find the API.

**Important:** Use **grey cloud (DNS only)** for the FIRST start. We need Caddy to get a Let's Encrypt certificate, which requires direct access to the VM. We'll flip to orange (Proxied) AFTER the cert is issued.

**How:**

1. Cloudflare → branv.in → **DNS → Records → + Add record**.
2. Fill in:
   - **Type:** A
   - **Name:** `api`
   - **IPv4 address:** `68.233.118.28`
   - **Proxy status:** **DNS only (grey cloud)** ← critical for first start
   - **TTL:** Auto
3. Save.

**Verify:** `nslookup api.branv.in` returns `68.233.118.28`.

---

## Step 15 — Pull the image + start the stack ⚠️ IN PROGRESS — API CRASH-LOOPING ⬅️ **RESUME HERE**

**What:** Launch all 4 containers: Postgres → migrate (runs once) → FastAPI → Caddy.

**Why:** This is the actual "go live" moment for the backend.

**How:**

1. On the VM:
   ```bash
   cd /opt/branv
   docker compose pull
   ```
   Pulls the API image from GHCR + Caddy + Postgres + Node images. ~30–60 sec.

2. Start everything in detached mode:
   ```bash
   docker compose up -d
   ```
   The order is automatic:
   - **postgres** starts first
   - **migrate** waits for Postgres to be healthy, runs `prisma migrate deploy`, then exits
   - **api** waits for migrate to finish, then starts FastAPI on port 5000
   - **caddy** waits for api to be up, starts on 80/443, and gets a Let's Encrypt cert

3. Watch the logs:
   ```bash
   docker compose logs -f
   ```
   You want to see (in order):
   - `database system is ready to accept connections`
   - `migrate-1` runs `prisma migrate deploy` and exits with code 0
   - `INFO: Uvicorn running on http://0.0.0.0:5000`
   - `caddy-1` certificate obtained for `api.branv.in`
   
   Press Ctrl+C to stop watching (containers keep running).

**Verify:**
```bash
docker compose ps                                 # all should be "Up" except migrate which is "Exited 0"
curl -i http://localhost:5000/api/health          # 200 OK
```

From your laptop:
```powershell
curl -I https://api.branv.in/api/health           # 200 OK, with Caddy's TLS cert
```

---

## Step 16 — Switch DNS to Proxied (orange cloud)

**What:** Turn on Cloudflare's proxy in front of `api.branv.in`.

**Why:** Now that Caddy has its certificate, we want all the Cloudflare benefits: CDN, DDoS protection, WAF, bot blocking.

**How:**
1. Cloudflare → DNS → Records → click the grey cloud next to the `api` record.
2. It turns **orange (Proxied)**.

**Verify:**
```powershell
curl -I https://api.branv.in/api/health
```
Response headers now include `Server: cloudflare` and `CF-RAY: ...`.

---

## Step 17 — Seed the admin account

**What:** Create the first admin user so you can log into `/admin` from the storefront.

**Why:** The database is empty — no users exist. We seed one admin via a one-off Node container.

**How:** *(exact command depends on what seed script the FastAPI port has; if FastAPI dropped the seed script, use Prisma Studio or psql to insert manually)*

```bash
# Option A — if there's a Python seed script:
docker compose exec api python -m app.scripts.seed_admin \
    --email you@branv.in --password 'YourStrongPassword123!'

# Option B — direct SQL via psql:
docker compose exec postgres psql -U branv -d branv -c \
  "INSERT INTO users (id, email, \"passwordHash\", role, status, \"createdAt\", \"updatedAt\") VALUES (
     'admin1', 'you@branv.in', '<argon2 hash>', 'ADMIN', 'ACTIVE', NOW(), NOW()
   );"
```

The argon2 password hash can be generated by running the API in a one-off mode or with a small Python snippet — confirm in the next session.

---

## Step 18 — Install the host-level backup cron

**What:** Schedule `pg_dump` → R2 to run every night at 3 AM UTC.

**Why:** If the VM disk dies or you delete the wrong row, you can restore from R2. Without backups, every mistake is permanent.

**How:**

```bash
cd /opt/branv
chmod +x backup.sh install-backup-cron.sh
./install-backup-cron.sh
```

This writes a crontab entry like:
```
0 3 * * * /opt/branv/backup.sh >> /var/log/branv-backup.log 2>&1
```

**Verify:** Test it manually right now:
```bash
./backup.sh
ls /var/log/branv-backup.log
```
And check Cloudflare R2 → `branv-pg-backups` bucket → should see `branv-<timestamp>.sql.gz`.

---

## Step 19 — End-to-end smoke test

Test all the critical user paths. Pass = ready for traffic.

| Test | How | Expected |
|---|---|---|
| Health | `curl https://api.branv.in/api/health` | 200 OK, JSON |
| Catalog | Open `https://www.branv.in` | Products render with images |
| Admin login | Open `https://www.branv.in/admin/login`, log in with seeded admin | Lands on dashboard, cookies set |
| Affiliate redirect | Click "Buy Now" on any product | Redirects to retailer (Amazon/Flipkart/etc.) |
| Click tracked | `docker compose exec postgres psql -U branv -d branv -c "select count(*) from click_events;"` | Count ≥ 1 |
| TLS grade | Run https://www.ssllabs.com/ssltest/ on `api.branv.in` | Grade A or better |

---

## Step 20 — Cloudflare WAF rate-limit on `/auth/*`

**What:** Add a rate-limit rule in front of login endpoints.

**Why:** The in-app rate limiter is per-process. Cloudflare adds a second layer that catches brute-force attempts before they hit your server.

**How:**

Cloudflare → **Security → WAF → Rate limiting rules → Create rule**:
- Name: `auth-throttle`
- If: URI Path contains `/auth/`
- When: rate exceeds 5 requests per 1 minute per IP
- Then: Block for 1 minute.

---

## Step 21 — UptimeRobot keep-alive

**What:** Ping your API every 5 minutes from outside.

**Why:** Oracle reclaims Always-Free VMs that look idle. A regular external ping prevents that. Bonus: you get alerts if the API ever goes down.

**How:**
1. Sign up at `uptimerobot.com` (free).
2. **Add New Monitor → HTTP(s)** → URL `https://api.branv.in/api/health` → interval 5 minutes.
3. Save.

---

## Step 22 — Decommission Railway

**What:** Turn off your old Railway project and clean the repo.

**Why:** Stop paying for Railway and remove unused config from the codebase.

**How:**
1. Railway dashboard → BranV project → **Settings → Delete project**.
2. On the laptop:
   ```powershell
   cd c:\vineel\BranV
   git rm railway.toml
   git commit -m "chore: remove Railway config after migration to Oracle Cloud"
   git push
   ```

---

# Glossary (in plain English)

| Word | What it means |
|---|---|
| **VM (Virtual Machine)** | A virtual computer in the cloud. Looks like a real Linux box, but it's actually a slice of a bigger physical server. |
| **VCN (Virtual Cloud Network)** | A private network for your Oracle VMs. Like a building with several offices (subnets). |
| **Internet Gateway** | The "front door" connecting your VCN to the public internet. Without it, the VM can't be reached from outside. |
| **Security List / Security Group** | Cloud-level firewall rules — what ports are open from where. |
| **iptables** | Operating-system-level firewall on the VM itself. Even if the cloud firewall allows traffic, iptables can block it. |
| **Swap** | Disk space used as fake-extra-RAM when real RAM runs out. Slower than RAM but prevents crashes. |
| **Docker** | A way to package an app + its dependencies into one "container" that runs identically everywhere. |
| **Container** | A running instance of a Docker image. Like a process, but isolated. |
| **Image** | The compiled, packaged software. Like a snapshot of an app ready to run. |
| **Docker Compose** | A way to define + start multiple containers together (e.g., API + database + reverse proxy). |
| **Registry** | A "storage" for Docker images on the internet. We use **GHCR** (GitHub Container Registry). |
| **GHCR** | GitHub Container Registry — free, attached to your GitHub account. |
| **PAT (Personal Access Token)** | A long password used by command-line tools instead of your GitHub password. |
| **Caddy** | A web server / reverse proxy that auto-fetches Let's Encrypt TLS certs. |
| **Reverse proxy** | A server that takes incoming HTTPS traffic and forwards it to your actual app, hiding it from the internet. |
| **Let's Encrypt** | A free certificate authority that issues TLS/SSL certificates automatically. |
| **TLS / SSL** | The "lock icon" in browsers. Encrypts data between user and server. |
| **DNS** | The phonebook of the internet — translates `branv.in` into an IP address. |
| **Cloudflare** | A free CDN + DNS + security service that sits between users and your servers. |
| **R2** | Cloudflare's S3-compatible object storage. 10 GB free. |
| **S3 / S3-compatible** | A standard for storing files in the cloud. R2 follows this standard, so any tool that talks to S3 works with R2. |
| **Prisma** | A database tool that manages schema and migrations. The Python app reads the schema; Prisma writes it. |
| **Migration** | A SQL script that updates the database schema (add a table, add a column, etc.) |
| **scp** | "Secure Copy" — uploads files over SSH. |
| **Grey cloud / Orange cloud** | Cloudflare DNS settings. Grey = DNS only (Cloudflare doesn't touch traffic). Orange = Proxied (Cloudflare CDN + protection). |

---

# Troubleshooting (common things that go wrong)

| Symptom | Cause / Fix |
|---|---|
| `docker compose up` exits "api unhealthy" | Check `docker compose logs api`. Most common: missing env var or wrong `DATABASE_URL`. |
| Caddy can't get cert | `api.branv.in` DNS record must be **grey cloud** during first issuance. Flip back, then `docker compose restart caddy`. |
| `migrate` container loops or fails | Check `docker compose logs migrate`. Verify `prisma/schema.prisma` is present in `deploy/prisma/`. |
| 502 Bad Gateway from Cloudflare | Caddy is up but API container is down. `docker compose ps`. Restart with `docker compose up -d`. |
| `unauthorized` on `docker compose pull` | GHCR PAT not added on VM. Re-run `docker login ghcr.io -u vineelpolavarapu`. |
| Out of memory / VM frozen | `free -h` to confirm swap is on. Postgres tuning is in compose. If still happens, reduce `shared_buffers` to 64MB. |
| Oracle reclaimed the VM | Set up UptimeRobot (Step 21). |
| `docker ps` "permission denied" | You skipped logout/login after `usermod -aG docker ubuntu`. Re-SSH. |

---

# Files of interest

| Path | What it is |
|---|---|
| [deploy/docker-compose.yml](docker-compose.yml) | All 4 services (Caddy, API, Postgres, migrate). |
| [deploy/Caddyfile](Caddyfile) | Caddy reverse-proxy config — TLS + headers. |
| [deploy/.env.production.example](.env.production.example) | Template for `.env`. Never commit `.env` itself. |
| [deploy/backup.sh](backup.sh) | Nightly pg_dump → R2 script. |
| [deploy/install-backup-cron.sh](install-backup-cron.sh) | Installs the cron entry on the VM. |
| [deploy/prisma/](prisma/) | Prisma schema + migrations. Mounted by the migrate container. |
| [deploy/DEPLOYMENT.md](DEPLOYMENT.md) | Original generic runbook (may be outdated for FastAPI; use this file as the source of truth). |
| [apps/api/Dockerfile](../apps/api/Dockerfile) | The Python image build instructions. |
| [apps/api/app/main.py](../apps/api/app/main.py) | FastAPI entry point. |
| [apps/api/app/core/settings.py](../apps/api/app/core/settings.py) | All env vars the API reads. |
| `C:\Users\Lenovo\.ssh\branv-prod.key` | Your SSH private key. **Never share.** |

---

# How to resume in a new chat

When you start a new chat, paste this into the first message:

> "I'm resuming the BranV deployment (currently in Phase 13 — Deployment per the README). Full context is in `deploy/DEPLOYMENT_PROGRESS.md`. Phases 1–11 of Part 1 AND Steps 12–14 of Part 2 are complete: VM provisioned on Oracle Cloud (68.233.118.28), FastAPI image in GHCR, `deploy/` folder on the VM at `/opt/branv`, R2 buckets and API token configured, `/opt/branv/.env` fully populated with production secrets, GHCR login active on the VM, `api.branv.in` A record live in Cloudflare as grey cloud (DNS only). **I'm stuck partway through Step 15 — the FastAPI `api` container is in a restart loop.** Current stack state on the VM: `postgres` Up (healthy), `migrate` Exited 0 (Prisma migrations applied cleanly after we edited `deploy/docker-compose.yml` to switch the migrate service from `node:20-alpine` to `node:20-bullseye-slim` and prepend `apt-get install openssl ca-certificates` in the entrypoint — keep that fix), `caddy` Up on 80/443, `api` restarting. We never captured the api crash logs. **First action:** SSH into the VM (`ssh -i C:\Users\Lenovo\.ssh\branv-prod.key ubuntu@68.233.118.28`), then run `cd /opt/branv && docker compose ps && docker compose logs api --tail 200` and paste the full output so we can diagnose. Likely causes: missing env var required by `apps/api/app/core/settings.py`, `DATABASE_URL` naming mismatch between what migrate sets and what FastAPI reads, or an import-time error in `app.main`. After the API is stable and `curl.exe -I https://api.branv.in/api/health` from the laptop returns HTTP 200 with a valid Caddy TLS cert, proceed to Step 16 (flip DNS to orange Proxied), then Steps 17–22 (seed admin, install backup cron, smoke test, WAF rate-limit, UptimeRobot, decommission Railway). Read the file end-to-end and pick up from Step 15."

The new assistant should read `DEPLOYMENT_PROGRESS.md` and continue without losing context.

---

**End of progress log. Save this file.** It's your single source of truth for everything done and everything left.
