# Storage externo cifrado

El modulo de documentos soporta dos drivers:

- `local`: guarda archivos en `uploads/documents`.
- `s3`: sube archivos a un bucket S3-compatible con cifrado server-side.

## Variables S3

```env
DOCUMENT_STORAGE_DRIVER=s3
S3_REGION=us-east-1
S3_BUCKET=sgsst-documents
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_SERVER_SIDE_ENCRYPTION=AES256
```

Para proveedores S3-compatible como MinIO, Wasabi o DigitalOcean Spaces:

```env
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=http://localhost:9000/sgsst-documents
```

## MinIO local

Levantar MinIO para pruebas:

```bash
docker compose --profile storage up -d minio
```

Consola:

```text
http://localhost:9001
```

Credenciales por defecto:

```text
minioadmin / minioadmin
```

Crear bucket `sgsst-documents` y configurar:

```env
DOCUMENT_STORAGE_DRIVER=s3
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=sgsst-documents
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=http://localhost:9000/sgsst-documents
```

## Backups

Los backups locales quedan en `backups/postgres`. Para produccion se recomienda sincronizarlos a un bucket cifrado con politica de retencion, versionado y lifecycle.

Opciones recomendadas:

- S3 con SSE-S3 o SSE-KMS.
- Azure Blob con encryption at rest y lifecycle.
- GCS con CMEK si el cliente lo exige.

El servicio de backup local sigue siendo la fuente de dumps; la sincronizacion externa debe ejecutarse en la capa de infraestructura o pipeline.
