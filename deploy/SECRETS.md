# Required secrets & variables

Everything the CI/CD pipelines (`.github/workflows/ci.yml` and
`.github/workflows/deploy-api.yml`) need configured in **GitHub → repo →
Settings → Secrets and variables → Actions**. All of these must be
**Repository** secrets/variables (not Environment-scoped) — none of these
jobs declare an `environment:`, so environment secrets would silently
resolve to empty strings.

## Secrets tab

| Name | Used by | Value |
|---|---|---|
| `OCI_SSH_HOST` | deploy-api.yml | Oracle VM public IP (see `DEPLOYMENT_PROGRESS.md` Quick Facts) |
| `OCI_SSH_USER` | deploy-api.yml | SSH username, `ubuntu` |
| `OCI_SSH_KEY` | deploy-api.yml | Full contents of the VM's SSH **private** key |
| `VERCEL_TOKEN` | ci.yml (`deploy-web`) | Vercel API token |
| `VERCEL_ORG_ID` | ci.yml (`deploy-web`) | Vercel org/team ID |
| `VERCEL_PROJECT_ID` | ci.yml (`deploy-web`) | Vercel project ID |
| `NEXT_PUBLIC_API_BASE_URL` | ci.yml (both jobs) | `https://api.branv.in/api` — must include the `/api` suffix |
| `NEXT_PUBLIC_SITE_URL` | ci.yml (`deploy-web`) | `https://www.branv.in` |
| `NEXT_PUBLIC_SITE_NAME` | ci.yml (`deploy-web`) | Display name, e.g. `BranV` |

## Variables tab (plain text, not sensitive)

| Name | Used by | Value |
|---|---|---|
| `OCI_DEPLOY_PATH` | deploy-api.yml | Absolute path to the deploy folder on the VM (confirm the real path via SSH — `docker-compose.yml`'s deploy folder should already live here). Required — the pipeline now fails loudly if this is unset rather than silently falling back to the wrong path. |

## On the VM itself (never in GitHub, never in git)

`$OCI_DEPLOY_PATH/.env` — copied once from `deploy/.env.production.example` and filled in by hand over SSH. Required keys: `API_HOSTNAME`, `ACME_EMAIL`, `DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`, `WEB_ORIGIN`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BACKUP_BUCKET`. Optional (blank is fine at first launch): `CUELINKS_API_KEY`, `AMAZON_ASSOCIATES_TAG`/`AMAZON_ACCESS_KEY`/`AMAZON_SECRET_KEY`, `EARNKARO_API_KEY`, `MAIL_API_KEY`/`MAIL_FROM`. Full list and generation commands: `DEPLOYMENT_PROGRESS.md` Step 12.

This file — not the inline YAML comments — is the source of truth for what needs configuring on a fresh clone or handoff. `DEPLOYMENT.md` and `DEPLOYMENT_PROGRESS.md` link here instead of repeating the list.
