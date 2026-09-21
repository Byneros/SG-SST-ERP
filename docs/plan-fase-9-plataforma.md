# Plan Fase 9 — Plataforma

Fuente: `README.md`, sección "Roadmap tecnico inmediato". Las Fases 1–8 cubrieron
el producto (módulos operativos de backend + frontend de evaluaciones Res. 0312
e indicadores). La Fase 9 pasa del producto a la plataforma: despliegue,
continuidad, identidad empresarial y soporte operativo.

## 9.1 Consola de entregas externas

*Estado actual:* `ExternalDelivery` vive en el módulo `notifications`
(`notifications-queue.service.ts`, reintentos por cron
`EXTERNAL_DELIVERY_RETRY_CRON`, `attemptCount`/`maxAttempts`/`nextAttemptAt`).
El frontend ya la consulta en `ExternalDeliveriesPage` (filtros por proveedor,
estado y empresa), pero es **solo lectura**: no existe endpoint de reintento
manual ni paginación real para SUPER_ADMIN multi-empresa.

*Objetivo:* soporte operativo con capacidad de diagnóstico y reparación puntual.

1. Backend (`notifications` o módulo nuevo `external-deliveries`):
   - `POST /external-deliveries/:id/retry` — re-encola una entrega fallida
     (roles `SUPER_ADMIN`, `ADMIN`); resetea `nextAttemptAt` y respeta
     `maxAttempts` con override manual documentado.
   - `GET /external-deliveries` con filtro `companyId` real para SUPER_ADMIN
     (hoy el listado hereda el scope; verificar y agregar e2e).
   - Auditoría del reintento manual (acción `EXTERNAL_DELIVERY_RETRY`).
2. Frontend (`ExternalDeliveriesPage`):
   - Botón "Reintentar" por fila en estado `FAILED` con confirmación.
   - Panel de detalle (payload, respuesta, error completo) en diálogo.
3. Tests: unitarios del endpoint de retry + e2e de aislamiento (una empresa no
   puede reintentar entregas de otra).

## 9.2 Backups externos cifrados

*Estado actual:* `postgres-backup` (perfil `backup`) genera dumps custom locales
en `./backups/postgres` con retención por días. No hay salida del host ni
cifrado.

*Objetivo:* continuidad de negocio: copia fuera del host, cifrada y verificable.

1. Nuevo servicio `postgres-backup-sync` (perfil `backup`) o extensión del
   actual: tras cada dump, cifrar con `age` (clave pública en `BACKUP_ENCRYPTION_PUBLIC_KEY`)
   y subir al bucket (S3-compatible; reutiliza credenciales del driver S3 de
   documentos o variables dedicadas `BACKUP_S3_*`).
2. Verificación de integridad post-subida (checksum SHA-256 registrado en un
   manifiesto con fecha/tamaño).
3. Documentar restauración en `docs/backups-postgresql.md`: descifrado,
   `pg_restore` y prueba de restauración en contenedor efímero.
4. Alerta si el último backup verificado supera 24h (reutilizar el patrón de
   alertas de `REPORT_ALERTS_ENABLED`).

## 9.3 Imágenes GHCR por etiqueta SHA

*Estado actual:* CI valida compose, corre tests y builds, pero no publica
imágenes. Los `docker-compose.yml` locales construyen desde fuente.

*Objetivo:* despliegues reproducibles: las imágenes se publican por SHA y los
entornos consumen etiquetas inmutables.

1. Workflow `release.yml`: en push a `main` (o tag `v*`), build y push a GHCR:
   - `ghcr.io/<org>/sgsst-api:${GITHUB_SHA}` y tag `main`/semántico.
   - `ghcr.io/<org>/sgsst-web:${GITHUB_SHA}` con `VITE_API_URL` como build-arg.
   - Login con `GITHUB_TOKEN` (`permissions: packages: write`).
2. `docker-compose.prod.yml` de referencia que consume las imágenes por SHA
   (sin `build:`), con env obligatorios (`JWT_SECRET`, `METRICS_TOKEN`) y
   healthchecks iguales al compose local.
3. Documentar promoción: qué etiqueta corre en qué entorno y cómo hacer rollback
   (re-pin de SHA).

## 9.4 SSO OIDC/SAML para clientes empresariales

*Estado actual:* auth local con JWT + refresh + MFA TOTP opcional
(`auth.service.ts`, `mfa*`). No hay federación de identidad.

*Objetivo:* login empresarial federado sin romper el modelo multi-tenant.

1. Diseño primero: cada `Company` puede tener una configuración IdP
   (`CompanySsoConfig`: protocolo `OIDC|SAML`, issuer, clientId/clientSecret o
   metadata XML, dominios de email permitidos). Migración + módulo
   `company-sso` (solo SUPER_ADMIN/ADMIN la administran).
2. Backend: estrategia Passport OIDC (recomendar `openid-client`) por empresa;
   flujo: `POST /auth/sso/:companyId/start` → callback → buscar/crear usuario
   por email+dominio → emitir el mismo par JWT/refresh actual. SAML en una
   segunda iteración (`@node-saml/passport-saml`).
3. Mapeo de roles: `role` por defecto `EMPLOYEE` + tabla de override por email
   o grupo del IdP (`groups` claim → `Role`).
4. Frontend: en `LoginPage`, campo "empresa" o detección por dominio de email
   para ofrecer "Ingresar con SSO"; mantener login local para admins.
5. Seguridad: `state`/`nonce` PKCE, whitelist de redirect, e2e del aislamiento
   (usuario SSO queda siempre en scope de su empresa).

## Orden sugerido y dependencias

1. **9.1 Consola de entregas** — sin dependencias, valor operativo inmediato,
   cierra el ciclo de la cola existente (≈1 iteración).
2. **9.3 GHCR por SHA** — independiente; habilita despliegues limpios del resto
   (≈1 iteración, sobre todo workflow + compose prod).
3. **9.2 Backups cifrados** — depende de tener dónde desplegar (beneficia de
   9.3) y define el proceso de restauración antes de SSO (≈1 iteración).
4. **9.4 SSO OIDC/SAML** — la más grande: diseño de datos + flujo federado +
   UI (2 iteraciones; OIDC primero, SAML después).

Criterio de cierre de la fase: QA en navegador (patrón `scripts/qa-phase8.mjs`)
para 9.1 y 9.4, restauración real de un backup cifrado para 9.2, y despliegue
desde GHCR en un entorno limpio para 9.3.
