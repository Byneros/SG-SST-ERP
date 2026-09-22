# Backups PostgreSQL

El proyecto incluye backups automatizados y restauracion manual para PostgreSQL en Docker.

## Backup automatico

El servicio `postgres-backup` esta en el perfil `backup`, por lo que se activa explicitamente:

```bash
docker compose --profile backup up -d postgres-backup
```

Variables:

- `BACKUP_INTERVAL_SECONDS`: intervalo entre backups. Valor por defecto: `86400`.
- `BACKUP_RETENTION_DAYS`: dias de retencion local. Valor por defecto: `7`.
- `BACKUP_STALENESS_HOURS`: horas sin backup nuevo para disparar la alerta de obsolescencia. Valor por defecto: `24`.
- `BACKUP_ALERT_EMAIL_ENABLED`: `true` para enviar la alerta por email (SMTP directo desde el contenedor con `curl`). Por defecto `false` (solo log).
- `BACKUP_ALERT_EMAIL_TO`: destinatario de la alerta (obligatorio si la alerta email esta activa).
- `BACKUP_ALERT_COOLDOWN_MINUTES`: minutos entre reenvios de alerta para evitar spam. Por defecto `360`.
- `BACKUP_RESTORE_CHECK_DAYS`: dias entre pruebas de restauracion automaticas (`0` desactiva). Por defecto `30` (mensual).
- `BACKUP_ENCRYPTION_PUBLIC_KEY`: clave publica age. Si esta vacia el dump se conserva sin cifrar.
- `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_FORCE_PATH_STYLE`: sincronizacion externa a almacenamiento S3-compatible (S3, MinIO, GCS, Azure Blob). Si estan vacios cae a las variables `S3_*` del driver de documentos.

Los archivos se guardan en:

```text
backups/postgres/*.dump       # sin cifrado (solo si no hay clave age)
backups/postgres/*.dump.age   # cifrados con age (configuracion recomendada)
backups/postgres/manifest.tsv # historial: fecha, archivo, sha256, tamano
```

El formato es `custom` de PostgreSQL, restaurable con `pg_restore`. Cada backup se valida con `pg_restore --list` antes de cifrarlo. Cuando hay subida a S3 el script verifica el tamano remoto contra el local y actualiza `manifest.tsv` en el bucket.

## Alertas a canal real

La alerta de obsolescencia y las fallas del ciclo se envian por email usando las mismas credenciales `SMTP_*` de la API (el contenedor envia SMTP directo con `curl`; no depende del backend). Activacion:

```bash
BACKUP_ALERT_EMAIL_ENABLED=true \
BACKUP_ALERT_EMAIL_TO=sst@empresa.com \
docker compose --profile backup up -d postgres-backup
```

El cooldown (`BACKUP_ALERT_COOLDOWN_MINUTES`) evita reenvios repetidos: la primera alerta envia email, las siguientes dentro de la ventana solo quedan en el log. Si `SMTP_HOST`/`SMTP_FROM` estan vacios la alerta degrada a log.

## Prueba de restauracion programada

Cada `BACKUP_RESTORE_CHECK_DAYS` (por defecto 30) el contenedor toma el backup mas reciente, lo descifra si aplica (requiere `BACKUP_ENCRYPTION_PRIVATE_KEY_FILE` montado con la clave privada age), lo restaura en una base efimera `sgsst_restore_check` y verifica que tenga tablas; luego la elimina. Resultado en el log; si falla dispara la misma alerta por email. Esta prueba cumple la recomendacion mensual sin intervencion manual.

## Cifrado y sincronizacion externa

Generar el par de llaves age (la privada NUNCA va al servidor de backups):

```bash
docker compose --profile backup run --rm --entrypoint sh postgres-backup \
  -c "age-keygen -o /backups/key.txt && age-keygen -y /backups/key.txt"
```

`age-keygen -y` imprime la clave publica: configurarla en `BACKUP_ENCRYPTION_PUBLIC_KEY` (.env) y guardar la privada (`key.txt`) en el gestor de secretos del equipo responsable. Ejemplo de configuracion externa con MinIO:

```bash
BACKUP_ENCRYPTION_PUBLIC_KEY=age1... \
BACKUP_S3_ENDPOINT=http://minio:9000 \
BACKUP_S3_BUCKET=sgsst-backups \
BACKUP_S3_ACCESS_KEY_ID=minioadmin \
BACKUP_S3_SECRET_ACCESS_KEY=minioadmin \
docker compose --profile backup up -d postgres-backup
```

## Restaurar un backup cifrado

1. Descifrar (requiere la clave privada age):

```bash
docker compose --profile backup run --rm --entrypoint sh postgres-backup \
  -c "age -d -i /backups/key.txt /backups/sgsst_YYYYMMDD_HHMMSS.dump.age > /backups/restore.dump"
```

2. Restaurar el dump custom (ver `Restauracion manual en Windows`; dentro del contenedor:
   `createdb` temporal + `pg_restore -d sgsst_restore_test /tmp/restore.dump` + `dropdb`).

3. Verificar integridad comparando el `sha256` del archivo contra `manifest.tsv`:

```bash
sha256sum backups/postgres/sgsst_YYYYMMDD_HHMMSS.dump.age
```

## Backup manual en Windows

```powershell
.\scripts\backup-postgres.ps1
```

## Restauracion manual en Windows

```powershell
.\scripts\restore-postgres.ps1 -BackupFile .\backups\postgres\sgsst_YYYYMMDD_HHMMSS.dump -ConfirmRestore
```

La restauracion elimina y recrea la base `sgsst`, luego aplica el dump. Usar solo sobre ambientes controlados.

## Recomendacion para produccion

- Configurar siempre `BACKUP_ENCRYPTION_PUBLIC_KEY` y la sincronizacion `BACKUP_S3_*` a un bucket dedicado con versionado y retencion propia.
- Guardar la clave privada age fuera del servidor de backups (gestor de secretos). Para habilitar la prueba de restauracion automatica, montarla solo de lectura en `BACKUP_ENCRYPTION_PRIVATE_KEY_FILE` (p. ej. `- ./secrets/age.key:/keys/age.key:ro` + `BACKUP_ENCRYPTION_PRIVATE_KEY_FILE=/keys/age.key`).
- La prueba de restauracion mensual corre automatica (`BACKUP_RESTORE_CHECK_DAYS=30`); el procedimiento manual de arriba sigue vigente como verificacion puntual.
- Documentar RPO/RTO por cliente; la alerta de obsolescencia (`BACKUP_STALENESS_HOURS`) se registra en el log y se envia por email si `BACKUP_ALERT_EMAIL_ENABLED=true`.
