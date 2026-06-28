"""
SQLAlchemy 2.x async models — read-shaped, mirroring the Prisma schema in
`apps/api/prisma/schema.prisma`.

HARD RULE — Prisma owns the database schema. Do NOT generate Alembic migrations.

When the schema changes:
  1. Update apps/api/prisma/schema.prisma
  2. Run `pnpm --filter @branv/api run db:migrate` (Prisma generates SQL + applies)
  3. Re-snapshot:  cp apps/api/prisma/schema.prisma migration/contract/prisma-schema.snapshot.prisma
  4. Mirror the change here as a SQLAlchemy column edit
  5. `uv run python scripts/check_schema_parity.py` must pass

Column declarations MUST use the camelCase name explicitly because Prisma maps
tables to snake_case via `@@map` but leaves columns camelCase by default:

    user_id: Mapped[str] = mapped_column("userId", String(...))

Step 3 of the migration playbook fleshes out this package model-by-model.
"""
