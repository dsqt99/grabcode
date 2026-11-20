#!/usr/bin/env bash
# One command to stand up (or update) the GrabCode STAGING stack on a machine with Docker. See docs/STAGING.md.
#   ./infra/deploy/staging-up.sh [DOMAIN]        # DOMAIN omitted: read from .env.staging, else `localhost` (dry run on your machine)
# First run: creates .env.staging with generated secrets, builds + starts everything, loads the demo data, prints the logins.
# Re-run: rebuilds and restarts with the current code; demo data is kept (staging-reset.sh wipes it).
# Refuses to run on a machine that has a production env file (.env.production): staging and production never share a host.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="$ROOT/.env.staging"
PROJECT="grabcode-staging"
die() { echo "staging-up: $*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker is not installed (curl -fsSL https://get.docker.com | sh)."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is missing (the 'docker compose' command)."
[ -f "$ROOT/.env.production" ] && die ".env.production exists here: this looks like a production host. Staging must run on its own machine."

rand() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1"; }
# Set KEY=VALUE in .env.staging when the key is missing or empty (keeps what the operator already filled in).
setenv() {
  local key="$1" val="$2"
  if grep -qE "^${key}=.+" "$ENV_FILE"; then return; fi
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  cp infra/deploy/env.staging.example "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created .env.staging (generated secrets, never committed)."
fi
DOMAIN_ARG="${1:-${DOMAIN:-}}"
CURRENT_DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
DOMAIN_VALUE="${DOMAIN_ARG:-${CURRENT_DOMAIN:-localhost}}"
case "$DOMAIN_VALUE" in *://*|*/*|*" "*) die "DOMAIN must be a bare host name such as staging.example.com (no https://, no path).";; esac
# An explicit argument overrides the stored domain; anything else only fills blanks.
if [ -n "$DOMAIN_ARG" ] && [ "$DOMAIN_ARG" != "$CURRENT_DOMAIN" ]; then
  sed -i.bak -e "s|^DOMAIN=.*|DOMAIN=${DOMAIN_ARG}|" -e "s|^WEB_ORIGIN=.*|WEB_ORIGIN=https://${DOMAIN_ARG}|" -e "s|^API_PUBLIC_URL=.*|API_PUBLIC_URL=https://${DOMAIN_ARG}|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
fi
setenv DOMAIN "$DOMAIN_VALUE"
setenv WEB_ORIGIN "https://$DOMAIN_VALUE"
setenv API_PUBLIC_URL "https://$DOMAIN_VALUE"
setenv POSTGRES_PASSWORD "$(rand 32)"
setenv STAGING_DEV_LOGIN_KEY "$(rand 32)"
setenv DEMO_PASSWORD "$(rand 12)Aa1"
setenv APP_ENV staging
setenv AUTH_DEV_LOGIN true

get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
[ "$(get APP_ENV)" = "staging" ] || die ".env.staging must contain APP_ENV=staging."
[ "$(get AUTH_DEV_LOGIN)" = "true" ] || die ".env.staging must contain AUTH_DEV_LOGIN=true (the seed and the smoke scripts need it)."

export GC_ENV_FILE="$ENV_FILE"
dc() { docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f infra/deploy/docker-compose.prod.yml -f infra/deploy/docker-compose.staging.yml "$@"; }

echo "== Building and starting (first build takes 10-20 minutes; needs ~3 GB RAM, add swap on a small VPS) =="
dc up -d --build

echo "== Waiting for core-api =="
for _ in $(seq 1 60); do
  if dc exec -T core-api node -e "fetch('http://localhost:4000/v1/auth/providers').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then ready=1; break; fi
  sleep 3
done
[ "${ready:-}" = "1" ] || { dc logs --tail 40 core-api migrate; die "core-api did not become healthy in 3 minutes."; }

echo "== Loading demo data (skipped when it already exists) =="
dc run --rm seed

DOM="$(get DOMAIN)"
cat <<EOF

Staging is up.
  Customer site  https://$DOM
  Freelancer app https://$DOM/coder
  Admin          https://$DOM/admin
  Password of all demo accounts: $(get DEMO_PASSWORD)
  Smoke / E2E:   API_URL=https://$DOM DEV_LOGIN_KEY=$(get STAGING_DEV_LOGIN_KEY) node api/core-api/scripts/smoke-mvp.mjs
Demo script and troubleshooting: docs/STAGING.md
EOF
