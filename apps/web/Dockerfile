# Build context must be the monorepo root, e.g.:
#   docker build -f apps/web/Dockerfile -t kazhutha-web .
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile

ARG VITE_SIGNALING_URL=ws://localhost:8080
ARG VITE_ICE_SERVERS=
ARG VITE_VETTU_MESSAGES=
ENV VITE_SIGNALING_URL=$VITE_SIGNALING_URL
ENV VITE_ICE_SERVERS=$VITE_ICE_SERVERS
ENV VITE_VETTU_MESSAGES=$VITE_VETTU_MESSAGES
RUN pnpm --filter @kazhutha/web build

FROM nginx:1.27-alpine
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
