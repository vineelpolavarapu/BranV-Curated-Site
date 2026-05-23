# ── Stage 1: base ─────────────────────────────────────────────────────────────
# Shared toolchain layer — Node 20 Alpine with pnpm enabled via corepack.
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── Stage 2: builder ──────────────────────────────────────────────────────────
# Full monorepo install + compile everything needed for the API.
FROM base AS builder
WORKDIR /app

# Copy the entire monorepo (dockerignore keeps it lean)
COPY . .

# Install all workspace dependencies (dev + prod)
RUN pnpm install --frozen-lockfile

# Compile @branv/shared to JS and point its package.json main to the dist.
# The API uses tsc (no bundler), so it cannot import raw TypeScript from
# node_modules at runtime — we need compiled .js files here.
RUN pnpm --filter @branv/shared build
RUN node -e "\
  const fs = require('fs');\
  const p = JSON.parse(fs.readFileSync('packages/shared/package.json', 'utf8'));\
  p.main = './dist/index.js';\
  p.types = './dist/index.d.ts';\
  fs.writeFileSync('packages/shared/package.json', JSON.stringify(p, null, 2));\
"

# Generate Prisma client (writes types + query engine to node_modules).
# DATABASE_URL must be set so Prisma can resolve env("DATABASE_URL") in the
# schema — it is only parsed syntactically here, no database connection made.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    pnpm --filter @branv/api exec prisma generate

# Compile the NestJS API TypeScript to dist/
RUN pnpm --filter @branv/api build

# Create a standalone production deployment directory: copies only the API
# package + its production dependencies (no dev deps, no other apps/packages).
RUN pnpm --filter @branv/api --prod deploy /api-prod

# ── Stage 3: runner ───────────────────────────────────────────────────────────
# Minimal production image — only what's needed to run the API.
FROM node:20-alpine AS runner
WORKDIR /api

# Install Prisma CLI globally so we can run `prisma migrate deploy` at startup.
# @prisma/client (prod dep) already bundles the query engine via pnpm deploy.
RUN npm install -g prisma@5

# Production node_modules from the deploy step (includes @branv/shared/dist)
COPY --from=builder /api-prod/node_modules ./node_modules

# Compiled API bundle
COPY --from=builder /app/apps/api/dist ./dist

# Prisma schema + migrations (needed for migrate deploy + generate)
COPY --from=builder /app/apps/api/prisma ./prisma

# Regenerate Prisma client inside the runner context so the query engine
# binary targets the correct Alpine libc.
RUN prisma generate

EXPOSE 4000
ENV NODE_ENV=production

# Run pending migrations then start the server.
# DATABASE_URL and other secrets are injected by Railway at runtime.
CMD ["sh", "-c", "prisma migrate deploy && node dist/main.js"]
