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
RUN chmod +x /usr/local/bin/manifest-sandbox-entrypoint

EXPOSE 3001
ENTRYPOINT ["manifest-sandbox-entrypoint"]
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3001"]
