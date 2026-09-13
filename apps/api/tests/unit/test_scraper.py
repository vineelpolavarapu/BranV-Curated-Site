"""Unit tests for the site-agnostic image-scraping waterfall and affiliate resolver.

Pure/offline: they exercise HTML parsing and URL logic, never the network.
"""

from __future__ import annotations

from app.integrations.scraper import (
    _extract_redirect_target,
    _largest_from_srcset,
    _looks_like_wrapper,
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
