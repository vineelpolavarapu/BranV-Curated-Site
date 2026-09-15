"""Unit tests for the site-agnostic image-scraping waterfall and affiliate resolver.

Pure/offline: they exercise HTML parsing and URL logic, never the network.
"""

from __future__ import annotations

import pytest

from app.integrations.scraper import (
    _canonicalize_url,
    _clean_title,
    _extract_redirect_target,
    _is_product_cdn,
    _largest_from_srcset,
    _looks_like_wrapper,
    _upgrade_flipkart,
    _upgrade_myntra,
    detect_retailer,
    extract_from_html,
)


def test_jsonld_extraction_on_unlisted_site():
    """A brand's own store (not in the retailer list) still yields images via JSON-LD."""
    html = (
        '<html><head>'
        '<script type="application/ld+json">'
        '{"@type":"Product","name":"Blue Shirt",'
        '"image":["https://cdn.brand.example/a_1200.jpg",'
        '"https://cdn.brand.example/b_1200.jpg"]}'
        '</script>'
        '<meta property="og:image" content="https://cdn.brand.example/og.jpg">'
        '</head><body></body></html>'
    )
    title, images = extract_from_html(html, "https://brand.example/p/blue-shirt", "generic")
    assert title == "Blue Shirt"
    assert "https://cdn.brand.example/a_1200.jpg" in images
    assert "https://cdn.brand.example/b_1200.jpg" in images
    assert len(images) >= 2


def test_dom_srcset_lazy_and_relative_resolution():
    html = (
        "<html><body>"
        '<img data-old-hires="/img/hero_2000.jpg" src="/img/hero_thumb.jpg">'
        '<img srcset="/img/x_200.jpg 200w, /img/x_1600.jpg 1600w">'
        '<img src="https://site.com/logo.png">'  # junk, must be filtered
        "</body></html>"
    )
    _, images = extract_from_html(html, "https://site.com/p/1", "generic")
    assert "https://site.com/img/hero_2000.jpg" in images  # lazy hi-res, absolutized
    assert "https://site.com/img/x_1600.jpg" in images      # largest srcset entry
    assert all("logo" not in u for u in images)             # logo dropped


def test_amazon_hires_upgrade():
    html = (
        '<img id="landingImage" '
        'src="https://m.media-amazon.com/images/I/71abc._SX38_SY50_CR,0,0,38,50_.jpg">'
    )
    _, images = extract_from_html(html, "https://www.amazon.in/dp/X", "amazon")
    assert images == ["https://m.media-amazon.com/images/I/71abc.jpg"]


def test_largest_from_srcset():
    assert _largest_from_srcset("/a.jpg 200w, /b.jpg 800w, /c.jpg 400w") == "/b.jpg"
    assert _largest_from_srcset("/only.jpg") == "/only.jpg"


def test_wrapper_detection():
    # Affiliate/redirect wrappers → unwrap.
    assert _looks_like_wrapper("https://earnkaro.com/api/redirect?id=1") is True
    assert _looks_like_wrapper("https://linksite.com/go?url=https://store.com/p") is True
    assert _looks_like_wrapper("https://amzn.to/3abcd") is True
    # A direct retailer URL (even with an affiliate tag) is scraped in place.
    assert _looks_like_wrapper("https://www.amazon.in/dp/X?tag=branv-21") is False
    assert _looks_like_wrapper("https://www.flipkart.com/p/itm123") is False


def test_meta_refresh_and_js_redirect_targets():
    meta = '<meta http-equiv="refresh" content="0;url=https://real.store/p/9">'
    assert _extract_redirect_target(meta, "https://w.com") == "https://real.store/p/9"
    js = '<script>window.location.href = "https://real.store/p/42";</script>'
    assert _extract_redirect_target(js, "https://w.com") == "https://real.store/p/42"


def test_detect_retailer():
    assert detect_retailer("https://www.myntra.com/x") == "myntra"
    assert detect_retailer("https://www.amazon.in/dp/x") == "amazon"
    assert detect_retailer("https://mybrand.example/p/1") == "unknown"


# ── Tier-1: allow-list, no-logo, real titles, cap=2, hi-res upgrades ──────────

def test_flipkart_allowlist_drops_logo_and_ignores_og_banner():
    """The exact live bug: og:image is the Flipkart brand banner; only the real
    rukminim product image must survive, and it must be the primary."""
    html = (
        '<html><head>'
        '<meta property="og:image" content="https://static-assets-web.flixcart.com/fk-p-static/images/fk_logo_lite.png">'
        '<title>Apple iPhone 15 (Black, 128 GB) - Buy Online at Best Price - Flipkart.com</title>'
        '</head><body>'
        '<img src="https://rukminim2.flixcart.com/image/480/640/xif0q/mobile/h/d/9/-original-imgABC.jpeg?q=20">'
        '<img src="https://static-assets-web.flixcart.com/fk-p-static/images/header_logo.svg">'
        '</body></html>'
    )
    title, images = extract_from_html(html, "https://www.flipkart.com/apple-iphone-15/p/itm1", "flipkart")
    assert title == "Apple iPhone 15 (Black, 128 GB)"
    assert images == ["https://rukminim2.flixcart.com/image/832/832/xif0q/mobile/h/d/9/-original-imgABC.jpeg?q=20"]
    assert all("flixcart.com/fk-p-static" not in u and "static-assets-web" not in u for u in images)


def test_is_product_cdn_allowlist():
    assert _is_product_cdn("https://rukminim2.flixcart.com/image/x.jpg", "flipkart") is True
    assert _is_product_cdn("https://static-assets-web.flixcart.com/logo.png", "flipkart") is False
    assert _is_product_cdn("https://m.media-amazon.com/images/I/71x.jpg", "amazon") is True
    assert _is_product_cdn("https://m.media-amazon.com/images/G/31/logo.jpg", "amazon") is False
    # Unknown retailer → no allow-list, keep everything.
    assert _is_product_cdn("https://anystore.example/x.jpg", "generic") is True


def test_cap_two_images():
    """At most 2 images even when many product-CDN images are present."""
    imgs = "".join(
        f'<img src="https://m.media-amazon.com/images/I/img{i}._SX300_.jpg">' for i in range(6)
    )
    _, images = extract_from_html(f"<html><body>{imgs}</body></html>", "https://www.amazon.in/dp/X", "amazon")
    assert len(images) == 2


@pytest.mark.parametrize("raw,expected", [
    ("Buy HRX by Hrithik Roshan Men Yellow T-shirt - Tshirts for Men", "HRX by Hrithik Roshan Men Yellow T-shirt"),
    ("Amazon.in: Apple iPhone 15", "Apple iPhone 15"),
    ("Apple iPhone 15 (Black, 128 GB) - Buy Online at Best Price - Flipkart.com", "Apple iPhone 15 (Black, 128 GB)"),
    ("Flipkart reCAPTCHA", ""),          # bot-wall title rejected
    ("Flipkart.com", ""),                # generic store name rejected
    ("Online Shopping India", ""),
])
def test_clean_title(raw, expected):
    assert _clean_title(raw, "flipkart") == expected


def test_hires_upgraders():
    assert _upgrade_flipkart("https://rukminim2.flixcart.com/image/128/128/x/y.jpg") == \
        "https://rukminim2.flixcart.com/image/832/832/x/y.jpg"
    # Myntra: strip the leading thumbnail transform, bump the real one.
    out = _upgrade_myntra("https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_75,w_1080/v1/a.jpg")
    assert "h_200,w_200" not in out
    assert "h_1440,q_90" in out


def test_canonicalize_flipkart_strips_tracking():
    dirty = "https://www.flipkart.com/apple-iphone-15/p/itm1?pid=MOBXYZ&lid=LST9&marketplace=FLIPKART&srno=b_1_1"
    assert _canonicalize_url(dirty, "flipkart") == "https://www.flipkart.com/apple-iphone-15/p/itm1?pid=MOBXYZ"
