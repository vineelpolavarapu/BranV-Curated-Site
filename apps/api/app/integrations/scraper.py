"""
Retailer scraping. Returns canned data when USE_MOCK_INTEGRATIONS=true,
otherwise hits the live retailer and parses with selectolax.

Supported real-scrape retailers: amazon, flipkart, myntra, ajio, generic.
Unsupported ones fall back to a generic OpenGraph + JSON-LD parse - works
for most modern retailer sites that follow schema.org/Product.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.parse import urlparse

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


def detect_retailer(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if "flipkart" in host: return "flipkart"
    if "amazon" in host: return "amazon"
    if "myntra" in host: return "myntra"
    if "ajio" in host: return "ajio"
    if "meesho" in host: return "meesho"
    if "nykaafashion" in host: return "nykaa"
    if "snitch" in host: return "snitch"
    if "bewakoof" in host: return "bewakoof"
    if "thesouledstore" in host: return "thesouledstore"
    return "unknown"



async def _fetch_html(url: str) -> str:
    s = get_settings()
    async with httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=True,
        headers={
            "User-Agent": s.SCRAPER_USER_AGENT,
            "Accept-Language": "en-IN,en;q=0.9",
        },
    ) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text


# ───────────── per-retailer parsers ────────────────────────────────────────


def _parse_amazon(tree: HTMLParser) -> ScrapedProduct:
    title_node = tree.css_first("#productTitle, h1#title span, h1 span#productTitle")
    title = title_node.text(strip=True) if title_node else ""
    img_node = tree.css_first("#landingImage, #imgBlkFront")
    img = (img_node.attributes.get("data-old-hires") or img_node.attributes.get("src")) if img_node else None
    images = [
        n.attributes.get("src", "") for n in tree.css("#altImages img, #imageBlock img")
        if n.attributes.get("src")
    ]
    return ScrapedProduct(
        title=title, primaryImageUrl=img, images=images[:8], retailer="amazon"
    )


def _parse_flipkart(tree: HTMLParser) -> ScrapedProduct:
    # Flipkart has aggressive class scrambling - prefer JSON-LD + role-based selectors.
    title_node = tree.css_first("span.B_NuCI, h1._6EBuvT span, h1 span")
    title = title_node.text(strip=True) if title_node else ""
    img_node = tree.css_first("img._396cs4, img._2r_T1I")
    img = img_node.attributes.get("src") if img_node else None
    return ScrapedProduct(
        title=title, primaryImageUrl=img, retailer="flipkart"
    )


def _parse_myntra(tree: HTMLParser) -> ScrapedProduct:
    title_node = tree.css_first("h1.pdp-title, h1.pdp-name")
    title = title_node.text(strip=True) if title_node else ""
    img_node = tree.css_first("div.image-grid-image, img.product-img")
    img = (img_node.attributes.get("src") or img_node.attributes.get("style", "").split('url("')[-1].split('")')[0]) if img_node else None
    sizes = [n.text(strip=True) for n in tree.css("div.size-buttons-size-button-label")]
    return ScrapedProduct(
        title=title, primaryImageUrl=img,
        sizes=sizes or None, retailer="myntra"
    )


def _parse_ajio(tree: HTMLParser) -> ScrapedProduct:
    title_node = tree.css_first("h1.prod-name, .product-title")
    title = title_node.text(strip=True) if title_node else ""
    return ScrapedProduct(title=title, retailer="ajio")


def _parse_generic(tree: HTMLParser, retailer: str) -> ScrapedProduct:
    """Schema.org/Product JSON-LD parser - works for many modern retailer sites."""
    title: str = ""
    img: str | None = None
    images: list[str] = []

    # 1) Try JSON-LD blocks.
    for node in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(node.text())
        except (ValueError, json.JSONDecodeError):
            continue
        candidates = data if isinstance(data, list) else [data]
        for d in candidates:
            if not isinstance(d, dict):
                continue
            if d.get("@type") in ("Product", ["Product"]):
                title = d.get("name") or title
                if d.get("image"):
                    val = d["image"]
                    if isinstance(val, list):
                        images.extend([v for v in val if isinstance(v, str)])
                        img = img or (images[0] if images else None)
                    elif isinstance(val, str):
                        img = img or val
                        images.append(val)

    # 2) Fall back to OpenGraph if JSON-LD missing.
    if not title:
        og_title = tree.css_first('meta[property="og:title"]')
        if og_title:
            title = og_title.attributes.get("content", "")
    if not img:
        og_img = tree.css_first('meta[property="og:image"]')
        if og_img:
            img = og_img.attributes.get("content")

    return ScrapedProduct(
        title=title, primaryImageUrl=img,
        images=images[:8] if images else None, retailer=retailer,
    )


_PARSERS = {
    "amazon": _parse_amazon,
    "flipkart": _parse_flipkart,
    "myntra": _parse_myntra,
    "ajio": _parse_ajio,
}


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
    retailer = detect_retailer(url)
    if s.USE_MOCK_INTEGRATIONS:
        mock_img = _MOCK_RETAILER_IMAGES.get(retailer, _DEFAULT_MOCK_IMAGE)
        return ScrapedProduct(
            title=f"Mock product from {retailer}",
            primaryImageUrl=mock_img,
            images=[mock_img],
            color="black",
            sizes=["S", "M", "L"],
            material=None,
            retailer=retailer,
        )

    html = await _fetch_html(url)
    tree = HTMLParser(html)
    parser = _PARSERS.get(retailer)
    if parser is None:
        return _parse_generic(tree, retailer)
    try:
        return parser(tree)
    except Exception as e:  # noqa: BLE001
        log.warning("retailer_parser_failed", extra={"retailer": retailer, "error": str(e), "url": url})
        # Fall back to generic - better some data than none.
        return _parse_generic(tree, retailer)
