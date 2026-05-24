FROM node:20-alpine AS builder

WORKDIR /sandbox
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /sandbox
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /sandbox ./

EXPOSE 3001
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3001"]
