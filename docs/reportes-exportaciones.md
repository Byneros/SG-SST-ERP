# Reportes y exportaciones

El proyecto incluye un modulo `reports` en `sgsst-api` para generar reportes operativos en PDF y CSV, y acciones de descarga en `sgsst-web`.

## Alcance

- Autenticacion JWT obligatoria.
- Roles permitidos: `ADMIN`, `SST`, `AUDITOR`.
- `ADMIN` puede consultar globalmente o filtrar por `companyId`.
- Usuarios no administradores quedan limitados a su `companyId` desde backend.
- Los archivos se descargan desde el frontend usando `axios` con `responseType: 'blob'`, por lo que conservan el header `Authorization`.
- Cada intento de exportacion queda en `AuditLog` con accion `EXPORT` o `EXPORT_FAILED`.
- Los reportes pesados pueden solicitarse en segundo plano con BullMQ y el proceso `worker`.
- Cada reporte programado queda persistido en `ReportExport` con estado, archivo, expiracion y posibilidad de reintento.
- Las empresas pueden definir politica propia de expiracion y retencion; si no la tienen, se usa la politica global.

## Endpoints

```text
GET /api/v1/reports/summary.pdf
GET /api/v1/reports/summary.csv
GET /api/v1/reports/employees.pdf
GET /api/v1/reports/employees.csv
GET /api/v1/reports/expired-documents.pdf
GET /api/v1/reports/expired-documents.csv
GET /api/v1/reports/audits.pdf
GET /api/v1/reports/audits.csv
```

Generacion asincronica:

```text
POST /api/v1/reports/summary.pdf/schedule
POST /api/v1/reports/employees.pdf/schedule
POST /api/v1/reports/expired-documents.pdf/schedule
POST /api/v1/reports/audits.pdf/schedule
```

Parametro opcional para administradores:

```text
?companyId=<uuid>
```

Historial y reintentos:

```text
GET  /api/v1/reports/exports
POST /api/v1/reports/exports/:id/retry
```

Metricas administrativas:

```text
GET /api/v1/reports/metrics
GET /api/v1/reports/metrics/history
```

Filtros del historial:

```text
GET /api/v1/reports/exports?status=READY
GET /api/v1/reports/exports?companyId=<uuid>
GET /api/v1/reports/exports?requestedById=<uuid>
GET /api/v1/reports/exports?dateFrom=2026-06-01&dateTo=2026-06-30
GET /api/v1/reports/metrics?companyId=<uuid>&dateFrom=2026-06-01&dateTo=2026-06-30
GET /api/v1/reports/metrics/history?companyId=<uuid>&dateFrom=2026-06-01&dateTo=2026-06-30
```

## Uso en frontend

- Dashboard: descarga resumen ejecutivo en PDF o CSV.
- Empleados: descarga empleados activos.
- Documentos: descarga documentos vencidos.
- Auditorias SG-SST: descarga auditorias con conteo de hallazgos y acciones.
- Cada pantalla tambien permite programar el PDF para que el worker lo genere y avise por notificacion.
- La vista `Mis reportes` lista reportes programados, estado, archivo, expiracion y reintentos.
- La vista `Mis reportes` permite filtrar por estado, empresa, solicitante y rango de fechas.
- La vista `Mis reportes` muestra panel de metricas: volumen total, tasa de fallos, tiempo promedio, almacenamiento, top empresas y fallas por tipo.
- La vista `Mis reportes` muestra historico diario para administradores cuando existen snapshots.

## Historial

El modelo `ReportExport` guarda:

- Tipo de reporte y formato.
- Usuario solicitante.
- Empresa efectiva y empresa solicitada.
- Estado: `QUEUED`, `PROCESSING`, `READY`, `FAILED`, `EXPIRED`.
- `jobId` de BullMQ.
- URL, nombre, MIME type, storage key y tamano del archivo.
- Error de generacion si falla.
- Fecha de solicitud, inicio, finalizacion y expiracion.

Los enlaces listos expiran logicamente a los 7 dias. Al consultar el historial, los reportes `READY` vencidos pasan a `EXPIRED`. Los usuarios pueden reintentar reportes `FAILED` o `EXPIRED`.

La expiracion y retencion global son configurables:

```text
REPORT_EXPORT_EXPIRATION_DAYS=7
REPORT_EXPORT_RETENTION_DAYS=7
```

Cada empresa puede sobrescribirlas desde el CRUD de empresas:

- `reportExportExpirationDays`: dias que un enlace listo permanece disponible.
- `reportExportRetentionDays`: dias adicionales antes de borrar el archivo del storage.
- `reportFailureRateAlertPercent`: porcentaje de fallos diario permitido antes de alertar.
- `reportStorageAlertBytes`: almacenamiento permitido antes de alertar.
- `whatsappAlertsEnabled`: activa el envio externo por WhatsApp.
- `whatsappAlertPhone`: telefono destino en formato internacional.

Los valores validos son:

- Expiracion: 1 a 365 dias.
- Retencion: 0 a 365 dias.
- Fallos: 1 a 100%.
- Storage: 0 a 2147483647 bytes.

## Permisos

- `ADMIN` sin `companyId`: consulta exportaciones de toda la plataforma.
- `ADMIN` con `companyId`: consulta exportaciones de su empresa.
- `SST` y `AUDITOR`: consultan sus propias exportaciones.
- El reintento respeta el mismo alcance: propietario del reporte o `ADMIN` dentro de su empresa.

## Auditoria

Cada descarga registra:

- Usuario autenticado.
- Tipo de reporte.
- Formato: `pdf` o `csv`.
- Empresa efectiva y `companyId` solicitado.
- IP y `User-Agent`.
- Resultado: `SUCCESS` o `FAILED`.
- Mensaje de error cuando la generacion falla.

Los reportes programados registran:

- `EXPORT_QUEUED` cuando el trabajo entra a la cola.
- `EXPORT_READY` cuando el archivo queda disponible.
- `EXPORT_FAILED` cuando el worker no puede generar o almacenar el archivo.

## Worker

Variables:

```text
REPORTS_QUEUE_ENABLED=true
REPORTS_WORKER_ENABLED=true
REPORTS_CLEANUP_CRON=0 3 * * *
REPORTS_METRICS_CRON=30 3 * * *
REPORTS_ALERTS_CRON=0 4 * * *
REPORT_ALERTS_ENABLED=true
REPORT_FAILURE_RATE_ALERT_PERCENT=20
REPORT_STORAGE_ALERT_BYTES=1073741824
```

En Docker Compose:

- `api`: `REPORTS_WORKER_ENABLED=false`, solo encola.
- `worker`: `REPORTS_WORKER_ENABLED=true`, procesa la cola `sgsst-reports`.

Cuando el reporte queda listo, se guarda bajo `uploads/reports` en local o `reports/` en S3, y se crea una notificacion al usuario solicitante con el enlace.

El mismo worker programa `cleanup-expired-reports`, que:

- Marca como `EXPIRED` los reportes `READY` que superaron `expiresAt`.
- Espera la retencion configurada.
- Elimina del storage local o S3 los archivos bajo `reports/`.
- Conserva el registro `ReportExport` para trazabilidad, pero limpia `fileUrl`, `storageKey` y `size`.
- Registra la ejecucion en `AuditLog` con accion `CLEANUP_EXPIRED_REPORT_EXPORTS`.

El worker tambien programa `capture-report-metrics`, que:

- Toma el dia anterior como periodo cerrado.
- Crea o actualiza snapshots globales y por empresa.
- Guarda total, estados, almacenamiento y tiempo promedio.
- Expone la tendencia en `GET /api/v1/reports/metrics/history`.
- Registra auditoria `CAPTURE_REPORT_EXPORT_METRICS`.

El worker tambien programa `evaluate-report-alerts`, que:

- Lee los snapshots del dia anterior.
- Genera alertas si la tasa de fallos supera el umbral de la empresa o `REPORT_FAILURE_RATE_ALERT_PERCENT`.
- Genera alertas si el almacenamiento supera el umbral de la empresa o `REPORT_STORAGE_ALERT_BYTES`.
- Notifica a administradores globales, administradores de empresa y responsables SST de la empresa.
- Envia un WhatsApp por alerta y empresa si el canal esta habilitado.
- Registra cada intento externo en `ExternalDelivery`.
- Reintenta entregas externas fallidas segun `EXTERNAL_DELIVERY_RETRY_CRON`.
- Deduplica alertas mientras la notificacion anterior siga sin leer.
- Registra auditoria `EVALUATE_REPORT_EXPORT_ALERTS`.

## Siguiente mejora recomendada

Agregar registro persistente de entregas externas para auditar intentos, errores y reintentos.
