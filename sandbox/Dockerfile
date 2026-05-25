FROM node:20-alpine AS builder

WORKDIR /sandbox-template
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /sandbox
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache git

COPY --from=builder /sandbox-template /sandbox-template
COPY docker-entrypoint.sh /usr/local/bin/manifest-sandbox-entrypoint
COPY serve-dev.sh /usr/local/bin/manifest-sandbox-serve-dev
RUN chmod +x /usr/local/bin/manifest-sandbox-entrypoint /usr/local/bin/manifest-sandbox-serve-dev

EXPOSE 3001
ENTRYPOINT ["manifest-sandbox-entrypoint"]
CMD ["manifest-sandbox-serve-dev"]
