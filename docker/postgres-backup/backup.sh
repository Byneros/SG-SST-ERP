#!/bin/sh
# Ciclo de backups PostgreSQL: dump custom -> cifrado age -> subida S3
# (rclone) -> manifiesto con checksum -> retencion -> alerta de obsolescencia.
# Config por variables de entorno (ver docker-compose.yml y .env.example).
set -eu

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
STALENESS_HOURS="${BACKUP_STALENESS_HOURS:-24}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${POSTGRES_DB:-sgsst}"
PGHOST="${PGHOST:-postgres}"
PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $*"; }
fail() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*"; }

# Credenciales S3: BACKUP_S3_* con fallback a las del driver de documentos.
S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-${S3_ENDPOINT:-}}"
S3_BUCKET="${BACKUP_S3_BUCKET:-${S3_BUCKET:-}}"
S3_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-${S3_ACCESS_KEY_ID:-}}"
S3_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:-${S3_SECRET_ACCESS_KEY:-}}"
S3_FORCE_PATH_STYLE="${BACKUP_S3_FORCE_PATH_STYLE:-true}"
AGE_PUBLIC_KEY="${BACKUP_ENCRYPTION_PUBLIC_KEY:-}"

use_s3() { [ -n "$S3_ENDPOINT" ] && [ -n "$S3_BUCKET" ] && [ -n "$S3_ACCESS_KEY_ID" ]; }
use_age() { [ -n "$AGE_PUBLIC_KEY" ]; }

# Remoto rclone configurado por entorno (sin archivos de configuracion).
RCLONE_REMOTE="backup"
export RCLONE_CONFIG_BACKUP_TYPE=s3
export RCLONE_CONFIG_BACKUP_PROVIDER=Other
export RCLONE_CONFIG_BACKUP_ENDPOINT="$S3_ENDPOINT"
export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_BACKUP_FORCE_PATH_STYLE="$S3_FORCE_PATH_STYLE"

# Registra el artefacto guardado: fecha, archivo, sha256, tamano en bytes.
manifest() {
  printf '%s\t%s\t%s\t%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$1" "$2" "$3" >> "$BACKUP_DIR/manifest.tsv"
}

wait_for_db() {
  until pg_isready -h "$PGHOST" -U "$PGUSER" -d "$DB_NAME" >/dev/null 2>&1; do
    log "Esperando a PostgreSQL en $PGHOST..."
    sleep 5
  done
}

remote_size() {
  rclone lsjson "$RCLONE_REMOTE:$S3_BUCKET/$1" 2>/dev/null | grep -o '"Size":[0-9]*' | head -1 | cut -d: -f2
}

run_cycle() {
  wait_for_db

  STAMP=$(date +%Y%m%d_%H%M%S)
  DUMP_FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.dump"
  log "Creando backup: $(basename "$DUMP_FILE")"
  pg_dump \
    --host="$PGHOST" \
    --username="$PGUSER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="$DUMP_FILE"

  # Validacion del dump antes de cifrarlo/subirlo.
  pg_restore --list "$DUMP_FILE" >/dev/null

  # Cifrado en reposo: solo se conserva el artefacto cifrado si hay clave.
  if use_age; then
    age -r "$AGE_PUBLIC_KEY" -o "$DUMP_FILE.age" "$DUMP_FILE"
    rm -f "$DUMP_FILE"
    STORED="$DUMP_FILE.age"
    log "Backup cifrado con age"
  else
    STORED="$DUMP_FILE"
  fi

  STORED_NAME=$(basename "$STORED")
  SHA=$(sha256sum "$STORED" | cut -d' ' -f1)
  SIZE=$(wc -c < "$STORED" | tr -d ' ')
  manifest "$STORED_NAME" "$SHA" "$SIZE"

  if use_s3; then
    rclone mkdir "$RCLONE_REMOTE:$S3_BUCKET" || warn "No se pudo asegurar el bucket $S3_BUCKET (puede existir)"

    DEST="$RCLONE_REMOTE:$S3_BUCKET/$STORED_NAME"
    rclone copyto "$STORED" "$DEST"

    # Verificacion post-subida: el tamano remoto debe coincidir con el local.
    REMOTE_SIZE=$(remote_size "$STORED_NAME")
    if [ "$REMOTE_SIZE" != "$SIZE" ]; then
      fail "Verificacion de subida fallo (remoto=${REMOTE_SIZE:-none} local=$SIZE)"
      return 1
    fi
    rclone copyto "$BACKUP_DIR/manifest.tsv" "$RCLONE_REMOTE:$S3_BUCKET/manifest.tsv"
    log "Subido a S3: $S3_BUCKET/$STORED_NAME (sha256=$SHA)"
  fi

  # Retencion local de dumps (planos o cifrados).
  find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.age' \) -mtime +"$RETENTION_DAYS" -delete
  log "Ciclo completo: $STORED_NAME"
}

# Alerta si no hay backups verificados recientes (manifest conserva el historial).
staleness_check() {
  NEWEST=$(find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.age' \) -mmin -$((STALENESS_HOURS * 60)) 2>/dev/null | head -1)
  if [ -z "$NEWEST" ]; then
    fail "ALERTA: no hay backups en las ultimas ${STALENESS_HOURS} horas"
  fi
}

log "Backups iniciados (intervalo=${INTERVAL}s retencion=${RETENTION_DAYS}d cifrado=$(if use_age; then echo age; else echo no; fi) s3=$(if use_s3; then echo si; else echo no; fi))"
while true; do
  staleness_check
  if run_cycle; then
    log "Ciclo OK; durmiendo ${INTERVAL}s"
  else
    fail "Ciclo con errores; reintento en ${INTERVAL}s"
  fi
  sleep "$INTERVAL"
done
