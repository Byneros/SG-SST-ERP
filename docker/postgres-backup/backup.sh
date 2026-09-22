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

# Alerta por email a canal real (mismas credenciales SMTP que la API).
ALERT_EMAIL_ENABLED="${BACKUP_ALERT_EMAIL_ENABLED:-false}"
ALERT_EMAIL_TO="${BACKUP_ALERT_EMAIL_TO:-}"
ALERT_COOLDOWN_MINUTES="${BACKUP_ALERT_COOLDOWN_MINUTES:-360}"

# Prueba de restauracion programada (dias entre pruebas; 0 = desactivada).
RESTORE_CHECK_DAYS="${BACKUP_RESTORE_CHECK_DAYS:-30}"
RESTORE_CHECK_DB="${BACKUP_RESTORE_CHECK_DB:-sgsst_restore_check}"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $*"; }
fail() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*"; }

# Envia la alerta por email (SMTP directo con curl) con cooldown anti-spam.
notify_alert() {
  ALERT_SUBJECT="$1"
  if [ "$ALERT_EMAIL_ENABLED" != "true" ] || [ -z "$ALERT_EMAIL_TO" ]; then
    log "Alerta no enviada por email (desactivada o sin destinatario): $ALERT_SUBJECT"
    return 0
  fi
  COOLDOWN_FILE="$BACKUP_DIR/.last_alert_email"
  if [ -f "$COOLDOWN_FILE" ]; then
    LAST=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    if [ $((NOW - LAST)) -lt $((ALERT_COOLDOWN_MINUTES * 60)) ]; then
      log "Alerta en cooldown, no se reenvia: $ALERT_SUBJECT"
      return 0
    fi
  fi
  SMTP_HOST="${SMTP_HOST:-}"
  SMTP_PORT="${SMTP_PORT:-587}"
  SMTP_SECURE="${SMTP_SECURE:-false}"
  SMTP_FROM="${SMTP_FROM:-}"
  if [ -z "$SMTP_HOST" ] || [ -z "$SMTP_FROM" ]; then
    warn "SMTP_HOST/SMTP_FROM vacios: la alerta solo queda en el log"
    return 0
  fi
  MAIL=$(printf 'From: %s\nTo: %s\nSubject: [SG-SST backup] %s\nDate: %s\n\n%s\nHost: %s\n' \
    "$SMTP_FROM" "$ALERT_EMAIL_TO" "$ALERT_SUBJECT" "$(date -R)" "$ALERT_SUBJECT" "$PGHOST")
  SCHEME="smtp"
  [ "$SMTP_SECURE" = "true" ] && SCHEME="smtps"
  # sh puro (busybox ash): sin arrays. --ssl-reqd exige STARTTLS en puerto llano;
  # en smtps el TLS ya es implicito.
  if printf '%s' "$MAIL" | curl --silent --show-error --max-time 30 \
      --url "$SCHEME://$SMTP_HOST:$SMTP_PORT" \
      --mail-from "$SMTP_FROM" --mail-rcpt "$ALERT_EMAIL_TO" -T - \
      ${SMTP_USER:+--user "$SMTP_USER:${SMTP_PASSWORD:-}"} \
      2>>/tmp/backup-alert-mail.err; then
    date +%s > "$COOLDOWN_FILE"
    log "Alerta enviada por email a $ALERT_EMAIL_TO"
  else
    warn "Fallo el envio de la alerta por email (detalle en /tmp/backup-alert-mail.err)"
  fi
}

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
    MSG="ALERTA: no hay backups en las ultimas ${STALENESS_HOURS} horas"
    fail "$MSG"
    notify_alert "$MSG"
  fi
}

# Prueba de restauracion del backup mas reciente en una BD efimera.
# Verifica que el artefacto es restaurable de verdad (descifrado + pg_restore + tablas).
restore_check() {
  if [ "$RESTORE_CHECK_DAYS" = "0" ]; then
    return 0
  fi
  MARKER="$BACKUP_DIR/.last_restore_check"
  NOW=$(date +%s)
  if [ -f "$MARKER" ]; then
    LAST=$(cat "$MARKER" 2>/dev/null || echo 0)
    if [ $((NOW - LAST)) -lt $((RESTORE_CHECK_DAYS * 86400)) ]; then
      return 0
    fi
  fi
  NEWEST=$(find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.age' \) 2>/dev/null | sort | tail -1)
  if [ -z "$NEWEST" ]; then
    warn "Restore check: no hay backups para probar"
    return 0
  fi
  log "Restore check: probando restauracion de $(basename "$NEWEST") en $RESTORE_CHECK_DB"
  TEST_DUMP="/tmp/restore_check.dump"
  case "$NEWEST" in
    *.age)
      if ! use_age_key_available; then
        warn "Restore check: clave privada age no disponible; se omite la prueba"
        return 0
      fi
      age -d -i "$AGE_PRIVATE_KEY_FILE" "$NEWEST" > "$TEST_DUMP"
      ;;
    *)
      cp "$NEWEST" "$TEST_DUMP"
      ;;
  esac
  pg_restore --list "$TEST_DUMP" >/dev/null
  dropdb --host="$PGHOST" --username="$PGUSER" --if-exists "$RESTORE_CHECK_DB" || true
  createdb --host="$PGHOST" --username="$PGUSER" "$RESTORE_CHECK_DB"
  if pg_restore --host="$PGHOST" --username="$PGUSER" --dbname="$RESTORE_CHECK_DB" --no-owner --no-privileges "$TEST_DUMP" \
    && TABLES=$(psql --host="$PGHOST" --username="$PGUSER" --dbname="$RESTORE_CHECK_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'") \
    && [ "${TABLES:-0}" -gt 0 ]; then
    log "Restore check OK: $TABLES tablas restauradas en $RESTORE_CHECK_DB"
    date +%s > "$MARKER"
  else
    MSG="ALERTA: restore check fallo con $(basename "$NEWEST")"
    fail "$MSG"
    notify_alert "$MSG"
  fi
  dropdb --host="$PGHOST" --username="$PGUSER" --if-exists "$RESTORE_CHECK_DB" || true
  rm -f "$TEST_DUMP"
}

# La clave privada age se monta solo para el restore check (nunca para cifrar).
use_age_key_available() {
  AGE_PRIVATE_KEY_FILE="${BACKUP_ENCRYPTION_PRIVATE_KEY_FILE:-}"
  [ -n "$AGE_PRIVATE_KEY_FILE" ] && [ -f "$AGE_PRIVATE_KEY_FILE" ]
}

log "Backups iniciados (intervalo=${INTERVAL}s retencion=${RETENTION_DAYS}d cifrado=$(if use_age; then echo age; else echo no; fi) s3=$(if use_s3; then echo si; else echo no; fi) alerta_email=$(if [ "$ALERT_EMAIL_ENABLED" = "true" ]; then echo si; else echo no; fi) restore_check_cada=${RESTORE_CHECK_DAYS}d)"
while true; do
  staleness_check
  if run_cycle; then
    log "Ciclo OK; durmiendo ${INTERVAL}s"
    restore_check
  else
    MSG="ALERTA: ciclo de backup con errores en $PGHOST/$DB_NAME"
    fail "$MSG"
    notify_alert "$MSG"
  fi
  sleep "$INTERVAL"
done
