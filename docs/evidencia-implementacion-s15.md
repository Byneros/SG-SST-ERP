# Evidencia de implementacion S15: hallazgos, acciones y bandeja

> Plan y decisiones en `docs/plan-sprint-s15.md` (decisiones cerradas
> 2026-10-05: coexistencia sin migracion, verificador distinto solo para
> hallazgos CRITICAL, bandeja incluida en S15.3).

## S15.1 - Issue #40 (Hallazgos unificados)

**Estado implementacion:** completa en backend y frontend (2026-10-05).

- Modelos `Finding` y `FindingCause` + enums `FindingSourceType`
  (INSPECTION_PLANNED | INSPECTION_UNPLANNED | AUDIT | UNSAFE_REPORT | MANUAL)
  y `FindingType` (NON_CONFORMITY | OPPORTUNITY | OBSERVATION); reutiliza los
  enums globales `FindingSeverity` y `FindingStatus`. Migracion
  `20261005180000_s15_findings` aplicada en BD dev ("up to date", 51 migraciones).
- Decision S15 aplicada: coexistencia con los hallazgos por modulo; el origen
  es trazable con `sourceType`/`sourceId` y se valida same-tenant (404 si es
  ajeno o inexistente; `MANUAL` no exige origen).
- API `/api/v1/findings`: listado paginado con filtros (search, sourceType,
  severity, status) ordenado por severidad desc, GET `/:id`, POST, PATCH con
  sello de `closedAt` al cerrar, DELETE hard + AuditLog, y causas con
  `POST /:id/causes` y `DELETE /:id/causes/:causeId` (rechazadas sobre
  hallazgo cerrado, cascada al borrar el hallazgo).
- RBAC: lectura ADMIN/SST/AUDITOR; gestion (CRUD y causas) ADMIN/SST.
  Auditoria CREATE/UPDATE/DELETE por `Finding` y `FindingCause`.
- UI: vista "Hallazgos" con chips de estado, selectores de severidad/origen,
  dialogo de creacion/edicion con origen, tipo, severidad y responsable
  (usuarios de la empresa), y dialogo de detalle con causas, alta/baja de
  causas en linea y cierre rapido ("Marcar en gestion" / "Cerrar hallazgo").
  Navegacion con icono Troubleshoot y precarga del chunk.

## Verificacion S15.1 (2026-10-05)

- `npm run build` API y Web: OK (`tsc --noEmit` limpio).
- Tests backend: **366/366** (48 suites, +12 nuevas de
  `findings.service.spec.ts`: origen same-tenant 404, exigencia de sourceId,
  owner del tenant, sello de cierre, causas con guardas, auditoria).
- Smoke HTTP (`scripts/smoke-s15-findings.mjs` contra http://localhost:3002/api/v1):
  **14/14 pasos OK** con limpieza `[SMOKE]`:
  - Origen sin `sourceId` rechazado (400); origen inexistente rechazado (404).
  - Causa registrada; causa sobre hallazgo cerrado rechazada (400); baja de causa.
  - Ciclo OPEN -> IN_PROGRESS -> CLOSED con sello `closedAt`.
  - Listado con filtros (search + severity + status) encuentra el hallazgo.
- QA UI navegador frio (`scripts/qa-s15-findings-ui.mjs` contra
  http://localhost:5176, login seed admin): **pass: true**, sin errores de
  consola: setup por API del hallazgo `[QA S15]`, navegacion a "Hallazgos",
  detalle con chips (Mayor / No conformidad / Abierto), alta de causa desde el
  dialogo y limpieza por API. Captura: `scripts/qa-artifacts/s15-findings.png`.

## S15.2 - Issue #41 (Acciones correctivas, preventivas y de mejora)

**Estado implementacion:** completa en backend y frontend (2026-10-05).

- Modelo `ActionPlan` + enums `ActionKind` (CORRECTIVE|PREVENTIVE|IMPROVEMENT),
  `ActionStatus` (OPEN|IN_PROGRESS|DONE|VERIFIED|CANCELLED) y
  `ActionEffectiveness` (PENDING|EFFECTIVE|INEFFECTIVE). Migracion
  `20261005193000_s15_action_plans` aplicada en BD dev (52 migraciones).
- Workflow con guardas (#41):
  - La CORRECTIVE exige hallazgo de origen del tenant (400 sin origen, 404
    ajeno); PREVENTIVE/IMPROVEMENT pueden nacer sin no conformidad previa.
  - `DONE` exige evidencia de ejecucion (Document del tenant).
  - `VERIFIED` sella eficacia, verificador y fecha; la CORRECTIVE exige causa
    raiz y PREVENTIVE/IMPROVEMENT beneficio esperado antes de verificar.
  - Hallazgos CRITICAL: el verificador no puede ser el responsable de la accion
    (400 si coincide o si no hay responsable asignado).
  - `CANCELLED` solo desde OPEN/IN_PROGRESS, con sello de `closedAt`; la accion
    verificada queda de solo lectura.
- API `/api/v1/actions`: CRUD + `POST /:id/advance` + `POST /:id/verify`, scope
  companyId, RBAC (lectura ADMIN/SST/AUDITOR, gestion ADMIN/SST), auditoria
  `ACTION_FLOW_ADVANCE` por transicion y `ACTION_VERIFIED` al sellar eficacia.
- UI: vista "Acciones" con tabs por tipo, filtros de estado, chip de eficacia,
  vencimiento resaltado, avance rapido (iniciar/ejecutar), cancelacion con
  confirmacion, dialogo de accion (origen, causa raiz, beneficio esperado,
  responsable) y dialogo de verificacion de eficacia con alertas de guardas.

## Verificacion S15.2 (2026-10-05)

- `npm run build` API y Web: OK (`tsc` limpio).
- Tests backend: **383/383** (49 suites, +17 nuevas de
  `action-plans.service.spec.ts`: origen, evidencia, causa raiz, beneficio,
  regla CRITICAL, cancelacion y auditoria).
- Smoke HTTP (`scripts/smoke-s15-actions.mjs`): **25/25 pasos OK** con limpieza
  `[SMOKE]`, incluida la regla CRITICAL con segundo usuario (SST verifica la
  accion del admin como INEFFECTIVE).
- QA UI navegador frio (`scripts/qa-s15-actions-ui.mjs`): **pass: true** —
  accion PREVENTIVE en DONE visible, dialogo "Verificar eficacia" renderizado,
  verificacion confirmada (fila "Verificada" + "Eficaz"), sin errores de
  consola. Captura: `scripts/qa-artifacts/s15-actions.png`.

## Pendiente del sprint

- **S15.3 (issue #42):** bandeja de tareas con generacion automatica para
  hallazgos MAJOR/CRITICAL y widget en dashboard.
- Aceptacion formal de #40 y #41 en la matriz #43 tras revision humana.
