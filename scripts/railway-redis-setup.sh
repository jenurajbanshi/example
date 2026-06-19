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
  RAILWAY_SKIP_DEPLOYS        Set variables without triggering Railway deploys.
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
skip_deploys="${RAILWAY_SKIP_DEPLOYS:-false}"
cors_origin="${CORS_ORIGIN:-*}"
redis_url_ref="\${{${redis_service}.REDIS_URL}}"

set_server_variable() {
  if [[ "$skip_deploys" == "true" ]]; then
    railway variable set "$1" --service "$server_service" --skip-deploys
  else
    railway variable set "$1" --service "$server_service"
  fi
}

if [[ "$skip_redis_create" == "true" ]]; then
  echo "Skipping Redis creation; using existing Railway service: $redis_service"
else
  echo "Creating Railway Redis database service..."
  railway add --database redis --yes
fi

echo "Configuring server service variables for: $server_service"
set_server_variable NODE_ENV=production
set_server_variable HOST=0.0.0.0
set_server_variable TRUST_PROXY=true
set_server_variable "REDIS_URL=$redis_url_ref"
set_server_variable REDIS_KEY_PREFIX=orbital-estates
set_server_variable GAME_TTL_SECONDS=86400
set_server_variable "CORS_ORIGIN=$cors_origin"

echo "Redis is wired. Redeploy the server, then check /health for storage=redis."
