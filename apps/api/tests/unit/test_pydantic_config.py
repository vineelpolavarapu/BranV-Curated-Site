"""Unit tests for csv_or_array_str and loose_bool transform validators."""

from __future__ import annotations

import pytest

from app.core.pydantic_config import csv_or_array_str, loose_bool


@pytest.mark.parametrize("v,expected", [
    (None, []),
    ("a,b,c", ["a", "b", "c"]),
    ("a, b , c ", ["a", "b", "c"]),
    ("only", ["only"]),
    (["a", "b"], ["a", "b"]),
    (["a", " b "], ["a", "b"]),
    ([], []),
    (",,", []),
])
def test_csv_or_array_str(v, expected):
    assert csv_or_array_str(v) == expected


@pytest.mark.parametrize("v", [True, "true", "True", "TRUE", "1", 1, "yes", "Y"])
def test_loose_bool_truthy(v):
    assert loose_bool(v) is True


@pytest.mark.parametrize("v", [False, "false", "False", "FALSE", "0", 0, "no", "N"])
def test_loose_bool_falsy(v):
    assert loose_bool(v) is False


@pytest.mark.parametrize("v", ["maybe", "1.5", 2, "", None])
def test_loose_bool_rejects_garbage(v):
    with pytest.raises(ValueError):
        loose_bool(v)
