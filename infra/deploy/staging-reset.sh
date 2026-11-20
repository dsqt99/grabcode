#!/usr/bin/env bash
# Wipe the staging database (and NATS data) and load the demo data again. STAGING ONLY. See docs/STAGING.md.
#   ./infra/deploy/staging-reset.sh --yes
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="$ROOT/.env.staging"
die() { echo "staging-reset: $*" >&2; exit 1; }

[ -f "$ROOT/.env.production" ] && die ".env.production exists here: refusing to delete data on a production host."
[ -f "$ENV_FILE" ] || die ".env.staging not found: run staging-up.sh first."
grep -qE '^APP_ENV=staging$' "$ENV_FILE" || die ".env.staging does not say APP_ENV=staging: refusing."
[ "${1:-}" = "--yes" ] || die "this deletes ALL staging data (orders, users, wallets). Re-run with --yes."

export GC_ENV_FILE="$ENV_FILE"
docker compose -p grabcode-staging --env-file "$ENV_FILE" -f infra/deploy/docker-compose.prod.yml -f infra/deploy/docker-compose.staging.yml down -v
# Same command as a first start: migrations, seed, logins.
exec "$ROOT/infra/deploy/staging-up.sh"
