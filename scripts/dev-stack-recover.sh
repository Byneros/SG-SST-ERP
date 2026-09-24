#!/usr/bin/env bash
# Detecta contenedores del compose dev que quedaron fuera de la red del
# proyecto (sintoma: la API loguea "getaddrinfo EAI_AGAIN postgres/redis" y el
# healthcheck entra en loop) y recrea el stack automaticamente.
#
# Causa conocida: mezclar `docker start/stop` de contenedores individuales con
# `docker compose up` en Docker Desktop/Windows deja contenedores corriendo sin
# interfaz en la red del proyecto. Recuperacion: `compose down` + `up`
# (los volumenes y datos se conservan).
#
# Uso: bash scripts/dev-stack-recover.sh
set -u

cd "$(dirname "$0")/.." || exit 1

services=${SGSST_SERVICES:-api worker web postgres redis}
reference=postgres

# La red del proyecto se toma de postgres (contenedor de referencia, siempre
# presente cuando el stack levanto completo).
net="$(docker inspect "sgsst_${reference}" --format '{{range $k, $_ := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)"
if [ -z "$net" ]; then
  echo "sgsst_${reference} no esta corriendo; no hay stack dev que recuperar."
  echo "Levantar con: docker compose up -d"
  exit 1
fi

broken=""
for svc in $services; do
  container="sgsst_${svc}"
  running="$(docker inspect "$container" --format '{{.State.Running}}' 2>/dev/null)"
  [ "$running" = "true" ] || continue
  attached="$(docker inspect "$container" --format '{{range $k, $_ := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)"
  case " $attached " in
    *" $net "*) ;;
    *) broken="$broken $svc" ;;
  esac
done

if [ -z "$broken" ]; then
  echo "OK: los contenedores del compose dev estan en la red $net"
  exit 0
fi

echo "Contenedores corriendo fuera de la red $net:$broken"
echo "Recreando el stack dev (los datos se conservan)..."
docker compose down
docker compose up -d
echo "Stack dev recreado. Verificar con: bash scripts/check-env-health.sh"
