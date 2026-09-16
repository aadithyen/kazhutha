# Build context must be the monorepo root, e.g.:
#   docker build -f apps/web/Dockerfile -t kazhutha-web .
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages
RUN pnpm install --frozen-lockfile --config.strict-dep-builds=false

ARG VITE_SIGNALING_URL=ws://localhost:8080
ENV VITE_SIGNALING_URL=$VITE_SIGNALING_URL
RUN pnpm --filter @kazhutha/observability build
RUN pnpm --filter @kazhutha/web build

FROM nginx:1.27-alpine
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
