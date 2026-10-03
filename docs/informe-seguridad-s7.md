# Informe de seguridad Sprint 7 (Issues #15 y #16)

Fecha: 2026-09-29. Entorno: stack dev del compose (`sgsst_postgres` PostgreSQL 16,
puerto host 5434), API local compilada (`nest build`, exit 0) en
`http://localhost:3002/api/v1`, commit base `fc70073`.

Criterios del issue #16: cero accesos cross-tenant, cero bypass de permisos,
lockout activo al superar `LOGIN_LOCKOUT_MAX_ATTEMPTS`, documento de resultados,
hallazgos con severidad y plan.

## 1. Ejecuciones y resultados

| Prueba | Alcance | Resultado |
|---|---|---|
| `npm run test:e2e` | Suite completa nivel servicio: `multi-tenant-isolation`, `security`, `external-deliveries-multi-tenant`, `sso-multi-tenant` | **65/65 PASS** |
| `npm run test:e2e:db` | PostgreSQL real efímero: contratistas, developer, integración Prisma (41 migraciones) | **26/26 PASS** |
| `npm test` | Unitarias completas (incluye `company-scope.spec`, `roles.guard.spec`, `jwt-auth.guard.spec`, `auth.service.spec`, `sso-*`) | **265/265 PASS** (40 suites; +2 nuevas de alertas S10.2) |
| `node scripts/qa-s3-isolation.mjs` | Aislamiento multiempresa HTTP real (Issue #6): 404 cross-tenant, 403 companyId manipulado | **16/16 PASS** |
| `node scripts/qa-s7-security-alerts.mjs` | Regresión HTTP real: rutas protegidas, RBAC, lockout, alertas | **18/18 PASS** |

## 2. Resultados por criterio del issue #16

### 2.1 Cero accesos cross-tenant — CUMPLE

- `resolveCompanyScope()` (`src/common/pipes/company-scope.ts`): usuario normal
  siempre opera con su `companyId`; `companyId` del cliente distinto → 403.
  SUPER_ADMIN requiere `activeCompanyId` emitida por `POST /auth/active-company`.
- HTTP real: `GET /employees/{id-de-B}` → 404; `PATCH` y `DELETE` cross-tenant →
  404 sin mutación del dato (verificado leyendo el recurso con superusuario);
  `GET /employees?companyId={ajeno}` → 403; `POST /risks` con companyId ajeno →
  403; `GET /incidents?companyId={ajeno}` → 403.
- Contratistas (PostgreSQL real): CRUD, workers, documents y
  `entry-authorization` con 404 cross-tenant (`contractors.db-e2e-spec.ts`).
- SSO: estados OIDC one-shot por empresa, JIT confina al usuario a su empresa,
  link de email de otra empresa rechazado (`sso-multi-tenant.e2e-spec.ts`,
  11 casos).

### 2.2 Cero bypass de permisos — CUMPLE con 1 hallazgo menor

- RBAC HTTP real con usuario EMPLOYEE: `PATCH/DELETE /employees` → 403,
  `POST /ppe/deliveries` → 403, `GET /users` → 403,
  `GET /medical/exams` → 403 (RolesGuard `@Roles`).
- `RolesGuard` concede el bypass a SUPER_ADMIN solo para el rol, no para el
  scope de empresa (verificado en la prueba S3.1: un SUPER_ADMIN con empresa
  activa A recibe 403 al operar recursos de B).
- DEVELOPER no asignable ni gestionable por la API de usuarios
  (`assertUserAssignmentScope`).
- Escaladas verticales: sin evidencia; las escrituras sensibles exigen rol
  ADMIN/SST y quedan trazadas en `AuditLog`.

### 2.3 Lockout — CUMPLE

- Configuración: `LOGIN_LOCKOUT_MAX_ATTEMPTS=5`, `LOGIN_LOCKOUT_MINUTES=15`
  (defaults de `src/config/env.ts`).
- HTTP real: 5.º intento fallido → `Account temporarily locked due to failed
  logins. Try again in 15 minutes.`; con contraseña correcta la cuenta sigue
  bloqueada (401 `Invalid credentials`... mensaje de bloqueo genérico; el
  acceso queda denegado). `registerFailedLogin()` es transaccional y resetea
  el contador si el bloqueo previo expiró; `resetLoginLockout()` limpia al
  iniciar sesión correctamente o tras password reset.
- Mensaje de login idéntico para usuario inexistente, inactivo o bloqueado:
  mitiga enumeración de cuentas.

### 2.4 JWT, refresh y rutas protegidas — CUMPLE

- `GET /employees` sin token → 401; con token inválido → 401; `POST /documents`
  anónimo → 401 (`JwtAuthGuard` valida tipo `access`).
- Access token 1h, refresh 7d con hash bcrypt en BD y rotación por sesión
  (`issueSession`).
- Rate limit global 120 req/min (`RATE_LIMIT_MAX_REQUESTS`), security headers
  vía middleware, `MetricsController` protegido por `METRICS_TOKEN`.

## 3. Hallazgos

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| H-1 | **Alta** (build) | `sgsst-api/src/main.ts` tenía un cambio sin commitear que rompía `nest build` (TS2339 en `developerErrorEvents`). Los pipelines que filtran salida por `tail` enmascaran el código de salida. No es explotable en runtime, pero impedía compilar y validar seguridad | **Corregido** el 29/09: se declaró `developerErrorEvents?: ErrorEventsService` en `AppModule` y la asignación de `main.ts` quedó tipada sin casts (build exit 0, lint 0 errores) |
| H-2 | Baja (consistencia) | `docs/evidencia-implementacion-s10.md` afirma que EMPLOYEE recibe 404 en el módulo médico; en HTTP real el RolesGuard responde **403** (el 404 del servicio aplica a llamadas directas). El efecto de seguridad es el mismo (acceso denegado), pero la documentación debe reflejar el 403 del guard | Documentado aquí y en `docs/reconciliacion-s8-s10.md` |
| H-3 | Media (cobertura funcional con impacto en alertas) | El escaneo de alertas no incluía exámenes ocupacionales: un examen vencido no generaba notificación. Se implementó el escaneo `MedicalExam.nextDueAt` (vencido → CRITICAL, próximo ≤30d → HIGH) con 2 pruebas nuevas | **Corregido** el 29/09 |
| H-4 | Informativa | Cuenta `admin@sgsst.com` del seed usa contraseña pública `Admin12345` (documentada en runbooks). Aceptable en dev; **bloqueante para producción**: rotar credenciales seed y verificar `assertProductionEnv` antes del despliegue | Pendiente (operación) |
| H-5 | Informativa | El desbloqueo de lockout requiere acceso a BD (no hay endpoint admin para desbloquear). En producción, un usuario bloqueado depende de soporte técnico | **Implementado** el 2026-10-03: `PATCH /api/v1/users/:id/unlock` (rol ADMIN; scope por `resolveCompanyScope`; 404 cross-tenant, 409 si no está bloqueado) con auditoría `UNLOCK` / `UNLOCK_REJECTED_NOT_LOCKED` y 4 pruebas unitarias. Ver sección 7 |

## 4. Cobertura NO alcanzada (transparencia)

- Penetración externa, fuzzing y análisis de dependencias (npm audit/Snyk):
  fuera de alcance de esta regresión; ejecutar antes de producción.
- Prueba de `LOGIN_LOCKOUT` del SSO (los flujos OIDC mockean el IdP; el lockout
  se validó sobre login local).
- La suite `security.e2e-spec.ts` cubre un flujo integral de permisos/soft
  delete/audit por HTTP; no duplica cada combinación rol×módulo. El matiz
  residual lo cubren los specs unitarios por servicio.

## 5. Conclusión y plan

**Los 5 criterios del issue #16 quedan verificados con evidencia reproducible.**
Cero accesos cross-tenant y cero bypass de permisos en todas las pruebas;
lockout operativo; rutas protegidas correctas. H-1 corregido, H-3 corregido con
pruebas, H-2 documentado. Antes de producción: rotar credenciales del seed
(H-4), correr análisis de dependencias (ejecutado el 2026-10-03, ver sección 6)
y ~~decidir endpoint de desbloqueo~~ H-5 implementado (ver sección 7).

## 7. Cierre posterior (2026-10-03)

### 7.1 H-5 — Desbloqueo administrativo de lockout

- Endpoint: `PATCH /api/v1/users/:id/unlock`, RBAC `@Roles('ADMIN')` (el guard
  concede SUPER_ADMIN por rol; el scope de empresa lo valida el servicio con
  `resolveCompanyScope`, misma fuente de verdad que el resto del ERP).
- Comportamiento: 404 si el usuario es de otra empresa (sin revelar existencia);
  409 `User is not locked` si no hay bloqueo vigente (idempotencia hacia atrás,
  no re-limpia contadores de un ciclo activo); en éxito limpia
  `failedLoginAttempts` y `lockedUntil` condicionalmente (`lockedUntil > now`,
  sin sellar `lastLoginAt`) y responde el estado del lock.
- Auditoría: `UNLOCK` (con before/after del lock) y `UNLOCK_REJECTED_NOT_LOCKED`
  en el 409; el 404 no audita (el recurso no existe para el actor).
- Pruebas: 4 casos unitarios nuevos en `users.service.spec.ts` (éxito con
  auditoría, 409 auditado, 404 cross-tenant sin mutación, plataforma con empresa
  activa). Suite: 292/292.
- Límite conocido: no desbloquea cuentas de otra empresa aunque el actor sea
  ADMIN de la propia (por diseño multi-tenant); SUPER_ADMIN lo hace desde su
  empresa activa seleccionada (`POST /auth/active-company`).

### 7.2 Auditoría de dependencias (recomendación del informe, ejecutada)

`npm audit` inicial: API 18 (12 high, 6 moderate), web 8 (6 high). Remediación:

| Acción | Resultado |
|---|---|
| `npm audit fix` no rompiente en ambos paquetes | API 18→7; web 8→0 |
| `nodemailer` ^8 → ^10.0.14 (major; el servicio solo usa `createTransport`/`sendMail`, sin las opciones afectadas por los CVEs) | elimina 5 high |
| Overrides puntuales en transitivas de tooling (`mysql2` 3.24.5 y `deepmerge-ts` 8.0.0 vía `prisma`; `js-yaml` 5.4.2 vía `@nestjs/swagger`) | elimina las 3 restantes; `prisma validate` verificado |
| **Final** | **API: 0 vulnerabilidades; web: 0 vulnerabilidades** |

Verificación completa tras la remediación: 292/292 unitarias, `tsc --noEmit`,
`lint:check` 0 errores y builds API/web OK. `npm audit` queda añadido al
checklist pre-release de `docs/despliegue-preparacion.md` como paso recurrente.

## 8. Cómo reproducir

```bash
docker compose up -d --wait
cd sgsst-api
npm run build && npm test && npm run test:e2e && npm run test:e2e:db
nohup npm start > /tmp/sgsst-api.log 2>&1 &   # API en 3002 (ver .env)
node scripts/qa-s3-isolation.mjs              # requiere SUPER_ADMIN temporal
node scripts/qa-s7-security-alerts.mjs        # deja la cuenta admin bloqueada:
docker exec sgsst_postgres psql -U postgres -d sgsst -c \
  "UPDATE \"User\" SET \"failedLoginAttempts\"=0, \"lockedUntil\"=NULL WHERE email='admin@sgsst.com';"
```
