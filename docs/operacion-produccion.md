# Operacion de produccion

## Salud y observabilidad

- `GET /api/v1/health` confirma que el proceso HTTP responde.
- `GET /api/v1/ready` confirma conectividad con PostgreSQL y Redis. Usarlo para readiness del balanceador y alertar ante respuestas `503`.
- `GET /api/v1/metrics` expone metricas Prometheus de solicitudes HTTP y uptime. Requiere el encabezado `X-Metrics-Token` con el valor de `METRICS_TOKEN`.
- Los logs HTTP se emiten como JSON con `requestId`, metodo, ruta sin query string, estado y duracion. No incluyen cuerpos, tokens ni datos personales.

`METRICS_TOKEN` es obligatorio en produccion y debe tener al menos 32 caracteres. Configurarlo como secreto del entorno de despliegue, nunca en el repositorio.

## Despliegue

1. Configurar secretos y variables de produccion, incluidos `JWT_SECRET`, `METRICS_TOKEN`, `DATABASE_URL`, `REDIS_URL` y `CORS_ORIGINS`.
2. Ejecutar `npm run prisma:migrate:deploy` una sola vez contra la base de datos objetivo.
3. Desplegar API y worker con la misma version de imagen.
4. Confirmar `/health`, `/ready` y un flujo autenticado de lectura con una empresa de prueba.
5. Configurar el scraper de metricas con el token y alertas para `ready=503`, reinicios frecuentes y errores HTTP 5xx.

## Backups y restauracion

1. Activar `postgres-backup` o ejecutar `scripts/backup-postgres.ps1`.
2. Copiar los dumps validados a almacenamiento externo cifrado con retencion definida.
3. Ejecutar al menos una restauracion trimestral en una base aislada, usando `-ConfirmRestore`.
4. Registrar fecha, resultado, duracion y responsable de cada prueba de restauracion para demostrar el RPO/RTO acordado.
