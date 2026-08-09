"""
Schema parity check (playbook §6).

Compares the SQLAlchemy metadata against the live PostgreSQL schema and exits
non-zero on any drift between them. Detects:

  * Tables in SQLAlchemy that don't exist in the DB (model/migration drift).
  * Tables in the DB that aren't modelled in Python (Prisma added a model
    but the generator wasn't re-run).
  * Per-column differences: missing on either side, type mismatch,
    nullability mismatch.

Intentionally does NOT compare:
  * Default values (Prisma writes Postgres-cast literals like 'MEMBER'::"UserRole";
    SQLAlchemy serialization is informational only - Prisma owns DDL).
  * Index / constraint shape (Prisma may emit unique constraints via NOT NULL +
    unique index; we trust Prisma's schema as the source of truth).

Usage:
    uv run python scripts/check_schema_parity.py

Exits 0 on parity, 1 on any drift. CI wires this into the `make schema-check` target.
"""

from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

# Make `app` importable when this script is run as a file (uv run python scripts/...).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

# Import all models so they register on Base.metadata.
from app.db import models as _models  # noqa: F401, E402
from app.db.models import Base  # noqa: E402
from app.db.session import get_engine  # noqa: E402

# These metadata-built-in tables come from Prisma's internal migration log
# and from Postgres extensions. They are not part of the application contract.
IGNORED_TABLES = {"_prisma_migrations"}


@dataclass
class Diff:
    kind: str
    table: str
    detail: str

    def __str__(self) -> str:
        return f"[{self.kind}] {self.table}: {self.detail}"


# SQLAlchemy → Postgres canonical-type map used for the comparison.
# Both sides go through `_canon()` first so type spelling differences
# (e.g. "character varying" vs "varchar") collapse to the same token.
_TYPE_ALIASES = {
    "character varying": "varchar",
    "double precision": "float8",
    "timestamp with time zone": "timestamptz",
    "timestamp without time zone": "timestamp",
    "time with time zone": "timetz",
    "time without time zone": "time",
    "integer": "int4",
    "smallint": "int2",
    "bigint": "int8",
    "real": "float4",
    "boolean": "bool",
    "text": "text",
    "numeric": "numeric",
    "json": "json",
    "jsonb": "jsonb",
    "uuid": "uuid",
    "bytea": "bytea",
}


def _canon(t: str) -> str:
    t = t.lower().strip()
    return _TYPE_ALIASES.get(t, t)


def _sa_column_type(col) -> str:
    """SQLAlchemy column → Postgres-equivalent token suitable for comparison."""
    sa_type = col.type
    # SAEnum carries the PG enum type name - compare lowercase. Prisma names
    # its types case-preserved (e.g. "UserRole") but information_schema
    # returns udt_name lowercased ("userrole"), so casefold to match.
    enum_name = getattr(sa_type, "name", None)
    if type(sa_type).__name__ == "Enum" and enum_name:
        return enum_name.lower()
    name = type(sa_type).__name__.lower()
    mapping = {
        "string": "varchar",
        "integer": "int4",
        "biginteger": "int8",
        "smallinteger": "int2",
        "boolean": "bool",
        "float": "float8",
        "numeric": "numeric",
        "datetime": "timestamptz" if getattr(sa_type, "timezone", False) else "timestamp",
        "timestamp": "timestamptz" if getattr(sa_type, "timezone", False) else "timestamp",
        "date": "date",
        "time": "time",
        "text": "text",
        "largebinary": "bytea",
        "jsonb": "jsonb",
        "json": "json",
        "array": "_array",
        "uuid": "uuid",
    }
    return mapping.get(name, name)


async def fetch_live_columns(engine: AsyncEngine) -> dict[str, dict[str, dict]]:
    """Returns {table_name: {column_name: {data_type, is_nullable, udt_name}}}."""
    query = text(
        """
        SELECT table_name, column_name, data_type, is_nullable, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
        """
    )
    out: dict[str, dict[str, dict]] = {}
    async with engine.connect() as conn:
        rows = (await conn.execute(query)).mappings().all()
    for r in rows:
        t = r["table_name"]
        if t in IGNORED_TABLES:
            continue
        out.setdefault(t, {})[r["column_name"]] = {
            "data_type": r["data_type"],
            "is_nullable": r["is_nullable"] == "YES",
            "udt_name": r["udt_name"],
        }
    return out


def compare(live: dict[str, dict[str, dict]]) -> list[Diff]:
    diffs: list[Diff] = []
    sa_tables = {t.name: t for t in Base.metadata.tables.values()}

    sa_only = set(sa_tables) - set(live)
    db_only = set(live) - set(sa_tables)

    for t in sorted(sa_only):
        diffs.append(Diff("MISSING_IN_DB", t, "model declares table that is not in Postgres"))
    for t in sorted(db_only):
        diffs.append(Diff("MISSING_IN_MODEL", t, "Postgres has table the SQLAlchemy metadata does not"))

    for tname in sorted(set(sa_tables) & set(live)):
        sa_cols = {c.name: c for c in sa_tables[tname].columns}
        live_cols = live[tname]

        sa_only_cols = set(sa_cols) - set(live_cols)
        db_only_cols = set(live_cols) - set(sa_cols)
        for c in sorted(sa_only_cols):
            diffs.append(Diff("COL_MISSING_IN_DB", tname, f"column `{c}` declared but not in Postgres"))
        for c in sorted(db_only_cols):
            diffs.append(Diff("COL_MISSING_IN_MODEL", tname, f"column `{c}` in Postgres but not declared"))

        for cname in sorted(set(sa_cols) & set(live_cols)):
            sa_col = sa_cols[cname]
            live_col = live_cols[cname]
            sa_t = _canon(_sa_column_type(sa_col))
            db_t = _canon(live_col["udt_name"])
            # _array is SA's ARRAY type; Postgres reports the element udt prefixed with _ (e.g. _text).
            if sa_t == "_array":
                # Accept any Postgres array; deeper element-type checks deferred.
                if not db_t.startswith("_"):
                    diffs.append(Diff("COL_TYPE", tname, f"`{cname}` SA=ARRAY DB={db_t}"))
            elif sa_t != db_t:
                # Allow numeric without explicit precision to match Postgres numeric.
                if not (sa_t == "numeric" and db_t == "numeric"):
                    diffs.append(Diff("COL_TYPE", tname, f"`{cname}` SA={sa_t} DB={db_t}"))

            sa_null = sa_col.nullable is True
            db_null = live_col["is_nullable"]
            if sa_null != db_null:
                diffs.append(
                    Diff(
                        "COL_NULLABLE",
                        tname,
                        f"`{cname}` SA={'NULL' if sa_null else 'NOT NULL'} DB={'NULL' if db_null else 'NOT NULL'}",
                    )
                )

    return diffs


async def main() -> int:
    engine = get_engine()
    try:
        live = await fetch_live_columns(engine)
        diffs = compare(live)
    finally:
        await engine.dispose()

    if not diffs:
        n_tables = len(Base.metadata.tables)
        print(f"[schema-check] PARITY OK - {n_tables} tables match")
        return 0

    by_kind: dict[str, int] = {}
    for d in diffs:
        by_kind[d.kind] = by_kind.get(d.kind, 0) + 1
        print(d)
    summary = ", ".join(f"{k}={v}" for k, v in sorted(by_kind.items()))
    print(f"[schema-check] DRIFT - {len(diffs)} diffs ({summary})", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
