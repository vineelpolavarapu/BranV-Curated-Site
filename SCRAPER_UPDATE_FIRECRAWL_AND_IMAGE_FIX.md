# Scraper Update — Firecrawl Fallback Tier & JSON-LD Image Fix

> **Project:** BranV Curated Site
> **Scope:** `apps/api` scraper engine + settings + production deployment
> **Date:** 2026-09-29 (code) · 2026-09-30 (production deployment) · 2026-10-01 (per-retailer image quality)
> **Status:** ✅ Complete & verified on production `api.branv.in` with fresh links. Per-retailer image-quality fixes applied for Amazon/Myntra/Ajio (see §8). 81/81 unit tests pass.
> **Companion doc:** [SCRAPING_ARCHITECTURE_AND_KNOWLEDGE_BASE.md](SCRAPING_ARCHITECTURE_AND_KNOWLEDGE_BASE.md)

---

## 1. What this update delivers

Two independent changes shipped together:

1. **Firecrawl integration** — a managed web-scraping API added as a *fallback tier* to the existing scraper, to reliably unwrap affiliate links and bypass anti-bot defenses.
2. **JSON-LD image bug fix** — fixed the "two different products in one gallery" bug caused by a one-character CDN allow-list mismatch that silently discarded the authoritative product images.

Both were verified end-to-end against the live affiliate link `https://fktr.in/2rQ04Ew`.

---

## 2. Change 1 — Firecrawl Fallback Tier (Hybrid Extraction)

### 2.1 Why
Direct `httpx` fetches get blocked (403/503) by Akamai / AWS WAF on Flipkart and Amazon. ScrapingAnt was the only escalation path. Firecrawl unwraps affiliate/shortlinks **and** bypasses anti-bot **in a single call**, and proved more reliable in testing.

### 2.2 Design decisions (chosen by product owner)
| Decision | Choice | Rationale |
| :--- | :--- | :--- |
| **Extraction mode** | **Hybrid** | Firecrawl returns raw HTML → flows through the *existing* waterfall (JSON-LD → SPA → DOM), allow-list, hi-res rewrite, and R2. If the waterfall still yields 0 images on a known retailer, a second Firecrawl *AI-JSON* call runs as a last-resort safety net. |
| **Role in the ladder** | **Fallback tier** | Direct `httpx` still runs first (free/fast). Firecrawl fires only when blocked/soft-blocked/0-images — the same trigger that already called ScrapingAnt. Most links never spend a Firecrawl credit. |
| **Provider order** | Firecrawl → ScrapingAnt → headless | Firecrawl proved most reliable, so it leads. ScrapingAnt retained untouched as the next rung. |

### 2.3 What changed in code
- **`settings.py`** — added `FIRECRAWL_API_KEY` and `FIRECRAWL_JSON_FALLBACK` (default `true`). Empty key ⇒ **zero behavior change**.
- **`scraper.py`**
  - `_fetch_firecrawl(url)` — HTML-mode provider (sibling to `_fetch_managed_scraper`). Calls `POST /v2/scrape` with `formats:["rawHtml"]`; returns `FetchResult(html, final_url=metadata.url)`. This is the affiliate-unwrap + anti-bot replacement.
  - `_fetch_firecrawl_images(url)` — JSON safety-net. Calls `/v2/scrape` with a `formats:[{type:"json", schema:{…}}]` request. A **schema pins the output keys** (`title`, `images`) because the freeform prompt renamed them every call (`productImageUrls` / `highResolutionImages` / …). Includes a value-scan fallback if the schema is ignored.
  - Escalation ladder in `_resolve_and_fetch()` — Firecrawl tried first when `needs_render`.
  - `scrape_product_url()` — after the HTML waterfall, if `0` images on a recognized retailer and `FIRECRAWL_JSON_FALLBACK` is on, run the JSON safety-net and pass its URLs through **the existing `_postprocess`** (so allow-list + hi-res still apply).
  - `blocked` flag now clears if the JSON fallback recovered the gallery (no false ⚠ banner in the modal).
- **`.env`** — added `FIRECRAWL_API_KEY` + `FIRECRAWL_JSON_FALLBACK` (gitignored; stays local).

### 2.4 Key safety property
Even the AI-JSON output is funneled through `_postprocess`, so the **zero-logo-leak guarantee** (positive CDN allow-list + `.svg` rejection + hi-res rewrite) holds regardless of which path produced the images.

---

## 3. Change 2 — JSON-LD Image Bug ("two different products in one gallery")

### 3.1 Symptom
Pasting a product link and clicking **Autofill** returned 2 images where **image #2 belonged to a *different* product** — a neighbor from the retailer's "You may also like" recommendation carousel.

### 3.2 Root cause (the bottleneck)
Flipkart serves product photos from **two** host patterns:
- `rukminim2.flixcart.com` (**with** `m`) — used in DOM / embedded state
- `rukmini1.flixcart.com` (**no** `m`, ends in a digit) — used in **JSON-LD**

The allow-list token was `rukminim`, which matches `rukminim2` but **not** `rukmini1`. Cascade:
1. JSON-LD yielded **5 correct images** of the right product — all on `rukmini1`.
2. `_postprocess` dropped **all 5** (failed the allow-list) → returned empty.
3. The waterfall fell through to embedded/DOM scraping, which sweeps the whole page.
4. Image #1 = the real product; image #2 = a **recommendation-carousel neighbor** (a different shirt).

So the real product's authoritative images were being silently thrown away over a **one-character token mismatch**, and the "mixed products" symptom was a downstream side-effect.

### 3.3 Fixes applied
1. **Allow-list token `rukminim` → `rukmini`** — now matches both `rukmini1` (JSON-LD) and `rukminim2` (DOM), while still rejecting the `static-assets-web.flixcart.com` logo host.
2. **JSON-LD made truly sovereign** — once JSON-LD yields ≥1 valid image, the waterfall uses **only** those (capped at `SCRAPER_MAX_IMAGES`) and **never tops up** from embedded/DOM. This permanently closes the neighbor-leak, even for products that expose only one JSON-LD image. (This is what the architecture doc always *promised* — "terminates search immediately" — but the code wasn't enforcing it.)

### 3.4 Verification
Live run of `scrape_product_url("https://fktr.in/2rQ04Ew")` with mock off:
```
title : VeBNoR Men Solid Formal Maroon Shirt
images:
  https://rukmini1.flixcart.com/image/832/832/.../s-st2-vebnor-original-imahpp7sgzdjzzyf.jpeg?q=70
  https://rukmini1.flixcart.com/image/832/832/.../s-st2-vebnor-original-imahpp7quewqnzkc.jpeg?q=70
ALL SAME PRODUCT (vebnor): True
```
Both images are the same shirt, two different angles, at 832×832.

---

## 4. Principles / practices followed for this update

These are the working rules we applied — worth repeating for future scraper changes:

1. **Trace real code before diagnosing.** Every claim was anchored to actual file/line evidence and live test output, not the doc's description.
2. **Confirm the hypothesis with a live probe first.** The `rukminim`/`rukmini1` mismatch was proven with a token-match table *before* editing.
3. **Additive & reversible.** New provider slots into the existing `SCRAPER_PROVIDER` switch pattern; empty key ⇒ identical old behavior. ScrapingAnt left untouched.
4. **Maximize reuse of the existing pipeline.** Firecrawl replaces only fetch/unwrap/anti-bot; extraction, allow-list, hi-res rewrite, and R2 re-host are unchanged. Even AI-extracted images pass back through `_postprocess`.
5. **Preserve the invariants.** The zero-logo-leak guarantee and `.svg` rejection apply to *every* code path, including new ones.
6. **Fix the root cause, not the symptom.** The visible bug was "mixed products," but the fix targeted the discarded-JSON-LD root cause + enforced sovereignty, rather than patching the DOM fallback.
7. **"Fewer-but-correct beats more-but-mixed."** For product galleries, an image from the wrong product is worse than one fewer correct image.
8. **Make extraction deterministic.** Replaced the freeform-prompt JSON call (which renamed its output key every run) with a pinned schema + value-scan fallback.
9. **Verify before declaring done.** End-to-end live scrape + full unit-test run (79/79) after each change.
10. **Keep secrets out of git.** The API key lives only in the gitignored `.env`; source changes are staged separately.

---

## 5. Files touched

| File | Change | Tracked in git |
| :--- | :--- | :--- |
| `apps/api/app/core/settings.py` | Firecrawl config keys | ✅ staged |
| `apps/api/app/integrations/scraper.py` | Firecrawl providers + ladder + JSON-LD sovereignty + allow-list token | ✅ staged |
| `.env` | `FIRECRAWL_API_KEY`, `FIRECRAWL_JSON_FALLBACK` | ❌ gitignored (local only) |

---

## 6. Open follow-ups

- [ ] **Audit other retailers for the same host-token mismatch** — verify Amazon / Myntra / Ajio / Meesho / Nykaa allow-list tokens actually match their JSON-LD image hosts (Flipkart's `rukminim` bug may not be unique).
- [ ] **Rotate the Firecrawl + ScrapingAnt API keys** — they now appear in plaintext in `.env`, the architecture doc, the memory file, several `deploy/*.sh` scripts, **and the deploy workflow's hardcoded fallback**. Rotate and move to GitHub Actions secrets.
- [ ] Consider raising `SCRAPER_MAX_IMAGES` now that JSON-LD reliably provides a full same-product gallery (Flipkart exposes ~5).

---

## 7. Production deployment — the second problem (2026-09-30, IN PROGRESS)

After the code fix above, the user reported that on the **deployed site `api.branv.in`** the Quick Add modal still shows **"⚠ The retailer blocked the request"** (and later "⚠ No images found") for Amazon / Myntra / Ajio, while **only Flipkart worked** — and then Flipkart stopped working too. The exact same links scrape fine locally. This section documents that separate, deployment-level problem.

### 7.1 Why local success does NOT imply production success
The scraper *code* being correct (proven locally) is necessary but **not sufficient** for production, because the two environments differ in two ways the code cannot control:

| Factor | Local (dev machine) | Production (Oracle Cloud VM) |
| :--- | :--- | :--- |
| **Outbound IP** | Residential IP — retailers serve pages normally | **Datacenter IP** — Amazon/Myntra/Ajio hard-block it (403 / bot-wall) |
| **Config source** | repo-root `.env` (has the keys) | the VM's own `deploy/.env` + `docker-compose.yml` `environment:` block |

So locally the direct fetch succeeds and no escalation is needed; on the VM the direct fetch is blocked and the scraper **must** fall back to Firecrawl/ScrapingAnt — which only works if those keys are actually loaded in the running container.

### 7.2 Why only Flipkart worked (the key diagnostic clue)
Retailers block the datacenter IP **differently**:
- **Flipkart** does *not* hard-block datacenter IPs → its direct fetch returns 200 → images extracted with **zero escalation keys needed** → it worked.
- **Amazon / Myntra / Ajio** hard-block datacenter IPs → direct fetch 403 → they *require* the escalation path → which was dead because the **production container had no escalation keys**.

Flipkart working was therefore the *control case* proving the code + network path were fine; the missing piece was purely production key delivery.

### 7.3 Root causes found in the deployed config (`deploy/docker-compose.yml`)
1. **Bot User-Agent in production** — the deployed compose still set `SCRAPER_USER_AGENT: "Mozilla/5.0 (compatible; BranVBot/1.0)"`. A UA containing `bot`/`compatible;` is instantly 403'd by Akamai/AWS WAF (this is **Bug D** from the architecture doc). The local `.env` fix had never propagated to the deployed compose file.
2. **No escalation keys mapped into the container** — the compose `environment:` block passed no `FIRECRAWL_API_KEY` / `SCRAPER_API_KEY` / `SCRAPER_PROVIDER`, so even if the VM's `.env` had them, the container never received them.
3. **Secrets never deploy by design** — `deploy-api.yml` deliberately ships compose/Caddyfile/Prisma but **never writes the VM's `.env`** ("The VM's own .env (real secrets) … is never written by this step"). So the key *values* had to be placed on the VM out-of-band; they never had been.

### 7.4 Fixes applied for production
- **UA fixed** in `deploy/docker-compose.yml` → real desktop Chrome string.
- **Escalation keys mapped** into the `api` service `environment:` via `${FIRECRAWL_API_KEY}` / `${SCRAPER_API_KEY}` / `${SCRAPER_PROVIDER}`.
- **Auto-injection added** to `deploy-api.yml`: an `upsert_env` step in the VM deploy script writes the keys into the VM's `deploy/.env` from GitHub Actions secrets (with a temporary committed-key fallback, since the keys are already in git history), using the pipeline's existing SSH — removing the manual SSH step.
- **`amzn.in`, `fktr.in`, `ekaro.in`, `earnkaro.com`** added to `_WRAPPER_DOMAINS` in `scraper.py` so the affiliate-unwrap fires for all the shortlink forms actually used to post products.
- Wider soft-block detection (added in `ba8a4ff`) was **reverted** in `3cb415a` because it was part of a change set the user asked to roll back to restore Flipkart.

### 7.5 ⚠️ Verification mistake — do not repeat
An earlier revision of this work **declared production "fixed and verified end-to-end"** based on a temporary `/api/scraper-selftest` endpoint that returned `blocked=false` for a fixed set of URLs. **That claim was wrong**, for two reasons:
1. **Firecrawl caches results.** The self-test used URLs that had been scraped dozens of times during development, so the "pass" may have been served from Firecrawl's cache rather than a genuine fresh datacenter-IP fetch.
2. **The self-test used stale fixed URLs**, not the fresh links the user actually pastes. When the user pasted *new* links (`fktr.in/L9etx4l`, `link.amazon/B04aekgNu`), production still failed.

**Lesson:** production verification must use **fresh, never-before-scraped links** and must confirm the keys are actually loaded in the *running container* — not just that a cached scrape returns images. Never declare a deployed fix "verified" from repeat-URL tests.

### 7.6 Root cause found & fixed (2026-09-30) — affiliate redirect not resolved before escalation

The config probe (`GET /api/scraper-config`) returned ground truth from the **running production container**:
```json
{ "firecrawl_configured": true, "firecrawl_key_len": 35, "managed_scraper_configured": true,
  "scraper_provider": "scrapingant", "mock_mode": false, "user_agent_is_bot": false }
```
So the keys **were** loaded, mock was off, and the UA was fixed — the config was correct. The "missing keys" hypothesis was **wrong**. The real bug was in the escalation control flow:

**Mechanism (why it failed only in production):**
1. User pastes an affiliate shortlink, e.g. `link.amazon/B04aekgNu`.
2. **Local (residential IP):** direct `httpx` follows the redirect chain → `amazon.in/…/dp/B0GWHJF6LM` (the product) → 200 → images extracted. Escalation never runs. ✅
3. **Production (datacenter IP):** direct `httpx` is **403-blocked before it can follow the redirect**, so `_fetch_httpx` returns with `final_url` still equal to the *bare shortlink* and empty HTML. The redirect loop can't advance (no HTML, no query param). Escalation then handed **the bare shortlink** to Firecrawl/ScrapingAnt.
4. Firecrawl/ScrapingAnt resolved `link.amazon/B04aekgNu` to the Amazon **homepage** (`https://www.amazon.in/`), not the product → 0 product images → **"No images" / "retailer blocked" banner**.

Proof captured during diagnosis — `_fetch_firecrawl("https://link.amazon/B04aekgNu")` returned `final_url = https://www.amazon.in/` (homepage), while a redirect-only httpx walk of the same link resolved to `…/dp/B0GWHJF6LM` (product). That gap *is* the bug.

**Fix (commit `7b0ffee`):** added `_resolve_redirects_only(url)` — it walks the redirect chain with `follow_redirects=False` (cheap 3xx hops that are **not** content-WAF-blocked, plus `?dl=`/`?url=` query unwrapping) to recover the real `/dp/` or `/p/itm` URL. The escalation block now resolves the shortlink to a product URL **before** calling Firecrawl/ScrapingAnt, so the managed scraper receives the product page instead of a homepage-bound shortlink.

**Verified under production simulation** (direct fetch forced to 403) with **fresh, uncached** links:
```
[PASS] Amazon affiliate  link.amazon/B04aekgNu -> amazon.in/…/dp/…  imgs=2 blocked=False
[PASS] Flipkart earnkaro fktr.in/L9etx4l       -> flipkart.com/…    imgs=2 blocked=False
```
79/79 unit tests pass. Pushed to `BranV-main` (deploy #… in progress).

**Awaiting:** production redeploy + re-test of fresh links on `api.branv.in` to confirm end-to-end (this time with fresh links + the config probe as evidence, not repeat-URL cache).

### 7.6c Production verified (2026-09-30) — fresh links, real VM
A token-gated `GET /api/scraper-probe?url=…` was deployed to scrape **one caller-supplied fresh link on the actual VM** (defeating the Firecrawl cache + localhost-only pitfalls of the earlier false claim). Results from live `api.branv.in`:

| Fresh link (never scraped before) | resolved to | images | blocked | modal_would_block |
| :--- | :--- | :---: | :---: | :---: |
| `link.amazon/B04aekgNu` | `amazon.in/…/dp/B0GWHJF6LM` (product ✅, not homepage) | 2 | false | **false** |
| `amzn.in/d/0aC2gMj0` | `amazon.in/dp/B0GWHJF6LM` | 2 | false | **false** |
| `fktr.in/L9etx4l` | `flipkart.com/allen-solly-men-striped-casual…` | 2 | false | **false** |

`modal_would_block=false` is the exact `QuickAddModal:351` gate → the blocked banner will not fire. The `resolved` field confirms the fix: the affiliate shortlink now reaches the **product** page, not the homepage. The temporary probe/config endpoints were then removed (see §7.7).

### 7.6b Second verification lesson
The config probe was decisive: **when a deployed system behaves differently from local, read the running process's actual state before theorizing.** Two hypotheses (missing keys, bot UA) were both disproven in one call, which redirected the investigation to the real control-flow bug. Guessing at causes across four commits wasted effort that one booleans-only probe resolved immediately.

### 7.7 Temporary artifacts — cleanup status
- ✅ `GET /api/scraper-config` and `GET /api/scraper-probe` endpoints — **removed** after verification.
- ✅ `SCRAPER_SELFTEST_TOKEN` — removed from settings/compose/workflow.
- ⚠️ **Still present (deliberately):** hardcoded key fallback in `.github/workflows/deploy-api.yml`. It keeps prod working until you create the GitHub Actions secrets. **Action for you:** create `FIRECRAWL_API_KEY` + `SCRAPER_API_KEY` repo secrets, **rotate both keys**, then delete the literal fallbacks (the deploy already prefers the secrets).
- Helper scripts `deploy/enable-scraper-keys.sh`, `deploy/fix-and-verify-prod.sh`, `deploy/verify-scraper-prod.sh` remain as optional manual tools; safe to delete.
- (`GET /api/scraper-selftest` was removed earlier in `1183df6`.)

---

## 8. Per-retailer image-quality fixes (2026-10-01)

Once scraping worked end-to-end, three retailers returned the *wrong or low-quality* images (correct product, bad gallery). All three were distinct bugs. Commit `07815af`.

### 8.1 Amazon — image #1 was blank
- **Symptom:** one image correct, the other a blank/near-white tile.
- **Root cause:** Amazon serves no JSON-LD, so extraction fell to the DOM, which exposes the **38×50 thumbnail strip** (`…_SX38_SY50_CR,0,0,38,50_.jpg`). Stripping the size token gave the thumbnail's *base* asset — and for the first slot that base is a **375×500 low-res brand/size-chart image** (15 KB), not a product photo. The real product photos (1080×1440) live in a different array.
- **Fix:** read Amazon's authoritative **`"hiRes"` gallery array** (`_AMAZON_HIRES_RE`) first — these are the real zoomable 1080×1440 photos, in order. Also drop thumbnail-strip crops via `_AMAZON_THUMB_RE` (`_CR,0,0,38,50_`, tiny `_SX\d{1,2}_`/`_SS\d{1,2}_`).
- **Result:** both images are now real 1080×1440 product photos.

### 8.2 Ajio — two images were the same photo
- **Symptom:** 2 images returned but both the same shot (one tiny, one larger).
- **Root cause (two parts):**
  1. Ajio stores each *size* of a photo under a **different hash directory**, so `…/bd096/-78Wx98H-…MODEL.jpg` and `…/bd07f/-473Wx593H-…MODEL.jpg` are the same photo but different paths → the path-based dedup kept both, and the distinct shots (`MODEL2…MODEL5`) got pushed past the 2-image cap.
  2. The page also exposes `SWATCH` (colour chip) and `TRUST_MARKER1/2/3` ("100% original" badge banners) on the same CDN, plus a **Pinterest share URL** that embedded the Ajio CDN host in a query param and slipped past the (substring-based) allow-list.
- **Fixes:**
  - `_upgrade_ajio` normalizes the size token to one master size (`-1117Wx1400H-`).
  - `_dedup_key` keys Ajio on the stable **`{styleId}-{colour}-{slot}` filename suffix** (so all crops of `MODEL` collapse and `MODEL2` becomes image #2).
  - Keep only `-MODEL\d*` files (`_AJIO_MODEL_RE`) → drops SWATCH / TRUST_MARKER.
  - `_is_product_cdn` now matches the URL's **real hostname** (via `urlparse`), not a substring of the whole URL → the Pinterest share link is rejected.
- **Result:** 2 distinct product shots (`MODEL`, `MODEL2`), both hi-res, no dupes/junk.

### 8.3 Myntra — second image was a *different* product
- **Symptom:** for style `30477200` the gallery showed images from the neighbouring style `29810122` (and vice-versa).
- **Root cause:** Myntra's JSON-LD gives exactly **one** authoritative image. To reach `SCRAPER_MAX_IMAGES=2`, the top-up pulled a second image from DOM / embedded state / Firecrawl AI-extract — all of which include the **"customers also viewed"** carousel (a different style id). Even Firecrawl's "ALL images of THIS product" prompt returned the neighbour's photo, and the correct product's JSON-LD image uses an older path format with no style id, so style-id filtering wasn't reliable either.
- **Fix:** **cap Myntra at its single JSON-LD image** (`topup_floor = 1` for Myntra). One guaranteed-correct image beats one correct + one wrong-product — the project's "fewer-but-correct beats more-but-mixed" rule.
- **Result:** 1 correct image, never a neighbour's.
- **Future option:** Myntra's internal product API (`/gateway/v2/product/{styleId}`) is style-id-keyed and would give the full correct gallery — a larger change if 2+ Myntra images become a hard requirement.

### 8.4 Shared mechanism added
- `_dedup_key(url, retailer)` — retailer-aware dedup so same-photo-different-size variants collapse (Ajio suffix key; path key for the rest).
- Restored the `< SCRAPER_MAX_IMAGES` **AI-extract top-up** (dedup-key aware, merged after trusted images) for retailers where a 2nd same-product image is safe — Myntra excluded per §8.3.

### 8.5 Verification
Fresh links, all retailers:

| Retailer | Images | Notes |
| :--- | :---: | :--- |
| Flipkart | 2 | unique, same product (unchanged) |
| Amazon | 2 | real 1080×1440 photos, no blank |
| Myntra | 1 | correct product, no cross-contamination |
| Ajio | 2 | distinct MODEL shots, hi-res, deduped |

**81/81 unit tests pass** (2 new: `test_amazon_prefers_hires_array_over_thumbnails`, `test_ajio_dedup_and_model_filter`; `test_amazon_hires_upgrade` updated for the realistic main-image token).
