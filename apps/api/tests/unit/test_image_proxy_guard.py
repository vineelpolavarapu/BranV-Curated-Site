"""Unit tests for the SSRF guard behind the admin image-preview proxy.

Uses only literal IPs / offline-resolvable hosts so it never touches the network.
"""

from __future__ import annotations

import pytest

from app.integrations.s3 import is_safe_public_url


@pytest.mark.anyio
@pytest.mark.parametrize("url", [
    "http://169.254.169.254/latest/meta-data/",  # cloud metadata (link-local)
    "http://127.0.0.1/x",                          # loopback
    "http://localhost:5000/x",                     # loopback by name
    "http://10.0.0.5/x",                           # private
    "http://192.168.1.1/x",                        # private
    "http://[::1]/x",                              # IPv6 loopback
    "file:///etc/passwd",                          # non-http scheme
    "ftp://example.com/x",                         # non-http scheme
    "not-a-url",                                    # no host
])
async def test_rejects_unsafe_urls(url):
    assert await is_safe_public_url(url) is False


@pytest.mark.anyio
@pytest.mark.parametrize("url", [
    "http://8.8.8.8/x",       # public IP literal (no DNS needed)
    "https://1.1.1.1/img.jpg",
])
async def test_allows_public_ip_literals(url):
    assert await is_safe_public_url(url) is True
