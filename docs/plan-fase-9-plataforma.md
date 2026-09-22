# Plan Fase 9 — Plataforma

**ESTADO: FASE CERRADA (2026-09-22).** Los cuatro puntos se completaron y se
verificaron (build, tests, lint y QA en navegador). Este documento queda como
registro del plan y de su ejecución.

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
- ~~QA visual en navegador de la consola completa.~~ **Hecho (Sprint 4):** tabla,
  filtros, "Reintentar fallidas" y navegación renderizan sin errores de consola.

## 9.2 Backups externos cifrados — implementado (verificado en vivo)

*Estado real:* imagen dedicada `docker/postgres-backup` (postgres + age +
rclone) con ciclo completo probado contra MinIO: dump custom validado,
cifrado age, subida S3-compatible con verificación de tamaño, manifiesto
sha256 local y en el bucket, retención y alerta de obsolescencia.
Restauración probada: descifrado + `pg_restore` (3 usuarios, 32 tablas).

*Resta:* ~~alerta hacia un canal real (hoy queda en el log del contenedor) y
prueba de restauración programada mensual.~~ **Hecho (Sprint 3):** alerta SMTP
desde el contenedor (`BACKUP_ALERT_EMAIL_*`, mismas credenciales que la API,
con cooldown) y restore check automático mensual (`BACKUP_RESTORE_CHECK_DAYS`),
verificado en vivo (34 tablas restauradas en BD efímera).

1. Tras cada dump, cifrar con `age` (clave pública en
   `BACKUP_ENCRYPTION_PUBLIC_KEY`) y subir a bucket S3-compatible
   (`BACKUP_S3_*`, reutilizando el patrón de credenciales del driver S3).
2. Verificación post-subida: checksum SHA-256 en un manifiesto con fecha/tamaño.
3. Documentar restauración en `docs/backups-postgresql.md`: descifrado,
   `pg_restore` y prueba en contenedor efímero.
4. Alerta si el último backup verificado supera 24h (patrón de
   `REPORT_ALERTS_ENABLED`).

## 9.3 Imágenes GHCR por etiqueta SHA — **cerrado (Sprint 2)**

*Estado real (verificado):* `.github/workflows/release.yml` ya publica
`sgsst-api` y `sgsst-web` a GHCR con tags `sha-{long}` + `{staging|production}-latest`
(workflow_dispatch por entorno, `packages: write`), con validación de
`VITE_API_URL` y job separado `migrate` que aplica migraciones Prisma.

*Pendiente (completado en Sprint 2):*
1. ~~`docker-compose.prod.yml` de referencia que consuma las imágenes por
   etiqueta (sin `build:`), con env obligatorios y healthchecks del compose
   local, incluyendo el worker.~~ Creado y validado con `docker compose config`.
2. ~~Documentar promoción/rollback: qué etiqueta corre en cada entorno y cómo
   re-fijar un SHA anterior.~~ En `docs/despliegue-por-ambientes.md`.

## 9.4 SSO OIDC/SAML — **OIDC cerrado (Sprints 1 y previos); SAML queda para
una iteración futura**

*Implementado:* módulo `sso` completo (provider por empresa, PKCE S256, state
one-shot en BD, id_token verificado contra JWKS del IdP con `jose`, aprovisionamiento
JIT con rol por defecto, secret cifrado en reposo, auditoría `SSO_PROVIDER_SAVE/DELETE`,
unitarios). Frontend: configuración por empresa (Empresas → SSO OIDC) y "Ingresar
con SSO empresarial" con selección de empresa. QA en navegador con IdP mock: flujo
end-to-end OK (JIT `EMPLOYEE` + sesión JWT/refresh en la web).

*Correcciones del QA (Sprint 1):* DTO `isActive` booleano, diálogo de opciones
SSO accesible desde `LoginPage`, fragmento `#access_token` consumido antes del
routing, `WEB_BASE_URL` separada de `PUBLIC_BASE_URL` y proxy de callback en Vite.

*Resta (futuro):* SAML (`@node-saml/passport-saml`), overrides de rol por
grupo del IdP, e2e de aislamiento en el harness multi-tenant.

## Prioridades ajustadas (ejecutadas)

1. **9.1 — completado**: diálogo de detalle, auditoría `EXTERNAL_DELIVERY_RETRY`,
   unitarios del reintento y wiring completo de la vista en `App.tsx`. QA
   visual en navegador (Sprint 4).
2. **9.3 — completado (Sprint 2)**: `docker-compose.prod.yml` + promoción y
   rollback documentados.
3. **9.2 — completado (Sprint 3)**: alerta SMTP + restore check mensual
   verificado en vivo.
4. **9.4 — OIDC completado (Sprint 1)**: fix del QA visual + flujo E2E con
   IdP mock. SAML pospuesto a iteración futura.

Criterio de cierre de la fase: ~~QA en navegador~~ (hecho: entregas, SSO y
login), ~~restauración real de un backup cifrado para 9.2~~ (hecho: restore
check con 34 tablas), y despliegue desde GHCR en un entorno limpio para 9.3
(documentado; requiere proveedor cloud con las etiquetas publicadas).
