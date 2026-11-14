FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ARG VITE_API_URL=http://127.0.0.1:8742
ENV VITE_API_URL=$VITE_API_URL
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile || pnpm install
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY tsconfig.base.json ./
RUN find packages apps -name '*.tsbuildinfo' -delete \
 && pnpm --filter @bu2/shared build \
 && pnpm --filter @bu2/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
