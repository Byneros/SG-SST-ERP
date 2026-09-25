# Evidencia de implementacion S9 (issues #21-#24)

> Pegar cada bloque como comentario en el issue correspondiente. La aceptacion
> formal (checkboxes del issue #43) queda pendiente de validacion con BD dev
> real y UI, segun el flujo Codigo -> Prueba -> Evidencia -> Checkbox -> Cierre.

## S9.1 - Issue #21 (Inspecciones planeadas: modelo + API + UI + scope)

**Estado implementacion:** completa (backend + UI).

- Modelos `PlannedInspection` + `InspectionItem` (checklist con orden/respuesta/observacion) y `InspectionFinding` (hallazgos con severidad).
- Migracion: `prisma/migrations/20260925140000_s91_planned_inspections/migration.sql`.
- API `/api/v1/planned-inspections`: CRUD con scope `resolveCompanyScope` (403/404 cross-tenant), sede e inspector validados en scope, endpoints de checklist (`PATCH items/:id?inspectionId=`, `POST :id/items`), hallazgos (`POST :id/findings`) y **acciones correctivas reutilizando `CorrectiveAction`** (`POST findings/:id/actions`, idempotente).
- RBAC: lectura ADMIN/SST/AUDITOR/EMPLOYEE; escritura ADMIN/SST; checklist AUDITOR puede responder.
- Auditoria `AuditLog` (CREATE/UPDATE/DELETE con snapshots); hard delete con cascada (ADR).
- UI: `sgsst-web/src/pages/planned-inspections/` (listado con filtro de sede compartible por URL, dialogo con checklist ejecutable in-place y hallazgos).
- Tests: `planned-inspections.service.spec.ts` (7 casos).

## S9.2 - Issue #22 (Inspecciones no planeadas: motivo, hallazgo, riesgo, accion)

**Estado implementacion:** completa (backend + UI).

- Modelo `UnplannedInspection`: `reason` obligatorio, area, sede, inspector, estado.
- Migracion: `prisma/migrations/20260925150000_s92_unplanned_inspections/migration.sql`.
- `InspectionFinding` generalizado: padre opcional (planeada o no planeada) + **`riskId` -> Risk (GTC-45) con SetNull**.
- API `/api/v1/unplanned-inspections`: CRUD con scope; `POST :id/findings` acepta `riskLevel` y **genera un Risk en la matriz GTC-45** vinculado al hallazgo (auditoria del riesgo incluida); acciones correctivas idempotentes.
- Integraciones: dashboard (`SiteKpi.inspections` / `SiteKpi.openFindings` por sede) y reporte `annual-plan` (filas de inspecciones del anio con marcador REACTIVA).
- UI: `sgsst-web/src/pages/unplanned-inspections/` (listado + dialogo de hallazgos con opcion "Genera riesgo GTC-45").
- Tests: `unplanned-inspections.service.spec.ts` (6 casos, incluida la creacion de riesgo).

## S9.3 - Issue #23 (Actos/condiciones inseguras: reporte, evidencia, accion, cierre)

**Estado implementacion:** completa (backend + UI).

- Modelo `UnsafeReport`: `kind` (UNSAFE_ACT / UNSAFE_CONDITION), severidad, sede/area, estado + `closedAt`, **reporte anonimo** (`isAnonymous`; no persiste reporter ni nombre).
- Reutiliza `InspectionFinding` con `unsafeReportId` (reporte directo, sin inspeccion padre).
- API `/api/v1/unsafe-reports`: **canal de participacion** (EMPLOYEE reporta), `findOne` oculta el reportante anonimo a EMPLOYEE y lo expone a ADMIN/SST/AUDITOR para seguimiento, acciones correctivas idempotentes, cierre sella `closedAt`.
- Auditoria y hard delete (ADR).
- UI: `sgsst-web/src/pages/unsafe-reports/` (listado con filtros tipo/estado, dialogo de reporte con switch anonimo y vista de detalle con acciones).
- Tests: `unsafe-reports.service.spec.ts` (6 casos, incluido anonimato por rol).

## S9.4 - Issue #24 (EPP: catalogo, inventario, entrega, expediente y reposicion)

**Estado implementacion:** completa (backend + UI).

- Modelos `PpeItem` (norma/certificacion, talla, vida util, `stockMin`, `stock`) y `PpeDelivery` (cantidad, firma, `dueReplacementAt`).
- Migracion: `prisma/migrations/20260925160000_s93_s94_unsafe_reports_and_ppe/migration.sql`.
- API `/api/v1/ppe`:
  - `POST /deliveries` **transaccional**: valida stock -> crea entrega -> descuenta existencias -> reporta `stockBelowMin`; stock insuficiente -> 400 sin crear entrega.
  - Reposicion automatica: `dueReplacementAt = entrega + usefulLifeDays`.
  - `GET /employee/:id`: **expediente del trabajador** con historial EPP y proximos vencimientos de reposicion (criterio de aceptacion del issue).
  - Ajustes de inventario con traza; hard delete del catalogo (ADR).
- UI: `sgsst-web/src/pages/ppe/` (pestañas Catalogo/Entregas, alerta visual de stock bajo minimo, dialogo de entrega con stock visible).
- Tests: `ppe.service.spec.ts` (6 casos: stock insuficiente, descuento, reposicion, cross-tenant, ADR).

## Integraciones transversales

- Dashboard: `SiteKpi.inspections` (planeadas + no planeadas por sede) y `SiteKpi.openFindings` (hallazgos abiertos por sede del padre).
- Reporte `annual-plan` (S8.4): incluye filas de inspecciones del anio (planeadas y REACTIVAS) con hallazgos/acciones.
- Matriz #43 (S9): al marcar estos checkboxes, S9 queda con las cuatro historias implementadas; pendiente unicamente la validacion UI + cierre formal.

## Verificacion global

- `npm test` (sgsst-api): 198/198 pruebas, 32 suites.
- `npx tsc --noEmit`: sin errores; `npm run build` API y Web OK; ESLint limpio; `prisma validate` OK.

## Pendiente para cierre formal (aceptacion)

1. `npx prisma migrate deploy` contra la BD dev (migraciones 20260925140000/150000/160000).
2. Smoke test UI de las cuatro historias (registro, ejecucion, hallazgos, acciones, EPP).
3. Marcar checkboxes en issues #21-#24 y en la matriz #43 con capturas.
