"""Amazon Associates tag injection. No API call - just appends ?tag=AMAZON_ASSOCIATES_TAG."""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from ..core.settings import get_settings


def tag_url(raw_url: str) -> str:
    s = get_settings()
    if not s.AMAZON_ASSOCIATES_TAG:
        return raw_url
    parts = urlsplit(raw_url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q["tag"] = s.AMAZON_ASSOCIATES_TAG
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))
