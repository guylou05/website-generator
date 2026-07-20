FROM node:22-alpine
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/worker apps/worker
COPY packages packages
RUN pnpm install --filter @website-generator/worker...
CMD ["pnpm", "--filter", "@website-generator/worker", "dev"]
