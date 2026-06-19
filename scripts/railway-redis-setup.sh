#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  npm run railway:setup:redis -- [server-service-name]

Environment variables:
  RAILWAY_SERVER_SERVICE      Server service name if no argument is passed.
                              Default: Orbital Estates Server
  RAILWAY_REDIS_SERVICE       Redis service name used in the reference variable.
                              Default: Redis
  RAILWAY_SKIP_REDIS_CREATE   Set to true when Redis already exists.
                              Default: false
  CORS_ORIGIN                 Initial server CORS origin.
                              Default: *

Before running:
  railway login
  railway link
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI is required. Install it with: npm i -g @railway/cli" >&2
  exit 1
fi

if ! railway status >/dev/null 2>&1; then
  echo "This directory is not linked to a Railway project. Run: railway login && railway link" >&2
  exit 1
fi

server_service="${1:-${RAILWAY_SERVER_SERVICE:-Orbital Estates Server}}"
redis_service="${RAILWAY_REDIS_SERVICE:-Redis}"
skip_redis_create="${RAILWAY_SKIP_REDIS_CREATE:-false}"
cors_origin="${CORS_ORIGIN:-*}"
redis_url_ref="\${{${redis_service}.REDIS_URL}}"

if [[ "$skip_redis_create" == "true" ]]; then
  echo "Skipping Redis creation; using existing Railway service: $redis_service"
else
  echo "Creating Railway Redis database service..."
  railway add --database redis --yes
fi

echo "Configuring server service variables for: $server_service"
railway variable set NODE_ENV=production --service "$server_service"
railway variable set HOST=0.0.0.0 --service "$server_service"
railway variable set TRUST_PROXY=true --service "$server_service"
railway variable set REDIS_URL="$redis_url_ref" --service "$server_service"
railway variable set REDIS_KEY_PREFIX=orbital-estates --service "$server_service"
railway variable set GAME_TTL_SECONDS=86400 --service "$server_service"
railway variable set CORS_ORIGIN="$cors_origin" --service "$server_service"

echo "Redis is wired. Redeploy the server, then check /health for storage=redis."
