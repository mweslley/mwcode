FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY ui/package.json ./ui/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/adapters/package.json ./packages/adapters/
RUN pnpm install --no-frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/ui/dist ./ui/dist
COPY --from=build /app/packages ./packages

EXPOSE 3100
CMD ["node", "server/dist/index.js"]