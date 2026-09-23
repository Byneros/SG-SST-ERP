#!/usr/bin/env bash
# Bootstrap de la VM para SG-SST ERP (staging/produccion).
#
# Prepara un Ubuntu 22.04/24.04 recien creado para correr docker-compose.prod.yml:
#   1. Docker Engine 24+ con compose v2 (get.docker.com).
#   2. Caddy desde el repo oficial (TLS automatico Let's Encrypt).
#   3. Firewall (ufw): solo 22/80/443 abiertos. La API y la web del compose
#      publican en 127.0.0.1; NUNCA deben quedar expuestas a Internet.
#   4. /opt/sgsst con docker-compose.prod.yml y .env de referencia.
#
# Uso (desde el repo clonado o tras scp de deploy/):
#   sudo bash deploy/bootstrap-vm.sh
#
# Opcional: instalar y activar el Caddyfile con los hostnames reales
# (deben resolver a la IP publica de esta VM ANTES de ejecutar):
#   sudo SGSST_APP_HOST=app.203.0.113.10.sslip.io \
#        SGSST_API_HOST=api.203.0.113.10.sslip.io \
#        bash deploy/bootstrap-vm.sh
#
# Flags:
#   --skip-caddy      no instalar Caddy (p. ej. balanceador gestionado del proveedor)
#   --skip-firewall   no tocar ufw (gestionar firewall en el panel del proveedor)
#
# Idempotente: se puede re-ejecutar sin romper nada.
#
# Probable tambien en un CONTENEDOR (prueba del script sin VM):
#   docker run --rm -it --privileged -p 8080:8080 -p 3001:3001 \
#     -v "$(pwd)/deploy:/repo/deploy" -v "$(pwd)/docker-compose.prod.yml:/repo/docker-compose.prod.yml:ro" \
#     ubuntu:22.04 bash /repo/deploy/bootstrap-vm.sh --skip-firewall
#   (--privileged para el daemon de Docker; dentro no hay systemd y el script
#   lo detecta y salta systemctl; el firewall se gestiona en el host, no en el
#   contenedor, por eso --skip-firewall. Quitar -p si el firewall del host ya
#   cubre esos puertos.)

set -euo pipefail

APP_HOST="${SGSST_APP_HOST:-}"
API_HOST="${SGSST_API_HOST:-}"
SKIP_CADDY=false
SKIP_FIREWALL=false
SGSST_DIR="/opt/sgsst"

for arg in "$@"; do
  case "$arg" in
    --skip-caddy) SKIP_CADDY=true ;;
    --skip-firewall) SKIP_FIREWALL=true ;;
    *) echo "Flag desconocido: $arg (uso: --skip-caddy, --skip-firewall)" >&2; exit 1 ;;
  esac
done

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. Precondiciones
# ---------------------------------------------------------------------------
log "Precondiciones"

[[ $EUID -eq 0 ]] || die "Ejecutar como root o con sudo: sudo bash deploy/bootstrap-vm.sh"

if [[ -r /etc/os-release ]]; then
  . /etc/os-release
else
  die "No se pudo leer /etc/os-release"
fi
case "${ID:-}" in
  ubuntu|debian) log "OS detectado: ${PRETTY_NAME:-$ID}" ;;
  *) warn "OS no probado (${PRETTY_NAME:-desconocido}); se continúa bajo tu responsabilidad" ;;
esac
command -v apt-get >/dev/null || die "Se requiere apt-get (Ubuntu/Debian)"

command -v curl >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null; }

# Detectar la IP publica para mostrarla en los mensajes finales.
# (En contenedores sin salida a Internet o en VMs sin IP publica, queda como
# placeholder informativo y no bloquea el bootstrap.)
PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo '<no-detectada>')"

# Deteccion de systemd: en contenedores no existe y hay que saltar systemctl.
HAVE_SYSTEMD=false
if command -v systemctl >/dev/null 2>&1 && [ "$(ps -p 1 -o comm= 2>/dev/null)" = "systemd" ]; then
  HAVE_SYSTEMD=true
fi
if [[ "$HAVE_SYSTEMD" == false ]]; then
  warn "systemd no disponible (¿contenedor?): se omite systemctl; los servicios
     (docker/caddy) deberan arrancarse manualmente si se usan."
fi

# ---------------------------------------------------------------------------
# 1. Docker Engine + compose v2
# ---------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  log "Docker ya instalado: $(docker --version)"
else
  log "Instalando Docker Engine (get.docker.com)"
  curl -fsSL https://get.docker.com | sh
fi

if [[ "$HAVE_SYSTEMD" == true ]]; then
  systemctl enable --now docker >/dev/null 2>&1 || true
else
  # Contenedor: el daemon ya puede estar corriendo (docker-in-docker) o no;
  # no falla aqui: compose version valida de una y da un error claro si falta.
  docker info >/dev/null 2>&1 || warn "dockerd no esta corriendo; en una VM real lo
     arranca systemd. En contenedor: dockerd > /dev/null 2>&1 &"
fi

docker compose version >/dev/null 2>&1 \
  || die "docker compose v2 no disponible; revisar instalacion de Docker"

log "Docker compose: $(docker compose version --short)"

# ---------------------------------------------------------------------------
# 2. Caddy (repo oficial)
# ---------------------------------------------------------------------------
if [[ "$SKIP_CADDY" == true ]]; then
  warn "--skip-caddy: no se instala Caddy (asumimos balanceador gestionado)"
elif command -v caddy >/dev/null 2>&1; then
  log "Caddy ya instalado: $(caddy version)"
else
  log "Instalando Caddy desde el repositorio oficial"
  apt-get update -qq
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
  if [[ "$HAVE_SYSTEMD" == true ]]; then
    systemctl enable --now caddy >/dev/null 2>&1 || true
  else
    warn "systemd ausente: arranca caddy manual si lo necesitas (caddy run --config /etc/caddy/Caddyfile)"
  fi
  log "Caddy instalado: $(caddy version)"
fi

# ---------------------------------------------------------------------------
# 3. Firewall: solo 22/80/443
# ---------------------------------------------------------------------------
if [[ "$SKIP_FIREWALL" == true ]]; then
  warn "--skip-firewall: configurar reglas equivalentes en el panel del proveedor
     (permitir 22, 80, 443; bloquear 3001 y 8080 desde Internet)"
else
  log "Configurando ufw (22/80/443 abiertos, resto denegado)"
  apt-get install -y -qq ufw >/dev/null
  ufw default deny incoming  >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow OpenSSH   >/dev/null
  ufw allow 80/tcp    >/dev/null   # HTTP  (Caddy: desafio ACME + redirect)
  ufw allow 443/tcp   >/dev/null   # HTTPS (Caddy)
  # Nunca exponer los puertos de la API/web/postgres: solo escuchan en 127.0.0.1,
  # pero dejamos la regla explicita de rechazo por defensa en profundidad.
  # (5432 es el tunel de migraciones del workflow; solo 127.0.0.1 + SSH.)
  ufw deny 3001/tcp   >/dev/null
  ufw deny 8080/tcp   >/dev/null
  ufw deny 5432/tcp   >/dev/null
  if ufw status | grep -q "Status: active"; then
    ufw reload >/dev/null
  else
    ufw --force enable >/dev/null
  fi
  ufw status verbose | sed 's/^/    /'
fi

# ---------------------------------------------------------------------------
# 4. /opt/sgsst con compose y .env de referencia
# ---------------------------------------------------------------------------
log "Preparando ${SGSST_DIR}"
mkdir -p "${SGSST_DIR}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${REPO_DIR}/docker-compose.prod.yml" ]]; then
  cp -f "${REPO_DIR}/docker-compose.prod.yml" "${SGSST_DIR}/docker-compose.prod.yml"
  log "Copiado docker-compose.prod.yml -> ${SGSST_DIR}/"
elif [[ ! -f "${SGSST_DIR}/docker-compose.prod.yml" ]]; then
  warn "No encontre docker-compose.prod.yml junto al script; copialo manualmente a ${SGSST_DIR}/"
fi

if [[ ! -f "${SGSST_DIR}/.env" ]]; then
  if [[ -f "${REPO_DIR}/deploy/staging.env.example" ]]; then
    cp "${REPO_DIR}/deploy/staging.env.example" "${SGSST_DIR}/.env"
    chmod 600 "${SGSST_DIR}/.env"
    warn "Creado ${SGSST_DIR}/.env desde el ejemplo: EDITALO con los secretos reales
       (POSTGRES_PASSWORD, JWT_SECRET, METRICS_TOKEN, URLs, IMAGE_TAG del release)."
  else
    warn "No encontre deploy/staging.env.example; crea ${SGSST_DIR}/.env a mano"
  fi
else
  log "${SGSST_DIR}/.env ya existe: no se sobreescribe"
fi

# ---------------------------------------------------------------------------
# 5. Caddyfile con hostnames reales (opcional)
# ---------------------------------------------------------------------------
if [[ "$SKIP_CADDY" != true ]]; then
  if [[ -n "$APP_HOST" && -n "$API_HOST" ]]; then
    log "Instalando Caddyfile para ${APP_HOST} / ${API_HOST}"

    for host in "$APP_HOST" "$API_HOST"; do
      HOST_IP="$(getent hosts "$host" | awk '{print $1; exit}')"
      if [[ -z "$HOST_IP" ]]; then
        die "El hostname ${host} no resuelve en DNS. Configuralo antes de re-ejecutar."
      fi
      if [[ "$HOST_IP" != "$PUBLIC_IP" ]]; then
        warn "${host} resuelve a ${HOST_IP}, pero la IP publica de esta VM parece ser ${PUBLIC_IP}.
           Let's Encrypt fallara si el DNS no apunta aqui. Continuamos de todos modos."
      fi
    done

    [[ -f "${REPO_DIR}/deploy/caddy/Caddyfile" ]] \
      || die "No encontre deploy/caddy/Caddyfile en el repo"

    sed -e "s/app\.STAGING_HOST/${APP_HOST}/g" \
        -e "s/api\.STAGING_HOST/${API_HOST}/g" \
        "${REPO_DIR}/deploy/caddy/Caddyfile" > /etc/caddy/Caddyfile

    caddy validate --config /etc/caddy/Caddyfile >/dev/null \
      || die "El Caddyfile generado no es valido"
    systemctl reload caddy 2>/dev/null || systemctl restart caddy
    log "Caddy activo con ${APP_HOST} -> 127.0.0.1:8080 y ${API_HOST} -> 127.0.0.1:3001"
  else
    warn "Sin SGSST_APP_HOST/SGSST_API_HOST: Caddy corre con config vacia.
       Cuando tengas los hostnames, re-ejecuta:
         sudo SGSST_APP_HOST=app.<host> SGSST_API_HOST=api.<host> bash deploy/bootstrap-vm.sh"
  fi
fi

# ---------------------------------------------------------------------------
# Resumen: proximos pasos
# ---------------------------------------------------------------------------
log "Bootstrap completo. Proximos pasos en esta VM:"
cat <<RESUMEN

  1. Editar ${SGSST_DIR}/.env con los secretos y el IMAGE_TAG del release:
         sudo nano ${SGSST_DIR}/.env
  2. Autenticarse contra GHCR (PAT con read:packages):
         echo "<PAT>" | docker login ghcr.io -u <usuario-github> --password-stdin
  3. Levantar la pila (migraciones NO: las aplica el workflow de release):
         cd ${SGSST_DIR}
         docker compose -f docker-compose.prod.yml pull
         docker compose -f docker-compose.prod.yml up -d
  4. Verificar:
         curl -fsS http://127.0.0.1:3001/api/v1/health
         curl -fsS http://127.0.0.1:8080/ -I
  5. Si Caddy ya tiene hostnames: https://${APP_HOST:-app.TU_HOST} y https://${API_HOST:-api.TU_HOST}

IP publica de esta VM: ${PUBLIC_IP} (apunta ahi los DNS de app/api si usas sslip.io/nip.io).
Guia completa: docs/despliegue-cloud.md
RESUMEN
