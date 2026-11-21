#!/usr/bin/env bash
# One command to stand up (or update) the GrabCode STAGING stack on a machine with Docker. See docs/STAGING.md.
#   ./infra/deploy/staging-up.sh [DOMAIN]                          # standalone: Caddy owns 80/443 + Let's Encrypt
#   ./infra/deploy/staging-up.sh --port 18080 staging.example.com  # SHARED VPS mode (below)
# DOMAIN omitted: read from .env.staging, else `localhost` (dry run on your machine).
# First run: creates .env.staging with generated secrets, builds + starts everything, loads the demo data, prints the logins.
# Re-run: rebuilds and restarts with the current code; demo data is kept (staging-reset.sh wipes it).
#
# SHARED VPS mode (a --port flag, STAGING_HTTP_PORT in the environment or .env.staging, or a .env.production on this machine):
#   Caddy runs plain HTTP (no TLS, no 80/443) and publishes ONLY 127.0.0.1:<port>. The operator's own reverse proxy owns the
#   domain + TLS and proxies to that port (the script prints nginx/Caddy examples). Flags: --port N, --public (bind 0.0.0.0).
#   Compose project, volumes and network are all "grabcode-staging*", so production containers/volumes/ports are never touched.
# Without shared mode it refuses to run when .env.production exists: a standalone staging owns 80/443 and must not share a host.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="$ROOT/.env.staging"
PROJECT="grabcode-staging"
PROD_PROJECT="grabcode" # `name:` in docker-compose.prod.yml
die() { echo "staging-up: $*" >&2; exit 1; }
warn() { echo "staging-up: WARNING: $*" >&2; }

PORT_ARG=""; BIND_ARG=""; POSITIONAL=()
while [ $# -gt 0 ]; do
  case "$1" in
    --port) [ $# -ge 2 ] || die "--port needs a value."; PORT_ARG="$2"; shift 2;;
    --port=*) PORT_ARG="${1#--port=}"; shift;;
    --public) BIND_ARG="0.0.0.0"; shift;;
    -h|--help) sed -n '2,13p' "${BASH_SOURCE[0]}"; exit 0;;
    -*) die "unknown flag $1";;
    *) POSITIONAL+=("$1"); shift;;
  esac
done
set -- ${POSITIONAL[@]+"${POSITIONAL[@]}"}

command -v docker >/dev/null || die "Docker is not installed (curl -fsSL https://get.docker.com | sh)."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is missing (the 'docker compose' command)."

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
# Set KEY=VALUE unconditionally (for values this script owns).
forceenv() {
  if grep -qE "^$1=" "$ENV_FILE"; then sed -i.bak "s|^$1=.*|$1=$2|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"; else echo "$1=$2" >>"$ENV_FILE"; fi
}

if [ ! -f "$ENV_FILE" ]; then
  cp infra/deploy/env.staging.example "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created .env.staging (generated secrets, never committed)."
fi
DOMAIN_ARG="${1:-${DOMAIN:-}}"
CURRENT_DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
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

# A missing key prints nothing. `|| true`: under pipefail grep's "no match" would otherwise kill the script without a message.
get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
[ "$(get APP_ENV)" = "staging" ] || die ".env.staging must contain APP_ENV=staging."
[ "$(get AUTH_DEV_LOGIN)" = "true" ] || die ".env.staging must contain AUTH_DEV_LOGIN=true (the seed and the smoke scripts need it)."

# ---- Shared-VPS mode ----
SHARED=0
STAGING_HTTP_PORT="${PORT_ARG:-${STAGING_HTTP_PORT:-$(get STAGING_HTTP_PORT)}}"
if [ -n "$STAGING_HTTP_PORT" ] || [ -f "$ROOT/.env.production" ]; then SHARED=1; STAGING_HTTP_PORT="${STAGING_HTTP_PORT:-18080}"; fi
if [ "$SHARED" = 1 ]; then
  case "$STAGING_HTTP_PORT" in ''|*[!0-9]*) die "port must be a number, got '$STAGING_HTTP_PORT'.";; esac
  { [ "$STAGING_HTTP_PORT" -ge 1024 ] && [ "$STAGING_HTTP_PORT" -le 65535 ]; } || die "port must be 1024-65535 (80/443 belong to the production proxy)."
  [ "$DOMAIN_VALUE" != "localhost" ] || die "shared-VPS mode needs the real domain (it is baked into the web build): staging-up.sh --port $STAGING_HTTP_PORT staging.example.com"
  [ -n "$BIND_ARG" ] || BIND_ARG="$(get STAGING_BIND)"
  BIND_ARG="${BIND_ARG:-127.0.0.1}"
  forceenv STAGING_HTTP_PORT "$STAGING_HTTP_PORT"
  forceenv STAGING_BIND "$BIND_ARG"
  # Two proxies in front of core-api: the operator's proxy, then our Caddy.
  forceenv TRUST_PROXY 2
  # Source ranges whose X-Forwarded-* our Caddy believes. Docker NAT shows the operator's proxy as a private (bridge) address.
  setenv STAGING_TRUSTED_PROXIES private_ranges
  # Shared mode must stay completely apart from production.
  [ "$PROJECT" != "$PROD_PROJECT" ] || die "staging project name collides with production ($PROD_PROJECT)."
  for v in pgdata natsdata caddy_data caddy_config; do
    if docker volume ls -q --filter "label=com.docker.compose.project=$PROD_PROJECT" | grep -qx "${PROJECT}_$v"; then
      die "volume ${PROJECT}_$v belongs to the production project: refusing."
    fi
  done
  other="$(docker ps -a --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Label "com.docker.compose.project.working_dir"}}' | grep -vxF -e "$ROOT" -e "$ROOT/infra/deploy" | head -1 || true)"  # compose labels the first -f file's folder
  [ -z "$other" ] || die "a '$PROJECT' stack already exists from another checkout ($other): remove it or run from that folder."
else
  [ -f "$ROOT/.env.production" ] && die ".env.production exists here: this looks like a production host. Use shared-VPS mode: staging-up.sh --port 18080 <domain>"
  [ "$(get TRUST_PROXY)" != "2" ] || forceenv TRUST_PROXY 1
fi

export GC_ENV_FILE="$ENV_FILE"
FILES=(-f infra/deploy/docker-compose.prod.yml -f infra/deploy/docker-compose.staging.yml)
[ "$SHARED" = 1 ] && FILES+=(-f infra/deploy/docker-compose.staging-shared.yml)
dc() { docker compose -p "$PROJECT" --env-file "$ENV_FILE" "${FILES[@]}" "$@"; }

if [ "$SHARED" = 1 ]; then
  # `!override` in the overlay needs Compose >= 2.24.
  cv="$(docker compose version --short 2>/dev/null | sed 's/^v//')"
  case "$cv" in
    0.*|1.*|2.[0-9].*|2.1[0-9].*|2.2[0-3].*) die "Docker Compose $cv is too old for shared-VPS mode (need >= 2.24). Update the compose plugin.";;
  esac
  # The port must be free, unless it is our own staging Caddy from a previous run.
  if (exec 3<>"/dev/tcp/127.0.0.1/$STAGING_HTTP_PORT") 2>/dev/null; then
    dc port caddy 80 2>/dev/null | grep -q ":$STAGING_HTTP_PORT\$" || die "port $STAGING_HTTP_PORT is already in use by another process. Pick a free one: --port <port>."
  fi
  # The build needs ~3 GB RAM. Warn only: the operator may know better.
  mem_kb="$(awk '/^MemAvailable:/{print $2}' /proc/meminfo 2>/dev/null || true)"; swap_kb="$(awk '/^SwapFree:/{print $2}' /proc/meminfo 2>/dev/null || true)"
  free_mb=$(( (${mem_kb:-0} + ${swap_kb:-0}) / 1024 ))
  if [ "$free_mb" -lt 3500 ]; then
    warn "only ${free_mb} MB of RAM+swap is free; the first build needs ~3 GB and production is running on this host. Add swap first: sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile (docs/STAGING.md, 'Chạy trên VPS đang có production')."
  fi
  # One image at a time on the classic builder (the parallel bake builder ignores the limit): keeps peak RAM down.
  export COMPOSE_PARALLEL_LIMIT=1 COMPOSE_BAKE=false
fi

# Every rebuild leaves the previous staging images untagged (several GB each time). Remove only those:
# untagged images built for this project and not used by any container. Production images are never touched.
prune_staging_images() {
  docker image prune -f --filter "label=com.docker.compose.project=$PROJECT" >/dev/null 2>&1 || true
  local id
  for id in ${OLD_IMAGES:-}; do
    [ "$(docker image inspect -f '{{len .RepoTags}}' "$id" 2>/dev/null || echo 1)" = "0" ] && docker image rm "$id" >/dev/null 2>&1 || true
  done
}
OLD_IMAGES="$(docker images -q --filter "reference=${PROJECT}-*" | sort -u | tr '\n' ' ')"
prune_staging_images
DOCKER_ROOT="$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"
avail_kb="$(df -Pk "$DOCKER_ROOT" 2>/dev/null | awk 'NR==2{print $4}' || true)"
free_gb=$(( ${avail_kb:-0} / 1024 / 1024 ))
if [ -n "$avail_kb" ] && [ "$free_gb" -lt 5 ]; then
  docker system df >&2 || true
  die "only ${free_gb} GB free on the disk holding $DOCKER_ROOT; the build needs ~5 GB. Free space first, e.g. 'docker builder prune -f' (build cache only: no container, image in use or volume is removed), then deploy again."
fi

echo "== Building and starting (first build takes 10-20 minutes; needs ~3 GB RAM, add swap on a small VPS) =="
dc up -d --build
prune_staging_images

echo "== Waiting for core-api =="
for _ in $(seq 1 60); do
  if dc exec -T core-api node -e "fetch('http://localhost:4000/v1/auth/providers').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then ready=1; break; fi
  sleep 3
done
[ "${ready:-}" = "1" ] || { dc logs --tail 40 core-api migrate; die "core-api did not become healthy in 3 minutes."; }

echo "== Loading demo data (skipped when it already exists) =="
# --no-deps: core-api is already up and healthy. Without it `run` re-resolves depends_on and may recreate
# migrate + core-api, so the seed hits a restarting API (ECONNREFUSED).
dc run --rm --no-deps -T seed

DOM="$(get DOMAIN)"
if [ "$SHARED" = 1 ]; then
  cat <<EOF

Cổng để map domain: $STAGING_HTTP_PORT   (HTTP thuần, nghe tại $(get STAGING_BIND):$STAGING_HTTP_PORT; TLS do reverse proxy của bạn lo)

nginx (server block của $DOM, đã có chứng chỉ TLS):
    # ở cấp http{}:  map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }
    location / {
        proxy_pass http://127.0.0.1:$STAGING_HTTP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
    }

Caddy (tự lo HTTPS, giữ Host và X-Forwarded-* mặc định):
    $DOM {
        reverse_proxy 127.0.0.1:$STAGING_HTTP_PORT
    }

Phải giữ nguyên Host và X-Forwarded-Proto=https. Nếu proxy của bạn chạy trong container, dùng --public
(bind 0.0.0.0, chặn cổng $STAGING_HTTP_PORT từ internet bằng firewall) hoặc trỏ tới IP bridge của docker.
EOF
fi
# Secrets only on an interactive terminal: under GitHub Actions stdout is not a TTY and the log of a public repo is public.
if [ -t 1 ]; then PW="$(get DEMO_PASSWORD)"; KEY="$(get STAGING_DEV_LOGIN_KEY)"
else PW="(xem DEMO_PASSWORD trong $ENV_FILE)"; KEY="<STAGING_DEV_LOGIN_KEY trong $ENV_FILE>"; fi
cat <<EOF

Staging is up.
  Customer site  https://$DOM
  Freelancer app https://$DOM/coder
  Admin          https://$DOM/admin
  Password of all demo accounts: $PW
  Smoke / E2E:   API_URL=https://$DOM DEV_LOGIN_KEY=$KEY node api/core-api/scripts/smoke-mvp.mjs
Demo script and troubleshooting: docs/STAGING.md
EOF
