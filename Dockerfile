# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy Prisma schema and configuration
COPY prisma ./prisma
COPY prisma.config.ts ./

# Generate Prisma Client
RUN DATABASE_URL="postgresql://gateway_user:gateway_password@localhost:5432/gateway_db?schema=public" npx prisma generate

# Copy application source
COPY . .

# Build NestJS
RUN npm run build


# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy generated Prisma Client and compiled application
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/dist ./dist

# Create and use a non-root user
USER node

EXPOSE 3000

CMD ["node", "--require", "./dist/instrumentation.js", "dist/main.js"]