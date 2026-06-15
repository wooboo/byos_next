ARG NODE_VERSION=22
ARG PNPM_VERSION=10

# Base stage - minimal Node.js only
FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION=10

LABEL org.opencontainers.image.title="TRMNL BYOS Next.js"
LABEL org.opencontainers.image.description="A Next.js application for BYOS"
LABEL org.opencontainers.image.vendor="rbouteiller"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV ENABLE_EXTERNAL_CATALOG=false

WORKDIR /app

RUN corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate

# Install dependencies only when needed
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --prod=false \
    && rm -rf ~/.npm ~/.pnpm-store /root/.cache

# Build the application
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build \
    && rm -rf node_modules/.cache

# Production image - chromedp/headless-shell for minimal Chrome footprint
FROM chromedp/headless-shell:146.0.7655.3 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV ENABLE_EXTERNAL_CATALOG=false
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_EXECUTABLE_PATH=/headless-shell/headless-shell

# Copy Node.js binary from build stage
COPY --from=base /usr/local/bin/node /usr/local/bin/node
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Install fonts for HTML rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/* \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-privileged user
RUN groupadd -g 1001 nodejs \
    && useradd -u 1001 -g nodejs -s /bin/false nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p .next/cache \
    && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
