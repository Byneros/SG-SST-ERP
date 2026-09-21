# Plan Fase 9 — Plataforma

Fuente: `README.md`, sección "Roadmap tecnico inmediato". Revisado contra el
código (commit `cacdfcb`): los puntos 9.1 y 9.3 están **mayormente hechos** y
este plan recalibra el trabajo restante. Las Fases 1–8 cubrieron el producto
(módulos operativos + frontend de evaluaciones Res. 0312 e indicadores); la
Fase 9 cierra plataforma: soporte operativo, continuidad, despliegue e
identidad empresarial.

## 9.1 Consola de entregas externas — implementado

*Estado real (verificado):*
- `POST /notifications/external-deliveries/:id/retry` existe en
  `notifications.service.ts` (`retryExternalDeliveryForUser`): valida scope con
  `assertCompanyScope`, reintenta con `force: true`, respeta `maxAttempts` y
  backoff exponencial (`nextRetryDate`). Rol `ADMIN`; SUPER_ADMIN pasa por el
  guard.
- `GET /notifications/external-deliveries` con filtros `provider`/`status`,
  búsqueda y `companyId` resuelto por scope (`resolveCompanyScope`).
- Frontend `ExternalDeliveriesPage`: botón "Reintentar" por fila y
  "Reintentar fallidas" (`POST retry-external-deliveries`), filtro de empresa,
  botón "Ver detalle" y diálogo `ExternalDeliveryDialog` (estado, destino,
  empresa, entidad, tiempos, payload/respuesta/error en JSON).
- Vista cableada en `App.tsx` (estado, fetch con scope de empresa, reintento
  individual/masivo, diálogo) y navegación "Entregas externas" para ADMIN.
- Reintentos automáticos por cron (`EXTERNAL_DELIVERY_RETRY_CRON`).
- Auditoría `EXTERNAL_DELIVERY_RETRY` en el reintento manual: registra estado
  e intentos previos y resultantes, más el error final.
- Tests unitarios del reintento (404, aislamiento multi-tenant 403 entre
  empresas y SUPER_ADMIN, camino feliz con auditoría, sin auditoría al ser
  rechazado por scope).

*Resta (opcional):*
- e2e de entregas en el harness multi-tenant: el aislamiento ya queda cubierto
  por unitarios; el harness e2e aún no monta el módulo de notificaciones.
- QA visual en navegador de la consola completa.

## 9.2 Backups externos cifrados — implementado (verificado en vivo)

*Estado real:* imagen dedicada `docker/postgres-backup` (postgres + age +
rclone) con ciclo completo probado contra MinIO: dump custom validado,
cifrado age, subida S3-compatible con verificación de tamaño, manifiesto
sha256 local y en el bucket, retención y alerta de obsolescencia.
Restauración probada: descifrado + `pg_restore` (3 usuarios, 32 tablas).

*Resta:* alerta hacia un canal real (hoy queda en el log del contenedor) y
prueba de restauración programada mensual.

1. Tras cada dump, cifrar con `age` (clave pública en
   `BACKUP_ENCRYPTION_PUBLIC_KEY`) y subir a bucket S3-compatible
   (`BACKUP_S3_*`, reutilizando el patrón de credenciales del driver S3).
2. Verificación post-subida: checksum SHA-256 en un manifiesto con fecha/tamaño.
3. Documentar restauración en `docs/backups-postgresql.md`: descifrado,
   `pg_restore` y prueba en contenedor efímero.
4. Alerta si el último backup verificado supera 24h (patrón de
   `REPORT_ALERTS_ENABLED`).

## 9.3 Imágenes GHCR por etiqueta SHA — cerrar detalles

*Estado real (verificado):* `.github/workflows/release.yml` ya publica
`sgsst-api` y `sgsst-web` a GHCR con tags `sha-{long}` + `{staging|production}-latest`
(workflow_dispatch por entorno, `packages: write`), con validación de
`VITE_API_URL` y job separado `migrate` que aplica migraciones Prisma.

*Pendiente:*
1. `docker-compose.prod.yml` de referencia que consuma las imágenes por
   etiqueta (sin `build:`), con env obligatorios y healthchecks del compose
   local, incluyendo el worker.
2. Documentar promoción/rollback: qué etiqueta corre en cada entorno y cómo
   re-fijar un SHA anterior.

## 9.4 SSO OIDC/SAML — intacto, el de mayor tamaño

*Estado real:* sin dependencias ni diseño (`package.json` solo trae
`passport-jwt`). Auth local con JWT + refresh + MFA TOTP opcional.

1. Diseño primero: `CompanySsoConfig` por empresa (protocolo `OIDC|SAML`,
   issuer, clientId/clientSecret o metadata, dominios permitidos). Migración +
   módulo `company-sso` (administración SUPER_ADMIN/ADMIN).
2. Backend: estrategia OIDC por empresa (`openid-client`);
   `POST /auth/sso/:companyId/start` → callback → buscar/crear usuario por
   email+dominio → emitir el mismo par JWT/refresh actual. SAML en segunda
   iteración (`@node-saml/passport-saml`).
3. Mapeo de roles: `EMPLOYEE` por defecto + overrides por email/grupo del IdP.
4. Frontend: "Ingresar con SSO" en `LoginPage` (detección por dominio o
   selección de empresa); login local intacto para admins.
5. Seguridad: PKCE `state`/`nonce`, whitelist de redirects, e2e de
   aislamiento (el usuario SSO queda siempre en el scope de su empresa).

## Prioridades ajustadas

1. **9.1 — completado**: diálogo de detalle, auditoría `EXTERNAL_DELIVERY_RETRY`,
   unitarios del reintento y wiring completo de la vista en `App.tsx`.
2. **9.3 (cierre)** — compose.prod + documentación de rollback sobre un
   workflow que ya publica (≈ medio ciclo).
3. **9.2 Backups cifrados** — implementado; solo falta canal de alerta y
   prueba de restauración programada.
4. **9.4 SSO** — el más grande y con decisión comercial detrás (2 ciclos; OIDC
   primero).

Criterio de cierre de la fase: QA en navegador (patrón `scripts/qa-phase8.mjs`)
del diálogo de entregas y del flujo SSO, restauración real de un backup
cifrado para 9.2, y despliegue desde GHCR en un entorno limpio para 9.3.
