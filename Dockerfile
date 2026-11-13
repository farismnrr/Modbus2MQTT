# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.json ./
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile || pnpm install

COPY src ./src
COPY frontend ./frontend
RUN pnpm run build && pnpm prune --prod

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV MODBUS2MQTT_DATA=/app/data

RUN apk add --no-cache tini

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY data/configuration.example.yaml ./data/configuration.example.yaml

RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 8099

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
