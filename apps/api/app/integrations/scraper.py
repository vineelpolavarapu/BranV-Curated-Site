"""
Product-image scraping — site-agnostic by design.

The pipeline is: unwrap affiliate/redirect link -> fetch the real product page ->
extract images through a generic waterfall (JSON-LD -> embedded-state JSON ->
OpenGraph/meta -> DOM <img>/<srcset>) -> upgrade to hi-res -> dedup/filter.

Nothing in the core path *requires* a site to be recognized: it relies on standards
that virtually every modern product page emits. `detect_retailer` only unlocks
*optional* per-site boosts (a known embedded-state key, a hi-res URL rewriter). An
unknown site (a brand's own Shopify store, any marketplace) still scrapes via the
generic layers and reports `retailer="generic"`.

Returns canned data when USE_MOCK_INTEGRATIONS=true.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import httpx
from selectolax.parser import HTMLParser

from ..core.logging import get_logger
from ..core.settings import get_settings

log = get_logger("scraper")


@dataclass(slots=True)
class ScrapedProduct:
    title: str
    primaryImageUrl: str | None = None
    images: list[str] | None = None
    color: str | None = None
    sizes: list[str] | None = None
    material: str | None = None
    retailer: str | None = None
    resolvedUrl: str | None = None
    debug: dict = field(default_factory=dict)


# ───────────── retailer detection (optional boosts only) ────────────────────

_RETAILER_HOST_MAP = {
    "flipkart": "flipkart",
    "amazon": "amazon",
    "myntra": "myntra",
    "ajio": "ajio",
    "meesho": "meesho",
    "nykaafashion": "nykaa",
    "nykaa": "nykaa",
    "snitch": "snitch",
    "bewakoof": "bewakoof",
    "thesouledstore": "thesouledstore",
}


def detect_retailer(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    for needle, name in _RETAILER_HOST_MAP.items():
        if needle in host:
            return name
    return "unknown"


# ───────────── affiliate / redirect unwrapping (generic) ────────────────────

# Behavioural hints, NOT an allow-list. Brand labels (no dot) match a single host
# label exactly; full domains (with a dot) match the host or a subdomain of it.
# Matched precisely to avoid substring false-positives (e.g. "t.co" inside
# "flipkart.com"). Any hit, OR a redirect-shaped query, OR a non-recognized host
# with no product markup, triggers a full redirect-follow.
_WRAPPER_BRAND_LABELS = (
    "earnkaro", "cuelinks", "inrdeals", "wishlink", "linkredirect", "tinyurl",
)
_WRAPPER_DOMAINS = (
    "amzn.to", "fkrt.it", "myntr.it", "bit.ly", "cutt.ly", "t.co", "goo.gl",
    "rebrand.ly", "extp.in", "da.gd", "prf.hn", "go.skimresources.com", "clnk.in",
)
_REDIRECT_QUERY_KEYS = ("url", "dl", "u", "redirect", "deeplink", "murl", "ued", "link")


def _looks_like_wrapper(url: str) -> bool:
    p = urlparse(url)
    host = (p.hostname or "").lower()
    labels = host.split(".")
    if any(lbl in labels for lbl in _WRAPPER_BRAND_LABELS):
        return True
    if any(host == d or host.endswith("." + d) for d in _WRAPPER_DOMAINS):
        return True
    # A recognized retailer host is never a wrapper.
    if detect_retailer(url) != "unknown":
        return False
    # Redirect-shaped query (…?url=https://real-store/…) on an unknown host.
    q = p.query.lower()
    if any(f"{k}=http" in q for k in _REDIRECT_QUERY_KEYS):
        return True
    return False


_META_REFRESH_RE = re.compile(
    r'<meta[^>]+http-equiv=["\']?refresh["\']?[^>]+content=["\'][^"\']*url=([^"\'>]+)',
    re.IGNORECASE,
)
_JS_REDIRECT_RE = re.compile(
    r'(?:window\.location(?:\.href)?|location\.replace)\s*=?\s*\(?\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _extract_redirect_target(html: str, base_url: str) -> str | None:
    """Find a client-side redirect target (meta-refresh / JS) inside an interstitial."""
    m = _META_REFRESH_RE.search(html)
    if m:
        return urljoin(base_url, m.group(1).strip())
    m = _JS_REDIRECT_RE.search(html)
    if m:
        target = m.group(1).strip()
        if target.startswith(("http", "/")):
            return urljoin(base_url, target)
    return None


# ───────────── fetcher abstraction (hybrid, free tooling only) ──────────────


@dataclass(slots=True)
class FetchResult:
    html: str
    final_url: str
    status: int
    blocked: bool = False


def _browser_headers() -> dict[str, str]:
    s = get_settings()
    return {
        "User-Agent": s.SCRAPER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,"
        "image/webp,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Sec-Ch-Ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Upgrade-Insecure-Requests": "1",
    }


async def _fetch_httpx(url: str) -> FetchResult:
    s = get_settings()
    async with httpx.AsyncClient(
        timeout=s.SCRAPER_TIMEOUT, follow_redirects=True, headers=_browser_headers()
    ) as client:
        r = await client.get(url)
        blocked = r.status_code in (401, 403, 429, 503)
        return FetchResult(
            html=r.text if not blocked else "",
            final_url=str(r.url),
            status=r.status_code,
            blocked=blocked,
        )


async def _fetch_headless(url: str) -> FetchResult | None:
    """Free Playwright fallback — renders SPA pages / JS redirects. Returns None when
    Playwright isn't installed or the render fails, so callers degrade gracefully."""
    try:
        from playwright.async_api import async_playwright
    except Exception:
        log.info("headless_fetch_skipped_no_playwright")
        return None
    s = get_settings()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                page = await browser.new_page(user_agent=s.SCRAPER_USER_AGENT)
                await page.goto(url, wait_until="networkidle", timeout=s.SCRAPER_TIMEOUT * 1000)
                html = await page.content()
                final_url = page.url
            finally:
                await browser.close()
        return FetchResult(html=html, final_url=final_url, status=200)
    except Exception as e:
        log.warning("headless_fetch_failed", extra={"url": url, "error": str(e)})
        return None


async def _resolve_and_fetch(url: str) -> FetchResult:
    """Unwrap affiliate/redirect links, then return the fetched real product page.

    Follows HTTP redirects (httpx) plus client-side (meta-refresh / JS) interstitials,
    and escalates to the free headless fetcher when configured and the page still
    looks empty/blocked. Site-agnostic: stops when it lands on a real page, not when
    it matches a retailer list.
    """
    s = get_settings()
    current = url
    result = await _fetch_httpx(current)

    # Follow client-side redirect interstitials (affiliate networks often JS-bounce).
    hops = 0
    while hops < s.SCRAPER_MAX_REDIRECT_HOPS:
        target = _extract_redirect_target(result.html, result.final_url)
        if not target or target == result.final_url:
            break
        current = target
        result = await _fetch_httpx(current)
        hops += 1

    # Escalate to headless when the page is blocked/empty or still a wrapper.
    needs_render = result.blocked or not result.html or (
        _looks_like_wrapper(result.final_url) and not _has_product_markup(result.html)
    )
    if needs_render and s.SCRAPER_RENDER_JS:
        rendered = await _fetch_headless(current)
        if rendered and rendered.html:
            result = rendered

    return result


def _has_product_markup(html: str) -> bool:
    if not html:
        return False
    lowered = html[:200_000].lower()
    return (
        '"@type":"product"' in lowered.replace(" ", "")
        or 'og:type" content="product' in lowered
        or 'property="og:image"' in lowered
        or "application/ld+json" in lowered
    )


# ───────────── image extraction waterfall (site-agnostic) ───────────────────

_IMG_EXT_RE = re.compile(r"\.(?:jpe?g|png|webp|avif|gif)(?:$|[?#])", re.IGNORECASE)
_IMG_URL_IN_TEXT_RE = re.compile(
    r"https?://[^\s\"'\\<>]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s\"'\\<>]*)?", re.IGNORECASE
)
_JUNK_TOKENS = (
    "sprite", "icon", "logo", "placeholder", "loader", "loading", "blank",
    "pixel", "spinner", "1x1", "transparent", "grey.", "gray.",
)


def _looks_like_image_url(u: str) -> bool:
    if not u or u.startswith("data:"):
        return False
    if not u.startswith(("http://", "https://", "//")):
        return False
    lowered = u.lower()
    if any(tok in lowered for tok in _JUNK_TOKENS):
        return False
    return bool(_IMG_EXT_RE.search(lowered)) or "/image" in lowered or "img" in lowered


def _largest_from_srcset(srcset: str) -> str | None:
    best_url, best_w = None, -1
    for part in srcset.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        candidate = bits[0]
        width = 0
        if len(bits) > 1 and bits[1].endswith("w"):
            try:
                width = int(bits[1][:-1])
            except ValueError:
                width = 0
        if width >= best_w:
            best_url, best_w = candidate, width
    return best_url


def _extract_jsonld(tree: HTMLParser) -> tuple[str, list[str]]:
    title, images = "", []
    for node in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(node.text())
        except (ValueError, json.JSONDecodeError):
            continue
        stack = data if isinstance(data, list) else [data]
        # Flatten @graph containers too.
        flat = []
        for d in stack:
            if isinstance(d, dict) and isinstance(d.get("@graph"), list):
                flat.extend(d["@graph"])
            else:
                flat.append(d)
        for d in flat:
            if not isinstance(d, dict):
                continue
            t = d.get("@type")
            is_product = t == "Product" or (isinstance(t, list) and "Product" in t)
            if not is_product:
                continue
            title = d.get("name") or title
            val = d.get("image")
            for img in _coerce_images(val):
                images.append(img)
    return title, images


def _coerce_images(val) -> list[str]:
    out: list[str] = []
    if isinstance(val, str):
        out.append(val)
    elif isinstance(val, dict):  # ImageObject
        if isinstance(val.get("url"), str):
            out.append(val["url"])
    elif isinstance(val, list):
        for v in val:
            out.extend(_coerce_images(v))
    return out


def _extract_embedded_state(tree: HTMLParser, html: str) -> list[str]:
    """Generic SPA extraction: parse universal state containers, then regex-sweep all
    inline scripts for image URLs. Works without per-site keys."""
    images: list[str] = []

    # 1) Structured containers (Next.js / common Redux bootstraps).
    for node in tree.css('script[id="__NEXT_DATA__"], script[type="application/json"]'):
        try:
            data = json.loads(node.text())
        except (ValueError, json.JSONDecodeError):
            continue
        _walk_json_for_images(data, images)

    # 2) Raw regex sweep across the whole document as a last-resort generic net.
    if len(images) < 4:
        for m in _IMG_URL_IN_TEXT_RE.findall(html):
            images.append(m.replace("\\u002F", "/").replace("\\/", "/"))

    return images


def _walk_json_for_images(obj, out: list[str], depth: int = 0) -> None:
    if depth > 8 or len(out) > 60:
        return
    if isinstance(obj, str):
        if _looks_like_image_url(obj):
            out.append(obj)
    elif isinstance(obj, list):
        for v in obj:
            _walk_json_for_images(v, out, depth + 1)
    elif isinstance(obj, dict):
        for v in obj.values():
            _walk_json_for_images(v, out, depth + 1)


def _extract_meta(tree: HTMLParser) -> tuple[str, list[str]]:
    title, images = "", []
    og_title = tree.css_first('meta[property="og:title"]')
    if og_title:
        title = og_title.attributes.get("content", "") or title
    for sel in (
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
    ):
        for n in tree.css(sel):
            c = n.attributes.get("content")
            if c:
                images.append(c)
    return title, images


_DOM_IMG_ATTRS = ("data-old-hires", "data-zoom-image", "data-src", "data-image", "src")


def _extract_dom(tree: HTMLParser, base_url: str) -> list[str]:
    images: list[str] = []
    for n in tree.css("img"):
        srcset = n.attributes.get("srcset")
        if srcset:
            best = _largest_from_srcset(srcset)
            if best:
                images.append(best)
        for attr in _DOM_IMG_ATTRS:
            v = n.attributes.get(attr)
            if v:
                images.append(v)
                break
    for n in tree.css("source[srcset]"):
        best = _largest_from_srcset(n.attributes.get("srcset", ""))
        if best:
            images.append(best)
    for ns in tree.css("noscript"):
        inner = HTMLParser(ns.text())
        for n in inner.css("img"):
            v = n.attributes.get("src")
            if v:
                images.append(v)
    # Resolve relative / protocol-relative URLs.
    return [urljoin(base_url, u) for u in images]


# ───────────── hi-res upgraders (generic first, per-site optional) ──────────

_GENERIC_DOWNSCALE_RE = re.compile(
    r"(_(?:SX|SY|SL|AC|UX|UY)\d+_)|(,w_\d+)|(,h_\d+)|(/\d{2,3}/\d{2,3}/)", re.IGNORECASE
)


def _upgrade_amazon(u: str) -> str:
    # Strip Amazon's per-thumbnail size tokens (…_SX38_SY50_CR,0,0,38,50_.jpg → …jpg).
    return re.sub(r"\._[^.]+_\.", ".", u)


def _upgrade_myntra(u: str) -> str:
    return re.sub(r"/h_\d+,q_\d+/", "/h_1440,q_90/", u)


_PER_SITE_HIRES = {
    "amazon": _upgrade_amazon,
    "myntra": _upgrade_myntra,
}


def _upgrade_hires(u: str, retailer: str) -> str:
    rewriter = _PER_SITE_HIRES.get(retailer)
    if rewriter:
        try:
            return rewriter(u)
        except Exception:
            return u
    return u


# ───────────── orchestration ────────────────────────────────────────────────


def _postprocess(images: list[str], retailer: str) -> list[str]:
    s = get_settings()
    seen, out = set(), []
    for raw in images:
        if not raw:
            continue
        u = raw.replace("\\u002F", "/").replace("\\/", "/").strip()
        if u.startswith("//"):
            u = "https:" + u
        if not u.startswith(("http://", "https://")):
            continue
        if any(tok in u.lower() for tok in _JUNK_TOKENS):
            continue
        u = _upgrade_hires(u, retailer)
        key = u.split("?", 1)[0]
        if key in seen:
            continue
        seen.add(key)
        out.append(u)
        if len(out) >= s.SCRAPER_MAX_IMAGES:
            break
    return out


def extract_from_html(html: str, base_url: str, retailer: str) -> tuple[str, list[str]]:
    """Run the full waterfall on already-fetched HTML. Returns (title, images)."""
    tree = HTMLParser(html)
    title, images = "", []

    ld_title, ld_imgs = _extract_jsonld(tree)
    title = title or ld_title
    images.extend(ld_imgs)

    if len(images) < 2:
        images.extend(_extract_embedded_state(tree, html))

    meta_title, meta_imgs = _extract_meta(tree)
    title = title or meta_title
    if len(images) < 2:
        images.extend(meta_imgs)
    else:
        # og:image is a good primary even when we have gallery images.
        images = meta_imgs[:1] + images

    if len(images) < 2:
        images.extend(_extract_dom(tree, base_url))

    return title, _postprocess(images, retailer)


_MOCK_RETAILER_IMAGES = {
    "amazon": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80",
    "flipkart": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1000&q=80",
    "myntra": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80",
    "ajio": "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80",
    "meesho": "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=1000&q=80",
    "nykaa": "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1000&q=80",
}
_DEFAULT_MOCK_IMAGE = "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80"


async def scrape_product_url(url: str) -> ScrapedProduct:
    s = get_settings()
    if s.USE_MOCK_INTEGRATIONS:
        retailer = detect_retailer(url)
        mock_img = _MOCK_RETAILER_IMAGES.get(retailer, _DEFAULT_MOCK_IMAGE)
        return ScrapedProduct(
            title=f"Mock product from {retailer}",
            primaryImageUrl=mock_img,
            images=[mock_img],
            color="black",
            sizes=["S", "M", "L"],
            material=None,
            retailer=retailer,
            resolvedUrl=url,
            debug={"mock": True},
        )

    fetched = await _resolve_and_fetch(url)
    resolved_url = fetched.final_url
    retailer = detect_retailer(resolved_url)

    title, images = ("", [])
    if fetched.html:
        title, images = extract_from_html(fetched.html, resolved_url, retailer)

    debug = {
        "resolvedUrl": resolved_url,
        "html_bytes": len(fetched.html),
        "status": fetched.status,
        "blocked": fetched.blocked,
        "images_found": len(images),
        "strategy_used": "static" if not s.SCRAPER_RENDER_JS else "hybrid",
    }
    if fetched.blocked:
        log.warning("scrape_blocked", extra={"url": url, "status": fetched.status})
    elif not images:
        log.warning("scrape_no_images", extra={"url": url, "resolved": resolved_url})

    return ScrapedProduct(
        title=title,
        primaryImageUrl=images[0] if images else None,
        images=images or None,
        retailer=retailer if retailer != "unknown" else "generic",
        resolvedUrl=resolved_url,
        debug=debug,
    )
