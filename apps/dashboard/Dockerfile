FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile --filter @website-generator/dashboard...

COPY apps/dashboard apps/dashboard
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RUN pnpm --filter @website-generator/dashboard build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @website-generator/dashboard start --hostname 0.0.0.0 --port ${PORT:-3000}"]
