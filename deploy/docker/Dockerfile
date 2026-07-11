# syntax=docker/dockerfile:1

FROM node:lts-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
# Native build tools for better-sqlite3 (and similar)
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/agent/package.json apps/agent/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY tsconfig.base.json ./
RUN pnpm --filter @psm/shared build \
  && pnpm --filter @psm/web build

FROM node:lts-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PSM_DATA_DIR=/data
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache ca-certificates libc6-compat \
  && mkdir -p /data

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
