FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile --filter @website-generator/dashboard...

COPY apps/dashboard apps/dashboard
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_USE_PROXY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_USE_PROXY=$NEXT_PUBLIC_USE_PROXY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# The dashboard imports workspace packages through their compiled `dist` exports.
# Build the dashboard and its transitive workspace dependencies in topological order.
RUN pnpm --filter @website-generator/dashboard... build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace ./
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
EXPOSE 8080
CMD ["node", "apps/dashboard/.next/standalone/apps/dashboard/server.js"]
