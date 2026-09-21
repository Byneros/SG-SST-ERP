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
- `BACKUP_STALENESS_HOURS`: horas sin backup nuevo para registrar alerta en el log del contenedor. Valor por defecto: `24`.
- `BACKUP_ENCRYPTION_PUBLIC_KEY`: clave publica age. Si esta vacia el dump se conserva sin cifrar.
- `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_FORCE_PATH_STYLE`: sincronizacion externa a almacenamiento S3-compatible (S3, MinIO, GCS, Azure Blob). Si estan vacios cae a las variables `S3_*` del driver de documentos.

Los archivos se guardan en:

```text
backups/postgres/*.dump       # sin cifrado (solo si no hay clave age)
backups/postgres/*.dump.age   # cifrados con age (configuracion recomendada)
backups/postgres/manifest.tsv # historial: fecha, archivo, sha256, tamano
```

El formato es `custom` de PostgreSQL, restaurable con `pg_restore`. Cada backup se valida con `pg_restore --list` antes de cifrarlo. Cuando hay subida a S3 el script verifica el tamano remoto contra el local y actualiza `manifest.tsv` en el bucket.

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
- Guardar la clave privada age fuera del servidor de backups (gestor de secretos).
- Ejecutar una prueba de restauracion periodica (mensual) con el procedimiento de arriba.
- Documentar RPO/RTO por cliente; la alerta de obsolescencia (`BACKUP_STALENESS_HOURS`) aparece en el log del contenedor si el ciclo falla.
