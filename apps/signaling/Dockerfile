# Build context must be the monorepo root, e.g.:
#   docker build -f apps/signaling/Dockerfile -t kazhutha-signaling .
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kazhutha/observability build
RUN pnpm --filter @kazhutha/signaling build
RUN pnpm --filter @kazhutha/signaling deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /out ./
EXPOSE 8080
CMD ["node", "dist/server.js"]
