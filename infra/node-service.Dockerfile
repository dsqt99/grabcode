# One image recipe for core-api and every Node worker (they run TypeScript through tsx, no build step).
#   docker build -f infra/node-service.Dockerfile --build-arg PKG=@grabcode/core-api -t grabcode/core-api .
# Config comes from env vars at run time (see .env.example); no .env or credentials are copied in.
# qa-worker also needs a Docker CLI + socket, deploy-worker needs gcloud: run those where the host provides them.
FROM node:22-alpine
ARG PKG
# pnpm is cached at build time in a shared COREPACK_HOME so the non-root runtime user needs no network.
ENV COREPACK_HOME=/opt/corepack
RUN test -n "$PKG" && corepack enable && pnpm --version
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "${PKG}..."
ENV NODE_ENV=production PKG=${PKG}
USER node
CMD ["sh", "-c", "exec pnpm --filter \"$PKG\" start"]
