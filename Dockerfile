FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies needed for native modules / scripts
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json ./
COPY scripts ./scripts

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Environment variables for build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy built application from build stage
COPY --from=base /app/public ./public
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "run", "start"]
