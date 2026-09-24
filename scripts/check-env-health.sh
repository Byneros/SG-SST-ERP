#!/usr/bin/env bash
# Verifica la salud del entorno SG-SST local (compose dev) y del stack de prod
# (sgsst_prod_*), usando los puertos de cada ambiente.
#
# Uso:
#   bash scripts/check-env-health.sh [API_DEV|skip] [WEB_DEV|skip] [API_PROD|skip] [WEB_PROD|skip]
#   (por defecto: 3002/5176 dev, 3001/8080 prod)
#   El valor especial "skip" omite ese endpoint (util en CI, donde solo
#   corre el stack de compose y no hay prod local).
#
# Codigo de salida 0 si todos los endpoints responden, 1 si alguno falla.
set -u

API_DEV="${1:-3002}"
WEB_DEV="${2:-5176}"
API_PROD="${3:-3001}"
WEB_PROD="${4:-8080}"

fail=0

url_api() {
  if [ "$1" = "skip" ]; then printf 'skip'; return; fi
  printf 'http://localhost:%s/api/v1/health' "$1"
}
url_web() {
  if [ "$1" = "skip" ]; then printf 'skip'; return; fi
  printf 'http://localhost:%s/' "$1"
}

check() {
  local name="$1" url="$2"
  if [ "$url" = "skip" ]; then
    echo "SKIP  $name"
    return 0
  fi
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
    echo "OK    $name -> $url"
  else
    echo "FAIL  $name -> $url"
    fail=1
  fi
}

echo "== Stack dev (docker compose) =="
check "API dev   /health" "$(url_api "$API_DEV")"
check "Web dev   /"       "$(url_web "$WEB_DEV")"

echo "== Stack prod (sgsst_prod_*) =="
check "API prod  /health" "$(url_api "$API_PROD")"
check "Web prod  /"       "$(url_web "$WEB_PROD")"

exit "$fail"
