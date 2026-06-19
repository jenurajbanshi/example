#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  npm run railway:sync:domains -- [server-service-name] [web-service-name]

Environment variables:
  RAILWAY_SERVER_SERVICE    Server service name if no first argument is passed.
                            Default: Orbital Estates Server
  RAILWAY_WEB_SERVICE       Web service name if no second argument is passed.
                            Default: Orbital Estates Web
  RAILWAY_GENERATE_DOMAINS  Generate Railway public domains before wiring vars.
                            Default: true
  RAILWAY_SKIP_DEPLOYS      Set variables without triggering Railway deploys.
                            Default: false
  RAILWAY_REDEPLOY          Redeploy server and web after variables are set.
                            Default: false
  SERVER_PUBLIC_URL         Override web EXPO_PUBLIC_SERVER_URL.
                            Default: https://${{<server-service>.RAILWAY_PUBLIC_DOMAIN}}
  WEB_PUBLIC_URL            Override server CORS_ORIGIN.
                            Default: https://${{<web-service>.RAILWAY_PUBLIC_DOMAIN}}

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
web_service="${2:-${RAILWAY_WEB_SERVICE:-Orbital Estates Web}}"
generate_domains="${RAILWAY_GENERATE_DOMAINS:-true}"
skip_deploys="${RAILWAY_SKIP_DEPLOYS:-false}"
redeploy="${RAILWAY_REDEPLOY:-false}"
server_public_url="${SERVER_PUBLIC_URL:-https://\${{${server_service}.RAILWAY_PUBLIC_DOMAIN}}}"
web_public_url="${WEB_PUBLIC_URL:-https://\${{${web_service}.RAILWAY_PUBLIC_DOMAIN}}}"

set_service_variable() {
  local service="$1"
  local variable="$2"

  if [[ "$skip_deploys" == "true" ]]; then
    railway variable set "$variable" --service "$service" --skip-deploys
  else
    railway variable set "$variable" --service "$service"
  fi
}

if [[ "$generate_domains" == "true" ]]; then
  if [[ -z "${SERVER_PUBLIC_URL:-}" ]]; then
    echo "Ensuring Railway public domain exists for: $server_service"
    railway domain --service "$server_service" --json >/dev/null
  fi

  if [[ -z "${WEB_PUBLIC_URL:-}" ]]; then
    echo "Ensuring Railway public domain exists for: $web_service"
    railway domain --service "$web_service" --json >/dev/null
  fi
fi

echo "Setting web EXPO_PUBLIC_SERVER_URL to: $server_public_url"
set_service_variable "$web_service" "EXPO_PUBLIC_SERVER_URL=$server_public_url"

echo "Setting server CORS_ORIGIN to: $web_public_url"
set_service_variable "$server_service" "CORS_ORIGIN=$web_public_url"

if [[ "$redeploy" == "true" ]]; then
  echo "Redeploying web service: $web_service"
  railway redeploy --service "$web_service" --yes

  echo "Redeploying server service: $server_service"
  railway redeploy --service "$server_service" --yes
else
  echo "Domain variables are wired. Redeploy the server and web services to apply them."
fi
