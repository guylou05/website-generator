FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages packages
RUN pnpm install --filter @website-generator/dashboard...
COPY tsconfig.base.json ./
COPY apps/dashboard apps/dashboard
EXPOSE 3000
CMD ["pnpm", "--filter", "@website-generator/dashboard", "dev", "--hostname", "0.0.0.0"]
