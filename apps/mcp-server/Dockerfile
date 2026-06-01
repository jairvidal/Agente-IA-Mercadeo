FROM oven/bun:1.3.12-alpine AS base
WORKDIR /app

FROM base AS deps
COPY apps/mcp-server/package.json apps/mcp-server/bun.lock* ./apps/mcp-server/
RUN cd apps/mcp-server && bun install --frozen-lockfile

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/apps/mcp-server/node_modules ./apps/mcp-server/node_modules
COPY apps/mcp-server ./apps/mcp-server
WORKDIR /app/apps/mcp-server
RUN bun build src/index.ts \
      --outfile dist/index.js \
      --target bun \
      --external "@modelcontextprotocol/sdk" \
      --external "zod"

FROM oven/bun:1.3.12-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/apps/mcp-server/node_modules ./node_modules
COPY --from=builder /app/apps/mcp-server/dist/index.js ./index.js

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser

CMD ["bun", "index.js"]
