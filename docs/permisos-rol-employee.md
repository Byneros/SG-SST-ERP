# Matriz de permisos del rol EMPLOYEE

Este documento define el contrato de permisos del rol operativo `EMPLOYEE` (trabajador) en SG-SST ERP: que puede ver, que puede crear y que le esta prohibido. Es la referencia para revisar cambios en guards, controladores y vistas del frontend.

Roles existentes: `SUPER_ADMIN`, `ADMIN`, `SST`, `AUDITOR`, `EMPLOYEE`.

Principios aplicados:

- El backend es la autoridad (`@Roles` + `RolesGuard` + `resolveCompanyScope`); el frontend solo oculta opciones para evitar 403 evitables.
- Multi-tenant: el trabajador solo ve recursos de su `companyId`; un recurso de otra empresa responde `404`.
- Mientras no haya una empresa activa en su sesion, las rutas operativas responden `403`.
- Reportes/exportaciones y vistas de backoffice quedan fuera del alcance del trabajador.

## Resumen

| Capacidad | Estado |
|---|---|
| Ver dashboard | OK |
| Ver empleados, documentos, auditorias, incidentes, riesgos y capacitaciones de su empresa (listado y detalle) | OK |
| Descargar documentos publicados | OK |
| Recibir y marcar notificaciones leidas | OK |
| Reportar incidentes (crear, con estado inicial `PENDING`) | OK |
| Editar o eliminar cualquier recurso | NO |
| Crear riesgos o capacitaciones | NO |
| Ver usuarios, empresas, mapa normativo, reportes/exportes o auditoria de plataforma | NO |
| Ver datos de otra empresa | NO (404) |

## Matriz por endpoint

`OK` = permitido. `403` = bloqueado por `RolesGuard` (RBAC). `404` = bloqueado por aislamiento multi-tenant.

### Lectura (acceso concedido)

| Endpoint | EMPLOYEE |
|---|---|
| `GET /api/v1/dashboard/summary` | OK |
| `GET /api/v1/employees`, `GET /api/v1/employees/:id` | OK |
| `GET /api/v1/documents`, `GET /api/v1/documents/:id`, `GET /api/v1/documents/:id/download` | OK |
| `GET /api/v1/sgsst-audits`, `GET /api/v1/sgsst-audits/:id` | OK |
| `GET /api/v1/incidents`, `GET /api/v1/incidents/:id` | OK |
| `GET /api/v1/risks`, `GET /api/v1/risks/:id` | OK |
| `GET /api/v1/trainings`, `GET /api/v1/trainings/:id` | OK |
| `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all` | OK |
| `GET /api/v1/auth/me` | OK |

### Escritura

| Endpoint | EMPLOYEE | Notas |
|---|---|---|
| `POST /api/v1/incidents` | OK | Unico `POST` concedido; el `companyId` proviene del token, el cliente no lo elige. Estado inicial `PENDING`. |
| `PATCH/DELETE /api/v1/incidents/:id` | 403 | Solo `ADMIN`, `SST`. |
| `POST/PATCH/DELETE /api/v1/risks` | 403 | Solo `ADMIN`, `SST`. |
| `POST/PATCH/DELETE /api/v1/trainings` | 403 | Solo `ADMIN`, `SST`. |
| `POST/PATCH/DELETE /api/v1/employees` | 403 | Solo `ADMIN`/`SST` (delete solo `ADMIN`). |
| `POST/PATCH/DELETE /api/v1/documents*` | 403 | Incluye upload y versiones; solo `ADMIN`, `SST`. |
| `POST/PATCH /api/v1/sgsst-audits*` (findings, actions) | 403 | Solo `ADMIN`, `SST`, `AUDITOR`. |
| `POST /api/v1/notifications/generate-due-alerts` | 403 | Solo `ADMIN`, `SST`. |

### Administracion y backoffice

| Endpoint | EMPLOYEE |
|---|---|
| `GET/POST/PATCH/DELETE /api/v1/users` | 403 |
| `GET/POST/PATCH/DELETE /api/v1/companies` | 403 |
| `GET/POST /api/v1/legal-compliance/*` | 403 |
| `GET /api/v1/reports/*` (exports, metrics, csv, pdf) | 403 |
| `GET /api/v1/audit-logs` | 403 |
| `GET/POST /api/v1/notifications/external-deliveries*` | 403 |

## Vistas del frontend

| Vista | EMPLOYEE | Detalle |
|---|---|---|
| Dashboard | Si | Sin botones de export (PDF/CSV/Programar). |
| Empleados | Si, solo lectura | Botones de crear/editar/eliminar deshabilitados. |
| Incidentes | Si + reportar | Puede crear por el dialogo; sin editar ni eliminar. |
| Riesgos | Si, solo lectura | Sin acciones de escritura. |
| Capacitaciones | Si, solo lectura | Sin acciones de escritura. |
| Documentos, Auditorias SG-SST, Mapa normativo, Mis reportes, Usuarios, Auditoria, Entregas externas | No | Bloqueadas en `selectView` (defensa en profundidad) y sin item en el menu. |

## Cobertura e2e

La suite `sgsst-api/test/multi-tenant-isolation.e2e-spec.ts` cubre el contrato:

- Lectura de su empresa (`allows Employee A to read its own company data`).
- Aislamiento en listados de `incidents/risks/trainings` y detalle cross-tenant 404 (`allows Employee A to read incidents/risks/trainings of its own company only`).
- Bloqueo de mutaciones sobre empleados (403) y de reportes/exports (403 en `/reports/exports`).
- Reporte de incidente que aterriza solo en su empresa e infiltracion con `companyId` ajeno rechazada (403).
- Mutaciones cross-tenant de riesgos/capacitaciones denegadas (403 RBAC, 404 de scope) (`denies Employee A cross-tenant manipulation of incidents/risks/trainings`).

## Como extender este contrato

Al agregar un endpoint o modulo:

1. Decide si el trabajador lo necesita para su operacion diaria; por defecto, no se concede.
2. Si se concede lectura, agrega `'EMPLOYEE'` solo en los verbos `GET` y manten el scope de empresa en el repositorio.
3. Si se concede escritura, evalua si el recurso debe quedar firmado y con estado inicial seguro.
4. Actualiza esta matriz y la suite e2e en el mismo cambio.
5. Si es una vista nueva, agregala a la lista `employeeBlocked` de `selectView` salvo que sea parte del autoservicio.
