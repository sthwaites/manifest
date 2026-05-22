FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN cd sandbox && npm ci

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g @openai/codex
COPY --from=builder /app .
EXPOSE 3000
CMD ["npx", "concurrently", "npm run start", "cd sandbox && npm run dev -- --port 3001"]
