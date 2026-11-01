FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/finance-calc/package.json packages/finance-calc/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY packages/shared packages/shared
COPY packages/finance-calc packages/finance-calc
COPY apps/api apps/api
COPY tsconfig.base.json ./
RUN pnpm --filter @bu2/shared build \
 && pnpm --filter @bu2/finance-calc build \
 && pnpm --filter @bu2/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 8742
CMD ["sh", "-c", "pnpm db:migrate && node dist/index.js"]
