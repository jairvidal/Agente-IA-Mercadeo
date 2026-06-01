FROM oven/bun:1.3.12-alpine AS base
WORKDIR /app

FROM base AS deps
COPY apps/backend/package.json apps/backend/bun.lock ./apps/backend/
COPY packages/observability/package.json ./packages/observability/
RUN cd apps/backend && bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY apps/backend ./apps/backend
COPY packages/observability ./packages/observability
WORKDIR /app/apps/backend
RUN bun build src/index.ts \
      --outfile dist/index.js \
      --target bun \
      --external "elysia" \
      --external "@elysiajs/cors" \
      --external "ioredis" \
      --external "ai" \
      --external "@ai-sdk/anthropic" \
      --external "@ai-sdk/google" \
      --external "@ai-sdk/openai" \
      --external "@modelcontextprotocol/sdk" \
      --external "zod" \
      --external "pino"

FROM oven/bun:1.3.12-alpine AS runner
WORKDIR /app

COPY --from=deps /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist/index.js ./index.js

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser

CMD ["bun", "index.js"]
