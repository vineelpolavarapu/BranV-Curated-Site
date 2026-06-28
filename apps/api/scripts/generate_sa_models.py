"""
Step 3 generator: Prisma schema → SQLAlchemy 2.x async models.

Reads `migration/contract/prisma-schema.snapshot.prisma` and emits:
  app/db/enums.py                — one Python Enum per Prisma enum
  app/db/models/<snake>.py       — one SQLAlchemy class per Prisma model
  app/db/models/__init__.py      — re-exports everything

Hard rules from the playbook:
  - Prisma owns the schema. NO Alembic migrations.
  - Columns MUST be declared with explicit camelCase string names because
    Prisma maps tables to snake_case via @@map but leaves columns camelCase
    (see project memory `project_raw_sql_column_naming`).
  - Decimals get the Prisma `@db.Decimal(precision, scale)` annotation copied
    onto SQLAlchemy `Numeric(precision, scale)`. Serialization to JSON as
    string happens in Pydantic schemas, not at the ORM layer.
  - This first pass emits **scalar columns only** (plus relation FKs).
    Bidirectional `relationship()` declarations are added on demand as each
    domain is ported in Step 6 — they're not required for the parity gate.

Re-run after every schema change:
  1. Update apps/api/prisma/schema.prisma + run db:migrate
  2. cp apps/api/prisma/schema.prisma migration/contract/prisma-schema.snapshot.prisma
  3. uv run python scripts/generate_sa_models.py
  4. uv run python scripts/check_schema_parity.py   ← must exit 0
"""

from __future__ import annotations

import re
import sys
import textwrap
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
# Prefer the live Prisma schema (now at repo-root prisma/); fall back to the
# migration snapshot if it doesn't exist for some reason.
SCHEMA_PATH = REPO_ROOT / "prisma" / "schema.prisma"
if not SCHEMA_PATH.exists():
    SCHEMA_PATH = REPO_ROOT / "migration" / "contract" / "prisma-schema.snapshot.prisma"
OUT_ROOT = Path(__file__).resolve().parents[1] / "app" / "db"
MODELS_DIR = OUT_ROOT / "models"
ENUMS_PATH = OUT_ROOT / "enums.py"
INIT_PATH = MODELS_DIR / "__init__.py"

# ---------- Parser ----------

PRISMA_SCALAR_TO_SA: dict[str, str] = {
    # Prisma DDL choices (verified against apps/api/prisma/migrations/*/migration.sql):
    #   String   → TEXT                       (NOT varchar)
    #   DateTime → TIMESTAMP(3) (no timezone) (NOT timestamptz)
    #   Json     → JSONB
    "String":   "Text",
    "Int":      "Integer",
    "BigInt":   "BigInteger",
    "Float":    "Float",
    "Decimal":  "Numeric",
    "Boolean":  "Boolean",
    "DateTime": "TIMESTAMP",
    "Json":     "JSONB",
    "Bytes":    "LargeBinary",
}
PRISMA_SCALAR_TO_PY: dict[str, str] = {
    "String":   "str",
    "Int":      "int",
    "BigInt":   "int",
    "Float":    "float",
    "Decimal":  "Decimal",
    "Boolean":  "bool",
    "DateTime": "datetime",
    "Json":     "Any",
    "Bytes":    "bytes",
}


@dataclass
class EnumDef:
    name: str
    values: list[str]


@dataclass
class FieldDef:
    name: str           # Prisma field name (camelCase column)
    raw_type: str       # e.g. "String", "DateTime", "UserRole", "Brand", "Product[]"
    optional: bool
    is_list: bool
    attributes: list[str]   # raw @-attribute strings, in order
    db_native: str | None = None    # e.g. "Decimal(12, 2)" from @db.Decimal(12,2)

    def is_orm_only(self, enum_names: set[str]) -> bool:
        # A field whose type is a model name (not scalar, not enum) is a pure
        # ORM relationship declaration — both sides of @relation are skipped
        # by this scalar-only generator. The actual FK column is a separate
        # scalar field on the owning side (e.g. `userId String` next to
        # `user User @relation(fields:[userId], ...)`).
        if self.raw_type in PRISMA_SCALAR_TO_SA:
            return False
        if self.raw_type in enum_names:
            return False
        return True


@dataclass
class ModelDef:
    name: str
    fields: list[FieldDef] = field(default_factory=list)
    table_name: str = ""       # from @@map; falls back to plural snake_case of name
    indexes: list[list[str]] = field(default_factory=list)   # @@index([...]) — fields per index
    uniques: list[list[str]] = field(default_factory=list)   # @@unique([...])
    compound_id: list[str] = field(default_factory=list)     # @@id([...])


def parse_schema(text: str) -> tuple[list[EnumDef], list[ModelDef], set[str]]:
    enums: list[EnumDef] = []
    models: list[ModelDef] = []
    enum_names: set[str] = set()

    # Strip block + line comments to keep the parser simple. Doc-comments (///)
    # are also comments to Prisma.
    text = re.sub(r"//.*$", "", text, flags=re.MULTILINE)

    # Iterate top-level `enum Name { ... }` and `model Name { ... }` blocks.
    block_re = re.compile(
        r"^\s*(enum|model)\s+(\w+)\s*\{\s*(.*?)\s*^\}",
        flags=re.MULTILINE | re.DOTALL,
    )
    for m in block_re.finditer(text):
        kind, name, body = m.group(1), m.group(2), m.group(3)
        if kind == "enum":
            values = [ln.strip() for ln in body.splitlines() if ln.strip() and not ln.strip().startswith("@")]
            enums.append(EnumDef(name=name, values=values))
            enum_names.add(name)
        else:
            models.append(_parse_model(name, body))

    return enums, models, enum_names


def _parse_model(name: str, body: str) -> ModelDef:
    model = ModelDef(name=name)
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("@@"):
            _parse_block_attr(model, line)
            continue
        # Field line: `<name> <type> [@attributes...]`
        # Split tokens carefully — attributes can contain parentheses + spaces.
        tokens = re.match(r"^(\w+)\s+([\w\[\]\?]+)\s*(.*)$", line)
        if not tokens:
            continue
        fname, raw_type, attr_blob = tokens.group(1), tokens.group(2), tokens.group(3).strip()
        is_list = raw_type.endswith("[]")
        optional = raw_type.endswith("?")
        base_type = raw_type.rstrip("[]").rstrip("?")
        # Attributes — split on top-level whitespace between @ markers.
        attrs = _split_attrs(attr_blob)
        db_native = None
        for a in attrs:
            db_m = re.match(r"@db\.(\w+(?:\(.*\))?)", a)
            if db_m:
                db_native = db_m.group(1)
        model.fields.append(
            FieldDef(
                name=fname,
                raw_type=base_type,
                optional=optional,
                is_list=is_list,
                attributes=attrs,
                db_native=db_native,
            )
        )
    if not model.table_name:
        model.table_name = _default_table_name(model.name)
    return model


def _split_attrs(blob: str) -> list[str]:
    """Split a string like `@id @default(cuid()) @map("foo")` into a list."""
    out: list[str] = []
    depth = 0
    buf: list[str] = []
    for ch in blob:
        if ch == "(":
            depth += 1
            buf.append(ch)
        elif ch == ")":
            depth -= 1
            buf.append(ch)
        elif ch.isspace() and depth == 0:
            if buf:
                out.append("".join(buf))
                buf = []
        else:
            buf.append(ch)
    if buf:
        out.append("".join(buf))
    return out


def _parse_block_attr(model: ModelDef, line: str) -> None:
    if line.startswith("@@map("):
        m = re.match(r'@@map\("([^"]+)"\)', line)
        if m:
            model.table_name = m.group(1)
    elif line.startswith("@@index("):
        m = re.match(r"@@index\(\[(.*?)\]", line)
        if m:
            model.indexes.append([f.strip() for f in m.group(1).split(",") if f.strip()])
    elif line.startswith("@@unique("):
        m = re.match(r"@@unique\(\[(.*?)\]", line)
        if m:
            model.uniques.append([f.strip() for f in m.group(1).split(",") if f.strip()])
    elif line.startswith("@@id("):
        m = re.match(r"@@id\(\[(.*?)\]", line)
        if m:
            model.compound_id = [f.strip() for f in m.group(1).split(",") if f.strip()]


def _default_table_name(model_name: str) -> str:
    # Prisma's default pluralization isn't enforced — @@map is required when
    # they want it. If @@map missing, fall back to camelCase→snake_case.
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", model_name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


# ---------- Emitter ----------

def emit_enums(enums: list[EnumDef]) -> str:
    lines: list[str] = [
        '"""',
        "Generated from migration/contract/prisma-schema.snapshot.prisma.",
        "Do NOT edit by hand — re-run scripts/generate_sa_models.py.",
        '"""',
        "from __future__ import annotations",
        "",
        "from enum import Enum",
        "",
    ]
    for e in enums:
        lines.append(f"class {e.name}(str, Enum):")
        for v in e.values:
            lines.append(f"    {v} = {v!r}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def emit_model(model: ModelDef, enum_names: set[str], model_names: set[str]) -> str:
    scalar_fields = [f for f in model.fields if not f.is_orm_only(enum_names)]
    # Filter out: ORM relationship declarations (both owning and inverse sides).
    # The actual FK columns live as separate scalar fields on the owning model.
    cols = []
    needs_imports: dict[str, bool] = {
        "Numeric": False, "TIMESTAMP": False, "Date": False, "JSONB": False, "ARRAY": False,
        "Text": False, "Integer": False, "BigInteger": False, "Boolean": False, "Float": False,
        "LargeBinary": False, "Decimal": False, "datetime": False, "date": False, "Any": False,
        "Index": False, "SAEnum": False,
    }
    enum_imports: set[str] = set()
    py_types_needed: set[str] = set()

    for f in scalar_fields:
        sa_type, py_type, type_imports = _resolve_types(f, enum_names)
        for imp in type_imports:
            needs_imports[imp] = True
        if py_type in {"datetime", "date", "Decimal", "Any"}:
            py_types_needed.add(py_type)
        if f.raw_type in enum_names:
            enum_imports.add(f.raw_type)

        col_args = [sa_type]
        is_pk = any(a == "@id" for a in f.attributes) or f.name in model.compound_id
        if is_pk:
            col_args.append("primary_key=True")
        if any(a == "@unique" for a in f.attributes):
            col_args.append("unique=True")
        # Prisma's String[]/Int[]/etc. arrays are non-optional at the Prisma
        # level but Postgres makes ARRAY columns nullable by default unless
        # explicit NOT NULL is added (Prisma doesn't add it). Force nullable=True
        # for scalar arrays to match the live schema.
        if f.is_list:
            col_args.append("nullable=True")
        elif f.optional:
            col_args.append("nullable=True")
        else:
            col_args.append("nullable=False")
        default = _extract_default(f, sa_type)
        if default is not None:
            col_args.append(default)
            needs_imports["text_func"] = True
        if any(a == "@updatedAt" for a in f.attributes):
            col_args.append("onupdate=text('CURRENT_TIMESTAMP')")
            needs_imports["text_func"] = True

        py_annotation = py_type if not f.optional else f"{py_type} | None"
        cols.append(f"    {_safe_field_name(f.name)}: Mapped[{py_annotation}] = mapped_column({', '.join(col_args)}, name={f.name!r})")

    # Indexes
    table_args_lines: list[str] = []
    for idx in model.indexes:
        names = [f"{model.table_name}.c.{c}" if False else c for c in idx]
        table_args_lines.append(
            f"        Index({_index_name(model.table_name, idx)!r}, {', '.join(repr(c) for c in idx)}),"
        )
    for uq in model.uniques:
        table_args_lines.append(
            f"        UniqueConstraint({', '.join(repr(c) for c in uq)}, name={_unique_name(model.table_name, uq)!r}),"
        )

    if table_args_lines:
        needs_imports["Index"] = True
        table_args = "\n".join([
            "",
            "    __table_args__ = (",
            *table_args_lines,
            "    )",
        ])
    else:
        table_args = ""

    # Compose imports
    sa_core = [k for k in ["Text", "Integer", "BigInteger", "Boolean", "Float", "Numeric",
                            "TIMESTAMP", "Date", "LargeBinary"] if needs_imports.get(k)]
    sa_extras = []
    if needs_imports.get("ARRAY"):
        sa_extras.append("ARRAY")
    if needs_imports.get("Index"):
        sa_extras.append("Index")
        if any("UniqueConstraint" in ln for ln in table_args_lines):
            sa_extras.append("UniqueConstraint")
    if needs_imports.get("text_func"):
        sa_extras.append("text")
    if needs_imports.get("SAEnum"):
        sa_extras.append("Enum as SAEnum")

    sa_dialect_imports = []
    if needs_imports.get("JSONB"):
        sa_dialect_imports.append("JSONB")

    import_lines = ["from __future__ import annotations", ""]
    if py_types_needed:
        py_imports: list[str] = []
        dt_parts = [t for t in ("date", "datetime") if t in py_types_needed]
        if dt_parts:
            py_imports.append(f"from datetime import {', '.join(dt_parts)}")
        if "Decimal" in py_types_needed:
            py_imports.append("from decimal import Decimal")
        if "Any" in py_types_needed:
            py_imports.append("from typing import Any")
        import_lines.extend(py_imports)
        import_lines.append("")

    sa_imports = sa_core + sa_extras
    if sa_imports:
        import_lines.append(f"from sqlalchemy import {', '.join(sorted(set(sa_imports)))}")
    if sa_dialect_imports:
        import_lines.append(f"from sqlalchemy.dialects.postgresql import {', '.join(sa_dialect_imports)}")
    import_lines.append("from sqlalchemy.orm import Mapped, mapped_column")
    if enum_imports:
        import_lines.append("")
        import_lines.append(f"from ..enums import {', '.join(sorted(enum_imports))}")
    import_lines.append("")
    import_lines.append("from .base import Base")
    import_lines.append("")
    import_lines.append("")

    class_lines = [
        f"class {model.name}(Base):",
        f"    __tablename__ = {model.table_name!r}",
        *cols,
    ]
    if table_args:
        class_lines.append(table_args)

    docstring = (
        '"""\n'
        f"Auto-generated from Prisma model `{model.name}`.\n"
        "Source: migration/contract/prisma-schema.snapshot.prisma\n"
        "Do NOT edit by hand — re-run scripts/generate_sa_models.py.\n"
        '"""'
    )

    parts = [docstring, "\n".join(import_lines), "\n".join(class_lines)]
    return "\n".join(parts).rstrip() + "\n"


def _resolve_types(f: FieldDef, enum_names: set[str]) -> tuple[str, str, list[str]]:
    """Return (SQLAlchemy column type string, Python annotation, list of needed import keys)."""
    imports: list[str] = []
    raw = f.raw_type

    if f.is_list:
        # Only Prisma scalar arrays land here — model[] back-relations are filtered out earlier.
        if raw in PRISMA_SCALAR_TO_SA:
            inner = PRISMA_SCALAR_TO_SA[raw]
            imports.extend(["ARRAY", inner])
            return f"ARRAY({inner})", f"list[{PRISMA_SCALAR_TO_PY[raw]}]", imports
        # Enum array — Prisma syntax allows this; treat as ARRAY(String) (Postgres enum arrays
        # would require a Postgres enum type which Prisma doesn't usually emit).
        if raw in enum_names:
            imports.extend(["ARRAY", "String"])
            return "ARRAY(String)", "list[str]", imports
        raise RuntimeError(f"Unsupported list type in field {f.name}: {raw}")

    if raw in PRISMA_SCALAR_TO_SA:
        sa = PRISMA_SCALAR_TO_SA[raw]
        py = PRISMA_SCALAR_TO_PY[raw]
        # Decimal: prefer Prisma's @db.Decimal(...) precision if present.
        if raw == "Decimal":
            if f.db_native and f.db_native.startswith("Decimal("):
                args = f.db_native[len("Decimal"):]
                imports.append("Numeric")
                return f"Numeric{args}", py, imports
            imports.append("Numeric")
            return "Numeric", py, imports
        if raw == "Json":
            imports.append("JSONB")
            return "JSONB", "Any", imports
        if raw == "DateTime":
            # @db.Date overrides DateTime to a pure date column (no time/zone).
            if f.db_native == "Date":
                imports.append("Date")
                return "Date", "date", imports
            # Default: Prisma uses TIMESTAMP(3) with no timezone.
            imports.append("TIMESTAMP")
            return "TIMESTAMP(timezone=False)", "datetime", imports
        imports.append(sa)
        return sa, py, imports

    if raw in enum_names:
        # Prisma generates a native PostgreSQL ENUM type (verified in
        # migration SQL: `CREATE TYPE "UserRole" AS ENUM (...)`). Mirror it
        # with SAEnum, create_type=False so SQLAlchemy never tries to issue
        # CREATE TYPE — Prisma owns DDL.
        imports.append("SAEnum")
        sa_expr = f'SAEnum({raw}, name="{raw}", create_type=False, native_enum=True)'
        return sa_expr, raw, imports

    raise RuntimeError(
        f"Unresolved type for field {f.name}: {raw} (not scalar, not enum, not list)"
    )


def _extract_default(f: FieldDef, sa_type: str) -> str | None:
    for a in f.attributes:
        m = re.match(r"@default\((.*)\)", a)
        if not m:
            continue
        val = m.group(1).strip()
        if val == "now()":
            return "server_default=text('CURRENT_TIMESTAMP')"
        if val == "cuid()" or val == "uuid()" or val == "autoincrement()":
            # ID generation happens in Prisma; SQLAlchemy reads what's already there.
            return None
        if val.startswith('"') and val.endswith('"'):
            return f"server_default=text({val!r})"
        if val == "true" or val == "false":
            return f"server_default=text({val!r})"
        if val.startswith("["):
            # Array default like `@default([])` — emit empty array literal.
            return "server_default=text(\"'{}'\")"
        # Numeric or enum literal
        return f"server_default=text({val!r})"
    return None


def _is_enum(f: FieldDef, enum_names: set[str]) -> bool:
    return f.raw_type in enum_names and not f.is_list


def _safe_field_name(name: str) -> str:
    """
    Avoid Python keyword collisions AND SQLAlchemy DeclarativeBase reserved
    names (notably `metadata`, which clashes with `Base.metadata`).
    Column name on the DB side is preserved via `name=...` in mapped_column().
    """
    py_keywords = {"id", "type", "from", "import", "class", "global", "in", "is", "return"}
    sa_reserved = {"metadata", "registry"}
    if name in py_keywords or name in sa_reserved:
        return f"{name}_"
    return name


def _index_name(table: str, cols: list[str]) -> str:
    return f"ix_{table}_{'_'.join(cols)}"


def _unique_name(table: str, cols: list[str]) -> str:
    return f"uq_{table}_{'_'.join(cols)}"


# ---------- Driver ----------

def main() -> int:
    if not SCHEMA_PATH.exists():
        print(f"[generate] schema snapshot missing: {SCHEMA_PATH}", file=sys.stderr)
        return 1
    text = SCHEMA_PATH.read_text(encoding="utf-8")
    enums, models, enum_names = parse_schema(text)
    print(f"[generate] parsed {len(enums)} enums and {len(models)} models")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Base declarative class — shared by all models.
    base_path = MODELS_DIR / "base.py"
    base_path.write_text(
        '"""Auto-generated. Do not edit."""\n'
        "from __future__ import annotations\n\n"
        "from sqlalchemy.orm import DeclarativeBase\n\n\n"
        "class Base(DeclarativeBase):\n"
        "    pass\n",
        encoding="utf-8",
    )

    ENUMS_PATH.write_text(emit_enums(enums), encoding="utf-8")

    model_names = {m.name for m in models}
    init_lines = [
        '"""Auto-generated. Do not edit — re-run scripts/generate_sa_models.py."""',
        "from .base import Base",
        "",
    ]
    written = 0
    for m in models:
        snake = _default_table_name(m.name)
        out = MODELS_DIR / f"{snake}.py"
        try:
            out.write_text(emit_model(m, enum_names, model_names), encoding="utf-8")
        except RuntimeError as e:
            print(f"[generate] FAILED {m.name}: {e}", file=sys.stderr)
            raise
        init_lines.append(f"from .{snake} import {m.name}")
        written += 1
    init_lines.append("")
    init_lines.append("__all__ = [")
    init_lines.append('    "Base",')
    for m in models:
        init_lines.append(f'    "{m.name}",')
    init_lines.append("]")
    INIT_PATH.write_text("\n".join(init_lines) + "\n", encoding="utf-8")

    print(f"[generate] wrote {written} model files + enums.py + base.py under {OUT_ROOT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
