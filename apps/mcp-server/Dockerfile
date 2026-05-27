FROM oven/bun:1.3.12-alpine AS base
WORKDIR /app

# ─── deps: instala todo el workspace usando los manifests ──────────────
# Copiamos TODOS los package.json del workspace (no solo los del mcp-server)
# porque bun.lock los referencia a todos y --frozen-lockfile valida coherencia.
FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/orchestrator/package.json ./apps/orchestrator/package.json
COPY apps/mcp-server/package.json ./apps/mcp-server/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/observability/package.json ./packages/observability/package.json
RUN bun install --frozen-lockfile

# ─── builder: copia el monorepo y bundlea el mcp-server ────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/mcp-server
RUN bun build src/index.ts \
      --outfile dist/index.js \
      --target bun \
      --external "@modelcontextprotocol/sdk"

# ─── runner: imagen mínima ──────────────────────────────────────────────
FROM oven/bun:1.3.12-alpine AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/mcp-server/dist/index.js ./index.js

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser

EXPOSE 8000
CMD ["bun", "index.js"]
