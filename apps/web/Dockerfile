# Build context MUST be the monorepo root (docker-compose sets context: ".").
#   docker compose build web
#   docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile --config.strict-dep-builds=false

ARG VITE_SIGNALING_URL=ws://localhost:8080
ARG VITE_APP_VERSION=0.1.0+dev
ENV VITE_SIGNALING_URL=$VITE_SIGNALING_URL
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN pnpm --filter @kazhutha/observability build
RUN pnpm --filter @kazhutha/web build

FROM nginx:1.27-alpine
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
