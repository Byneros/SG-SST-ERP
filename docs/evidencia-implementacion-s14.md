# Evidencia de implementacion S14: gestion del cambio (issues #38 y #39)

> Pegar cada bloque como comentario en el issue correspondiente. La aceptacion
> formal (checkboxes de la matriz #43) queda pendiente de validacion con BD dev
> real y UI, segun el flujo Codigo -> Prueba -> Evidencia -> Checkbox -> Cierre.

## S14.1 - Issue #38 (Solicitud de cambio con evaluacion de riesgos obligatoria)

**Estado implementacion:** completa en backend y frontend.

- Modelos `ChangeRequest` y enum `ChangeRequestStatus` (`sgsst-api/prisma/schema.prisma`, migracion `20261005140000_s14_change_management`): titulo, descripcion, categoria de cambio, riesgo de la matriz GTC-45 (`riskId`), estado del workflow, peligros/impactos, controles, aprobador (`approvedById`/`approvedAt`), evidencia de implementacion (`implementationEvidenceId` -> `Document`) y notas de verificacion.
- API `/api/v1/change-requests` (GET list con filtros, GET `/:id`, POST, PATCH, DELETE + AuditLog) con scope `companyId` y RBAC (404 cross-tenant, no 403).
- Evaluacion de riesgos obligatoria: `POST` y `PATCH` validan que `riskId` exista y sea del tenant; no se puede desasignar el riesgo de un cambio abierto (`riskId: null` => 400).
- UI: pestana/modulo "Gestion del cambio" (`#/change-requests`, `ChangeRequestsPage.tsx`) con listado, dialogo de creacion/edicion y apertura del workflow.

## S14.2 - Issue #39 (Workflow del cambio: transiciones y trazabilidad)

**Estado implementacion:** completa en backend y frontend.

- Workflow de 7 etapas en orden estricto: `REQUESTED -> EVALUATION -> CONTROLS -> APPROVAL -> IMPLEMENTATION -> VERIFICATION -> CLOSED`. Solo avanza hacia adelante; transicion invalida => 400 con la etapa esperada.
- Guardas por etapa (`assertCanAdvance`): riesgos para salir de `REQUESTED`, peligros+impactos para salir de `EVALUATION`, controles para salir de `CONTROLS`, evidencia de implementacion para salir de `IMPLEMENTATION`, notas de verificacion para salir de `VERIFICATION`. Mensaje 400 enumera lo que falta.
- La transicion a `IMPLEMENTATION` sella `approvedById` y `approvedAt` (aprobacion trazable).
- Auditoria completa: `CHANGE_FLOW_ADVANCE` por cada transicion, ademas de CREATE/UPDATE/DELETE.
- UI: dialogo "Workflow del cambio" con chips de las 7 fases, alerta con lo pendiente de la etapa y boton "Avanzar a X" con el guard fijo.

## RBAC y multi-tenant (criterio transversal)

- Acceso: SUPER_ADMIN (todas las empresas), ADMIN/SST (gestion). EMPLOYEE sin acceso al modulo.
- Todo acceso scoping por `companyId` (`resolveCompanyScope`); riesgos y documentos de evidencia referenciados se validan same-tenant (404 si son ajenos).

## Cobertura de pruebas

- `change-requests.service.spec.ts`: 14 pruebas (CRUD con scope, 404 cross-tenant, riesgo obligatorio y same-tenant, desasignacion de riesgo en cambio abierto, guardas del workflow por etapa, sello de aprobador, auditoria por transicion).
- Suite completa backend: 354/354 tests (47 suites) al cierre de S14.

## Verificacion global (2026-10-05)

- `npm run build` (API y Web): OK. `tsc` limpio.
- Tests unitarios del modulo: 14/14 (`npx jest src/modules/change-requests`).
- `prisma migrate status` en el stack local: "Database schema is up to date!" (migracion `20261005140000_s14_change_management` aplicada en BD dev).
- Smoke HTTP del workflow completo (`scripts/smoke-s14.mjs` contra http://localhost:3002/api/v1): **19/19 pasos OK**, limpieza de recursos `[SMOKE]` OK:
  - Solicitud sin riesgo rechazada; salto de etapa `REQUESTED->CONTROLS` rechazado (400 transicion).
  - Recorrido REQUESTED -> EVALUATION -> CONTROLS -> APPROVAL -> IMPLEMENTATION -> VERIFICATION -> CLOSED con cada guard 400 probado antes de completar el dato (peligros/impactos, controles, evidencia, notas de verificacion).
  - `APPROVAL->IMPLEMENTATION` sello `approvedAt`/`approvedById`; avance sobre workflow CLOSED rechazado.
- QA UI en navegador frio (`scripts/qa-s14-verify.mjs` contra http://localhost:5176, login seed admin): **pass: true**, sin errores de consola:
  - Login OK y navegacion al item "Gestión del cambio" del menu.
  - Fila del cambio "QA S14" visible en el listado.
  - Dialogo "Workflow del cambio" con las 7 fases renderizadas (Solicitud, Evaluación, Controles, Aprobación, Implementación, Verificación, Cerrado), alerta "Registra peligros e impactos de la evaluación" y boton "Avanzar a Controles" habilitado segun guardas.
  - Captura: `scripts/qa-artifacts/s14-verify.png`.

## Pendiente de aceptacion formal (matriz #43)

1. Marcar checkboxes de los criterios de #38/#39 y cerrar los issues tras revision humana.
