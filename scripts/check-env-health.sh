#!/usr/bin/env bash
# Verifica la salud del entorno SG-SST local (compose dev) y del stack de prod
# (sgsst_prod_*), usando los puertos de cada ambiente.
#
# Uso:
#   bash scripts/check-env-health.sh [API_DEV] [WEB_DEV] [API_PROD] [WEB_PROD]
#   (por defecto: 3002/5176 dev, 3001/8080 prod)
#
# Codigo de salida 0 si todos los endpoints responden, 1 si alguno falla.
set -u

API_DEV="${1:-3002}"
WEB_DEV="${2:-5176}"
API_PROD="${3:-3001}"
WEB_PROD="${4:-8080}"

fail=0

check() {
  local name="$1" url="$2"
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
    echo "OK    $name -> $url"
  else
    echo "FAIL  $name -> $url"
    fail=1
  fi
}

echo "== Stack dev (docker compose) =="
check "API dev   /health" "http://localhost:${API_DEV}/api/v1/health"
check "Web dev   /"       "http://localhost:${WEB_DEV}/"

echo "== Stack prod (sgsst_prod_*) =="
check "API prod  /health" "http://localhost:${API_PROD}/api/v1/health"
check "Web prod  /"       "http://localhost:${WEB_PROD}/"

exit "$fail"
