FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile --filter @website-generator/worker...

COPY apps/worker apps/worker
RUN pnpm --filter @website-generator/worker... build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace ./
CMD ["pnpm", "--filter", "@website-generator/worker", "start"]
