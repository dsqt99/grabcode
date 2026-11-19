# One image recipe for the Next.js apps (web, coder, admin).
#   docker build -f infra/next-app.Dockerfile --build-arg PKG=@grabcode/web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t grabcode/web .
# NEXT_PUBLIC_API_URL and the web rewrites (CODER_ORIGIN, ADMIN_ORIGIN) are baked in at build time: rebuild per environment.
FROM node:22-alpine
ARG PKG
ARG NEXT_PUBLIC_API_URL
ARG CODER_ORIGIN
ARG ADMIN_ORIGIN
ENV COREPACK_HOME=/opt/corepack NEXT_TELEMETRY_DISABLED=1
RUN test -n "$PKG" && corepack enable && pnpm --version
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "${PKG}..."
RUN NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL CODER_ORIGIN=$CODER_ORIGIN ADMIN_ORIGIN=$ADMIN_ORIGIN pnpm --filter "${PKG}" build && chown -R node /app/apps
ENV NODE_ENV=production PKG=${PKG}
USER node
CMD ["sh", "-c", "exec pnpm --filter \"$PKG\" start"]
