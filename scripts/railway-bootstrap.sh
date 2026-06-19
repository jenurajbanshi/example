#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  npm run railway:bootstrap -- [server-service-name] [web-service-name]

This runs the production Railway setup after the server and web GitHub
services already exist in a linked Railway project.

Environment variables:
  RAILWAY_SERVER_SERVICE      Server service name if no first argument is passed.
                              Default: Orbital Estates Server
  RAILWAY_WEB_SERVICE         Web service name if no second argument is passed.
                              Default: Orbital Estates Web
  RAILWAY_REDIS_SERVICE       Redis service name used in the reference variable.
                              Default: Redis
  RAILWAY_SKIP_REDIS_CREATE   Set to true when Redis already exists.
                              Default: false
  RAILWAY_GENERATE_DOMAINS    Generate Railway public domains.
                              Default: true
  RAILWAY_REDEPLOY            Redeploy server and web after wiring variables.
                              Default: true
  SERVER_PUBLIC_URL           Custom server URL for the web build.
  WEB_PUBLIC_URL              Custom web URL for server CORS.

Before running:
  railway login
  railway link
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

server_service="${1:-${RAILWAY_SERVER_SERVICE:-Orbital Estates Server}}"
web_service="${2:-${RAILWAY_WEB_SERVICE:-Orbital Estates Web}}"
redeploy="${RAILWAY_REDEPLOY:-true}"

export RAILWAY_SKIP_DEPLOYS=true

bash scripts/railway-redis-setup.sh "$server_service"
RAILWAY_REDEPLOY="$redeploy" bash scripts/railway-domain-sync.sh "$server_service" "$web_service"

echo "Bootstrap complete. Run a smoke test with the actual public domains:"
echo "npm run railway:smoke -- https://<server-domain> https://<web-domain>"
