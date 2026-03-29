FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TELEGRAM_BOT_NAME
ARG NEXT_PUBLIC_TELEGRAM_BOT_CLIENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TELEGRAM_BOT_NAME=$NEXT_PUBLIC_TELEGRAM_BOT_NAME
ENV NEXT_PUBLIC_TELEGRAM_BOT_CLIENT_ID=$NEXT_PUBLIC_TELEGRAM_BOT_CLIENT_ID
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p public
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 10162

CMD ["node", "server.js"]