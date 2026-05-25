FROM node:20-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV SANDBOX_INTERNAL_URL=http://sandbox:3001
ARG DEBUG_AUTH=true
ENV DEBUG_AUTH=${DEBUG_AUTH}

COPY package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN npm ci

COPY sandbox/package*.json ./sandbox/
RUN cd sandbox && npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SANDBOX_INTERNAL_URL=http://sandbox:3001
ENV NEXT_PUBLIC_SANDBOX_PUBLIC_URL=http://localhost:3001

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g @openai/codex \
  && git config --global user.name "Manifest Agent" \
  && git config --global user.email "manifest-agent@example.invalid"

COPY --from=builder /app ./
RUN cp -a sandbox sandbox-template \
  && npm prune --omit=dev

EXPOSE 3000
EXPOSE 8080
CMD ["npm", "run", "start:container"]
