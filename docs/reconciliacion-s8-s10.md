# Reconciliación S8–S10: matriz criterio → prueba (Issues #17–#28)

Fecha: 2026-09-29. Verificación local de este repositorio (commit base `fc70073`,
working tree solo con cambios de formateo del módulo developer/contractors).

Propósito: relacionar cada criterio de aceptación de los issues #17–#28 con la
prueba que lo demuestra, para actualizar los issues con justificación y sin
marcar criterios que la evidencia no cubra.

## 0. Estado técnico verificado en esta sesión

Reproducido localmente el 2026-09-29 contra el PostgreSQL del compose
(`sgsst_postgres`, puerto host 5434) y la API compilada local (puerto 3002):

| Verificación | Resultado |
|---|---|
| `npm run build` (API, tras corregir regresión de `main.ts`) | OK (exit 0) |
| `npm run build` (web) | OK (exit 0) |
| `npm run lint` (API) | 0 errores, 22 warnings preexistentes |
| `npm test` (API) | 263/263 pruebas, 40 suites |
| `npm run test:e2e` (nivel servicio) | 65/65 (incluye `multi-tenant-isolation`, `security`, `external-deliveries`) |
| `npm run test:e2e:db` (PostgreSQL real efímero) | 26/26, 41 migraciones aplicadas hasta `20260929120000_restore_corrective_action_link` |
| `node scripts/smoke-s8-10.mjs` | 24/24 (evidencia del 28/09, script reproducible verificado en repositorio) |
| `node scripts/qa-s3-isolation.mjs` (nuevo) | 16/16 (runbook S3.1, Issue #6) |

**Regresión encontrada y corregida**: `sgsst-api/src/main.ts` tenía un cambio sin
commitear que eliminaba el cast de `(app.get(AppModule) as unknown as { developerErrorEvents?: ErrorEventsService })`,
lo que rompía `nest build` (TS2339). El build compilado había quedado
enmascarado en corridas anteriores por pipes a `tail`. Corrección final: se
declaró `developerErrorEvents?: ErrorEventsService` en `AppModule` y la
asignación de `main.ts` quedó tipada sin casts (build exit 0, lint 0 errores).

## 1. Matriz S8 (Issues #17–#20)

### #17 — S8.1 Modelo, CRUD, scope, roles y auditoría del Plan Anual

| Criterio | Prueba que lo demuestra | Cobertura |
|---|---|---|
| Modelo y migración implementados | Migración `20260925120000_s81_annual_work_plan` aplicada sin error en `test:e2e:db` (26/26) y en BD dev (41 registros en `_prisma_migrations`) | Completa |
| CRUD con scope de empresa y roles | `annual-work-plans.service.spec.ts` (7 casos: scope, 403, 404 cross-tenant, 409, trazas) + smoke S8 (plan creado vía HTTP real) | Completa |
| Vista frontend con seguimiento | `qa-smoke-ui.mjs` paso "Plan Anual" (marcador de contenido, 0 errores de consola) | Completa |
| Auditoría en escrituras | Casos de trazas en el spec del servicio + `AuditLog` verificado en la suite | Completa |

**Acción**: marcar los 4 checkboxes de #17 enlazando esta matriz y
`docs/evidencia-implementacion-s8.md`; cerrar el issue.

### #18 — S8.2 Actividades con responsable, evidencia y % avance

| Criterio | Prueba | Cobertura |
|---|---|---|
| Actividades con evidencia adjunta | Spec del servicio (evidencia validada contra documents, 404 si ajena) + smoke S8.2 (actividad creada y avanzada) | Completa para API; la evidencia documental por UI queda demostrada en el diálogo del plan (qa-smoke-ui) |
| Porcentaje de avance calculado y visible | Smoke S8.2: `PATCH` avance → DONE ⇔ 100% (regla verificada) + barra de % en UI | Completa |

**Acción**: marcar los 2 checkboxes de #18; cerrar.

### #19 — S8.3 Alertas por vencimiento

| Criterio | Prueba | Cobertura |
|---|---|---|
| Reglas implementadas y probadas | `notifications-due-alerts.spec.ts` (3 condiciones OR, prioridades, mensajes) | Completa |
| Notificaciones generadas por cron | `generateDueAlertsForCompany()` corre en worker BullMQ (`NOTIFICATIONS_CRON`) y endpoint manual | Implementada; el smoke no ejecuta el cron |

**Nota**: el criterio de cron tiene cobertura de código y del worker existente,
pero el smoke no dispara el cron. Si se quiere cierre estricto, ejecutar
`POST /api/v1/notifications/generate-due-alerts` y adjuntar la respuesta. Es el
único matiz de #19 antes de marcar.

### #20 — S8.4 Reportes PDF/CSV del plan

| Criterio | Prueba | Cobertura |
|---|---|---|
| Exportación PDF/CSV del plan con datos reales | Smoke S8.4: `annual-plan.csv` 200 con contenido de la actividad + `annual-plan.pdf` 200, contra PostgreSQL real | Completa |

**Acción**: marcar el checkbox de #20; cerrar.

## 2. Matriz S9 (Issues #21–#24)

### #21 — S9.1 Inspecciones planeadas

| Criterio | Prueba | Cobertura |
|---|---|---|
| Modelo, API y UI con scope de empresa/sede | `planned-inspections.service.spec.ts` (7 casos) + smoke S9.1 (inspección con checklist creado y respondido vía HTTP) + paso UI "Inspecciones planeadas" | Completa |
| Hallazgos vinculables a acciones correctivas | Smoke S9.1: hallazgo → `POST findings/:id/actions` → acción creada | Completa |

**Acción**: marcar los 2 checkboxes de #21; cerrar. La corrección de drift del
29/09 (`20260925180000_s9_drift_fixes` + `20260929120000_restore_corrective_action_link`)
queda verificada por `test:e2e:db` (migraciones aplicadas y 26/26 PASS).

### #22 — S9.2 Inspecciones no planeadas

| Criterio | Prueba | Cobertura |
|---|---|---|
| Registro rápido desde UI con evidencia | Paso UI "Inspecciones no planeadas" + spec del servicio (6 casos) | Completa |
| Hallazgo capaz de generar un riesgo GTC-45 | Smoke S9.2: hallazgo reactivo con `riskLevel` → Risk creado en la matriz (ID verificado en respuesta) | Completa |

**Acción**: marcar los 2 checkboxes de #22; cerrar.

### #23 — S9.3 Actos y condiciones inseguras

| Criterio | Prueba | Cobertura |
|---|---|---|
| Reporte con cierre verificado y trazabilidad | Smoke S9.3: reporte anónimo creado y cerrado (`CLOSED`, `closedAt` sellado) + `unsafe-reports.service.spec.ts` (6 casos, anonimato por rol) | Completa |

**Acción**: marcar el checkbox de #23; cerrar.

### #24 — S9.4 EPP

| Criterio | Prueba | Cobertura |
|---|---|---|
| Expediente del trabajador con EPP, fecha, cantidad, evidencia y próximo vencimiento | `GET /ppe/employee/:id` implementado; cubierto por `ppe.service.spec.ts` (6 casos). El smoke lo saltea (exige empleado real con entrega) | **Parcial**: falta una corrida con entrega real a un empleado |
| El inventario descuenta el stock al entregar | Spec transaccional (stock insuficiente → 400 sin entrega; descuento verificado) | Completa en pruebas unitarias; sin corrida HTTP del flujo completo |

**Acción**: no cerrar #24 todavía. Ejecutar una entrega EPP real contra un
empleado de prueba (el smoke ya crea el empleado en su bloque S10) y adjuntar
la salida del expediente. Con eso, marcar ambos checkboxes.

## 3. Matriz S10 (Issues #25–#27; #28 sin evidencia)

### #25 — S10.1 Profesiograma

| Criterio | Prueba | Cobertura |
|---|---|---|
| Profesiograma por cargo visible | Smoke S10.1: perfil creado vía HTTP + pestaña "Profesiograma" en UI (qa-smoke-ui "Medicina laboral") | Completa |
| Requisitos médicos derivados de los riesgos | `MedicalExamRequirement` con tipos y periodicidad implementados; los casos del spec cubren modelo y 409 duplicado | **Parcial**: la derivación automática desde riesgos del cargo no está demostrada por una prueba |

**Acción**: marcar el primer checkbox de #25; revisar en el código si la
derivación de requisitos desde riesgos existe antes de marcar el segundo. Si no
existe, registrar el gap en el issue en lugar de cerrarlo.

### #26 — S10.2 Exámenes ocupacionales

| Criterio | Prueba | Cobertura |
|---|---|---|
| Historia médica por trabajador con roles y scope estrictos | `medical.service.spec.ts` (8 pruebas: RBAC, 404 cross-tenant, EMPLOYEE excluido con 404, DELETE solo ADMIN) + smoke S10.2 (examen programado y con concepto APTO) | Completa |
| Próxima fecha visible y con alerta | Campo `nextDate` implementado y visible en UI; la alerta de próximo examen no aparece en el smoke | **Parcial**: verificar la regla de alerta (worker) o adjuntar corrida de `generate-due-alerts` |

### #27 — S10.3 Restricciones

| Criterio | Prueba | Cobertura |
|---|---|---|
| Restricción vigente visible | Smoke S10.3: restricción creada + chip Activa/Levantada en UI | Completa |
| Seguimiento hasta levantamiento | Smoke S10.3: `PATCH /:id/lift` idempotente con responsable (`LIFTED`, `liftedBy`, `liftedAt`) | Completa |

**Acción**: marcar ambos checkboxes de #27; cerrar. Para #26, completar la
evidencia de alerta antes de cerrar.

### #28 — S10.4 Vigilancia epidemiológica: SIN EVIDENCIA

**Hallazgo de esta revisión**: no existe módulo, modelo Prisma ni endpoint de
vigilancia epidemiológica. La búsqueda de `epidemiolog|cohort|vigilancia` solo
encuentra menciones en documentación de fase 2 (`docs/fase-2-inventario-modulos-sgsst.md`
define `epidemiological_programs` y `pve_cases` como pendientes), un `moduleKey`
en legal-compliance y el índice normativo del asistente. Tampoco está en la
evidencia del smoke S8–S10.

**Acción**: no marcar nada en #28. El issue requiere desarrollo completo
(cohorte derivada de la matriz de riesgos, programas, seguimiento, indicadores).
La auditoría externa que agrupaba #25–#28 bajo "pruebas técnicas documentadas"
sobreextendía la evidencia: los documentos del repo solo cubren #25–#27.

## 3bis. Tercera pasada (2026-09-29): implementacion de #25.2 y S10.4

Despues de la segunda pasada se implemento lo que faltaba:

**#25.2 (Issue #25, criterio 2) — requisitos medicos derivados de los riesgos:**
- `Risk.position` (cargo opcional) con indice por empresa+cargo.
- `MedicalProfile.riskId` (link SetNull al riesgo del cargo) y
  `MedicalExamRequirement.derivedFromRiskId` (trazabilidad del origen).
- `POST /api/v1/medical/profiles/:id/derive-requirements`: toma el PEOR nivel
  de riesgo del cargo y deriva segun la politica `RISK_LEVEL_REQUIREMENTS`
  (CRITICAL -> INGRESO + PERIODICO 6m; HIGH -> INGRESO + PERIODICO 12m;
  MEDIUM -> PERIODICO 24m; LOW -> nada). Idempotente: no duplica requisitos
  ya derivados del mismo riesgo. Auditado.
- Pruebas: 5 casos unitarios nuevos + caso E2E con PostgreSQL real.

**#28 (Issue #28, S10.4) — vigilancia epidemiologica:**
- Modelos `MedicalSurveillanceProgram` (nombre, tipo de riesgo, objetivo,
  estado, responsable) y `MedicalSurveillanceCohort` (riesgo origen, estado,
  ultima revision, trabajadores expuestos via tabla de union).
- Endpoints `/api/v1/medical/surveillance-programs` (CRUD + derivar cohorte +
  revisar/cerrar cohorte), todos con RBAC medico y scope de empresa.
- La cohorte se deriva de la MATRIZ DE RIESGOS: trabajadores del mismo cargo
  del riesgo (o de su sede si el riesgo no tiene cargo). Upsert por
  (programa, riesgo): refrescar no duplica.
- Reporte `surveillance` CSV/PDF (`/api/v1/reports/surveillance.*`): una fila
  por cohorte con riesgo, nivel, numero de expuestos y ultima revision.
- Pruebas: 8 casos unitarios + 9 casos E2E con PostgreSQL real
  (`test/medical-surveillance.db-e2e-spec.ts`), incluyendo aislamiento
  cross-tenant 404 y refresco de cohorte sin duplicar.
- Migracion: `20260929150000_s10_surveillance_and_risk_position` (aplicada a
  BD dev y verificada en el E2E efimero).

## 4. Resumen de estado por issue tras esta revisión

**Actualización 2026-09-29 (segunda pasada)**: se ejecutó
`node scripts/qa-s7-security-alerts.mjs` con **18/18 PASS** contra el PostgreSQL
dev (detalle en `docs/informe-seguridad-s7.md`). Eso completa la evidencia que
faltaba en #19, #24 y #26. Además se **implementó** la alerta S10.2 que no
existía: `generateDueAlertsForCompany()` ahora escanea `MedicalExam.nextDueAt`
(vencidos CRITICAL, próximos HIGH) y el spec `notifications-due-alerts.spec.ts`
suma 2 casos nuevos (13 en total en las suites de notificaciones).

| Issue | Estado recomendado |
|---|---|
| #17, #18, #19, #20, #21, #22, #23, #24, #26, #27 | Marcar checkboxes con esta matriz + evidencia del 28/09 y del 29/09; cerrar |
| #25 | Tras la tercera pasada: **ambos criterios son marcables** (profesiograma visible + derivación de requisitos implementada y probada). Marcar y cerrar |
| #28 | Con la UI dedicada de vigilancia (commit c723529: pestaña "Vigilancia" en el módulo médico, creación de programas y exportación CSV/PDF) **todos los entregables están implementados**; el cierre queda sujeto a decisión de producto sobre el alcance del PVE (casos/segmentaciones por diagnóstico o ausentismo) |
| #28 | Tras la tercera pasada: cohortes derivadas de la matriz, programas PVE y reportes de vigilancia implementados y probados (E2E PostgreSQL real). Revisar los 2 criterios contra la evidencia de la sección 3bis y marcar/cerrar si el producto los aprueba |

Evidencia concreta de la segunda pasada (18/18):

- S10.2: examen con `nextDueAt` vencida → `POST /notifications/generate-due-alerts`
  crea la alerta (scanned.medicalExams=1, created>=1) y aparece en
  `GET /notifications` con título "Examen ocupacional vencido".
- S9.4: entrega EPP real a empleado → `dueReplacementAt = +90d` (vida útil),
  expediente del trabajador lista la entrega y el stock baja de 5 a 3.
- RBAC: EMPLOYEE con PATCH/DELETE de empleados → 403, datos médicos → 403 (guard
  `@Roles`; el 404 documentado en `evidencia-implementacion-s10.md` aplica al
  servicio, el guard responde antes), EPP entregas → 403, usuarios → 403.
- Rutas protegidas: 401 sin token, 401 con token inválido, 401 en POST anónimo.
- Lockout: 5.º intento → "Account temporarily locked"; con contraseña correcta
  sigue bloqueado (401). Desbloqueo por SQL tras la prueba.

## 5. Cómo reproducir

```bash
# Stack y verificación completa
docker compose up -d --wait
cd sgsst-api && npm run build && npm run lint:check
npm test && npm run test:e2e && npm run test:e2e:db

# Smoke S8–S10 (API en 3002 segun .env)
nohup npm start > /tmp/sgsst-api.log 2>&1 &
node scripts/smoke-s8-10.mjs

# Aislamiento S3.1 (requiere un SUPER_ADMIN temporal; ver runbook)
node scripts/qa-s3-isolation.mjs
```

El script `scripts/qa-s3-isolation.mjs` creado en esta sesión cubre el Issue #6
(S3.1): crea dos empresas `[S3ISO]` con sede, empleados, capacitación y admins,
ejecuta P1–P4 del runbook (`404` cross-tenant, `403` con companyId manipulado),
verifica que el dato ajeno no cambia y limpia. Requiere un SUPER_ADMIN porque
`resolveCompanyScope` fija la empresa activa por token
(`POST /auth/active-company`) y un ADMIN no puede operar otra empresa — exacto
el comportamiento que la prueba valida. Los residuos de corridas abortadas se
limpian con los `DELETE` por marcador `[S3ISO]` (verificados a 0 filas).
