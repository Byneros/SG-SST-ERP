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

Los archivos se guardan en:

```text
backups/postgres/*.dump
```

El formato es `custom` de PostgreSQL, restaurable con `pg_restore`. Cada backup se valida con `pg_restore --list` antes de copiarlo al host.

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

- Copiar backups fuera del servidor: S3, Azure Blob, GCS o almacenamiento administrado.
- Cifrar backups en reposo.
- Ejecutar una prueba de restauracion periodica.
- Documentar RPO/RTO por cliente.
