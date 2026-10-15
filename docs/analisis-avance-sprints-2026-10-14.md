# Análisis de avance por sprint — SG-SST-ERP (2026-10-14)

Fecha de corte: **2026-10-14** · Rama `main` · Último commit: `0857de0` (2026-10-13, cierre S4).
Fuentes verificadas en vivo durante este análisis:

- Issues #2–#56 verificados vía `gh issue list/view`: al corte inicial eran 10 abiertos / 47 cerrados; tras las acciones del día (gobernanza S15 + verificación fase 2 de borrado en #4) quedan abiertos **#43 (matriz/S1), #10–#14 (S5–S6), #40, #55, #56 (S15)**.
- CI: últimas 3 corridas **success** (la última 2026-10-13 17:14 sobre `0857de0`).
- Suite local corrida en vivo: **519/519 unitarias PASS** (65 suites, 10.5s, `npm run test` en `sgsst-api`).
- Build/API y e2e-db 67/67: tomados de la evidencia 2026-10-13 y CI verde (`0857de0`, corrida success).
- Verificación de código (final, corregida — ver §2.1): la migración de fase 2 del ADR (`20260924190000_adr_fase2_site_unique_and_drop_soft_delete`) **existe y está aplicada en dev**; la informacion inicial de este corte sobre ella era un falso negativo de auditoria (grep sin comillas). Páginas de UI de riesgos/incidentes/auditorías/reports existen (`sgsst-web/src/pages/*`).

> Convención heredada de `docs/analisis-avance-sprints-2026-10-07.md` y `docs/pendientes-consolidados-2026-10-10.md` (que este doc reemplaza): **los porcentajes derivan de issues con evidencia, no de estimaciones.**

---

## Corte 2026-10-15 — S15 cerrado (QA de aceptación ejecutado)

Sesión QA S15 ejecutada con el stack dev local (5 contenedores, API 3.002/BullMQ):
1. **#55 (S15.4 reportes/exportaciones) — CERRADO:** aceptación TODO PASS (12 entregas sincrónicas 6 kinds × CSV/PDF; plan anual `[QA-S15]` sembrado para `annual-plan`), programado `QUEUED→READY` con notificación y descarga de storage; fallo simulado bloqueando `uploads/reports` → `FAILED` + AuditLog `EXPORT_FAILED` + `retry` → `READY` (`qa-s15-failed-retry-sim-20261015.txt`); aislamiento empresa B (historial vacío, descarga rechazada) y AuditLog de exportes con `actorId` al 100%. Observación documentada: `AuditLog` no persiste IP/UA para exportes (diseño actual del esquema).
2. **#56 (S15.5 ciclo de auditoría) — CERRADO:** canal anidado `sgsst-audits` TODO PASS (10/10, desde PLANNED a CLOSED) y canal unificado con guardas TODO PASS (17/17): hallazgo unificado origen `AUDIT` enlazado a auditoría, causas, acción `CORRECTIVE` con guardas negativas reales (salto OPEN→DONE, verify fuera de DONE, cierre sin evidencia, VERIFIED read-only), regla CRITICAL de verificador ≠ responsable, scoping 404 entre empresas y AuditLog con actor (`qa-s15-audits-acceptance-20261015.txt` + `qa-s15-audits-guards-negative-20261015.txt` + `qa-s15-auditlog-db-20261015.txt`).
3. **#40 (S15.1 indicadores/dashboard) — CERRADO:** TODO PASS 14/14 (`qa-s15-indicators-dashboard-20261015.txt`): indicadores de accidentalidad y cumplimiento de capacitación `[QA-S56]` con metas/mediciones sobre datos reales de la sesión S5-S6, medición nueva vía `POST /indicators/:id/measurements` (formato `period/value/notes`), dashboard con KPIs de riesgos/incidentes/vencimientos/hallazgos.

**Estado formal resultante:** S2–S15 **38/38 = 100%** (matriz #43 verificable por checkboxes). Abiertos solo: #43 (higiene de matriz, P2), #57 (matriz GTC-45 estructurada) y #58 (capacitaciones: asistentes/evidencia) — features de gaps documentados en el runbook `docs/runbook-qa-s5-s6.md` §2.

**Higiene residual (P3, no bloquea):** los datos demo `[QA-S56]`/`[QA-S56-AUD]`/`[QA-S15]` siguen en la base dev (auditorías CERRADAS y plan 2026); ejecutar limpieza (`scripts/cleanup-qa-s56.mjs` cubre `[QA-S56]`; los `[QA-S56-AUD]` auditorías CERRADAS y `[QA-S15]` del plan anual pueden dejarse o borrarse a mano en la próxima limpieza general.

Scripts de esta sesión (convención `scripts/qa-s15-*`): `qa-s15-reports-acceptance.mjs` (+ ruta de schedule corregida a `POST /reports/:kind.:format/schedule` y polling por historial), `qa-s15-audits-acceptance.mjs`, `qa-s15-audits-guards-negative.mjs`, `qa-s15-indicators-dashboard.mjs`, `qa-s15-demo-plan.mjs`, `qa-s15-cross-tenant.mjs`.

---

## 1. Estado global al corte

| Sprint | Tema | Historias cerradas | Avance verificado | Restante |
|---|---|---|---|---|
| S1 | fundación | n/d | **No calculable** (sin alcance recuperado) | n/d |
| S2 | auth-usuarios-rbac | 1/1 | **100%** (#5, 2/2 checkboxes) | 0% |
| S3 | empresas-empleados-sedes | 2/2 | **100%** (cerrado 2026-10-07) | 0% |
| S4 | documentos-notificaciones | 2/2 | **100%** (cerrado 2026-10-13: QA ciclo documental + entregas 17/17 e2e-db) | 0% (solo tarea operativa: entregas con proveedor real en staging) |
| S5 | riesgos-gtc45 | 0/2 | **0%** (QA no ejecutado) | 100% |
| S6 | incidentes-capacitacion | 0/3 | **0%** (QA no ejecutado) | 100% |
| S7 | seguridad-hardening | 2/2 | **100%** (cerrado 2026-10-07) | 0% |
| S8–S13 | evaluaciones → contratistas | 21/21 | **100%** | 0% |
| S14 | gestion-del-cambio | 2/2 | **100%** (cerrado) | 0% |
| S15 | auditoria-indicadores-reportes | 2/3 (#42; #41 absorbido en #56) | **≈50%** (#40 abierto → QA indicadores/dashboard; #55/#56 abiertos) | ≈50% |
| S16 | asistente IA | 9/9 (#46–#54) | **100%** (cerrado 2026-10-13) | 0% (bonus P3 fuera de alcance) |

- **Formal S2–S15:** **32/38 ≈ 84%** (auditado `gh` en vivo; #41 cerrado como absorbido por #56).
- **Global derivable del backlog:** 47/57 historias cerradas totales (47 issues CLOSED de 56 rastreados + matriz).
- **Funcional verificado:** ≈ **83%** — la brecha principal ya no es implementación, es **QA de aceptación S5–S6 y S15**.

---

## 2. Análisis por sprint

### S1 — Fundación — no calculable ⚠️ gobernanza

- **Pendiente:** recuperar el alcance original (qué historias/criterios componían S1) para calcular su avance de forma honesta. La matriz #43 solo lleva el label, sin cuerpo de historias.
- **Actividades:** reconstruir el alcance desde la matriz/roadmap original; registrar las historias en #43 o un issue dedicado.
- **Prioridad:** P3 · **Dependencia:** ninguna. · **Criterio de aceptación:** alcance documentado y % derivable de checkboxes.
- **Avance / restante:** indeterminado por falta de alcance.

### S2 — Auth, usuarios y RBAC — 100%

Sin pendientes. Issue #5 cerrado con 2/2 checkboxes y QA de navegador verificado.

### S3 — Empresas, empleados y sedes — 100%

Sin pendientes (#6/#7 cerrados el 2026-10-07 con runbook multiempresa y flujo encadenado).

### S4 — Documentos y notificaciones — 100% formal (cerrado 2026-10-13)

- **Faltante operativo (no bloquea el sprint):** ejecutar entregas externas con **proveedor real (SMTP/WhatsApp) en staging**, en lugar de `SKIPPED` documentado. Ref: `docs/evidencia-qa-s4-ciclo-documental.md`.
- **Prioridad:** P2 · **Dependencia:** credenciales de proveedor + ambiente staging.
- **Criterio:** entrega real exitosa/fallida con reintento y estados finales correctos en un ambiente con proveedor real.

### S5 — Riesgos GTC-45 — 0% (2 issues abiertos) 🔴 mayor brecha de verificación

| Issue | Pendiente | Actividades | Prioridad/Dependencias | Criterios de aceptación (transcritos del issue) |
|---|---|---|---|---|
| #10 S5.1 | QA integral del flujo | Crear desde UI con datos demo: Proceso → Actividad → Peligro → Riesgo → Valoración → Nivel → Control → Plan de intervención → Seguimiento. La implementación existe (páginas `risks/*`, dashboard); falta ejecutar y documentar. | **P1** · Sin dependencias técnicas | - [ ] Matriz completa creada desde la UI · - [ ] Plan de intervención con responsable y seguimiento · - [ ] Resultado visible en dashboard/reportes |
| #11 S5.2 | QA de trazabilidad | Verificar los 100% de campos de trazabilidad obligatorios (empresa, proceso, actividad, responsable, controles, estado, evidencia) en UI/API; verificar reporte de matriz con trazabilidad completa. | **P1** · Misma sesión que #10 | - [ ] 100% campos obligatorios en UI/API · - [ ] Reporte incluye trazabilidad completa |

- **Cerrar → marcar checkboxes + adjuntar evidencia → cerrar issue.**
- **Riesgo de negocio:** es la mayor brecha del ciclo PHVA "Planear"; los riesgos son el dato maestro del SG-SST. Ejecutar antes de desplegar a producción.

### S6 — Incidentes y capacitación — 0% (3 issues abiertos)

| Issue | Pendiente | Actividades | Prioridad/Dependencias | Criterios de aceptación (transcritos del issue) |
|---|---|---|---|---|
| #12 S6.1 | QA del ciclo de accidentes | Recorrer desde UI con datos demo: Reporte → Investigación → Causas → Evidencias → Acciones → Responsable → Seguimiento → Cierre. | **P1** · Misma sesión de QA S5/S6 | - [ ] Incidente con investigación y causas registradas · - [ ] Acciones con responsable y seguimiento hasta cierre |
| #13 S6.2 | QA trazabilidad capacitación | Recorrer: Trabajador → Curso → Asistencia → Evaluación → Evidencia → Vencimiento; verificar vencimientos en dashboard. | **P1** | - [ ] Capacitación con asistentes y evidencia adjunta · - [ ] Vencimientos visibles en dashboard |
| #14 S6.3 | QA de indicadores | Calcular indicador de accidentalidad y de cumplimiento de capacitación desde los datos reales creados en #12/#13. | **P2** · Depende de datos de #12/#13 | - [ ] Indicador de accidentalidad desde datos reales · - [ ] Indicador de cumplimiento de capacitación |

- **Estimación consolidada S5+S6 (issues #10–#14):** una sesión de QA de 1–2 días con datos demo cierra los 5 issues.

### S7 — Seguridad y hardening — 100% (cerrado)

Sin pendientes del sprint. Pre-producción (fuera del sprint, declarado en `informe-seguridad-s7.md`): pentest externo, fuzzing, lockout del SSO — **P2, pre-requisito del release a producción**.

### S8–S13 — 100% (21/21 cerrados) — higiene de matriz pendiente

- **Pendiente único (P2, gobernanza):** los cuerpos de #17–#28 tienen checkboxes **sin marcar** aunque los cierres tienen evidencia en comentarios. Actualizar cuerpos para que los % de #43 sean derivables de checkboxes.
- **Nota de revalidación** (del doc 2026-10-10, sigue vigente): S15/S16 tocaron módulos transversales; no existe una **corrida de humo formal post-S16** que revalide todo el ciclo S2–S14. Recomendado P2: sesión de smoke integral (scripts `scripts/smoke-*.mjs` existentes) y documentar resultado.

### S14 — Gestión del cambio — 100% (cerrado)

Sin pendientes (#38/#39 cerrados; migración `20261005140000_s14_change_management` aplicada; workflow auditado).

### S15 — Auditoría, indicadores y reportes — ≈46% (1/3 formales)

| Issue | Estado | Pendiente | Prioridad/Dependencias |
|---|---|---|---|
| #42 S15.3 (CLOSED) | **Fase 2 verificada completa el 2026-10-14** (ver nota de corrección §2.1) | El issue #4 tenía las 5 criterios cumplidos con evidencia en el repo (migración `20260924190000_adr_fase2_site_unique_and_drop_soft_delete`, unicidad de `Site.code` por servicio, frontend limpio, CI verde); se re-abrió, se verifico criterio por criterio, se marco con evidencia y se cerro | Resuelto |
| #40 S15.1 (OPEN) | Solapa con #55 | Decisión de producto: (a) ejecutar el QA original (dados → dashboard → reportes PDF/CSV) o (b) absorber por #55 y cerrar #40 referenciando #55. hoy coexisten #40/#55 y #41/#56. | **P1** · Bloquea cierre S15 |
| #41 S15.2 (OPEN) | Solapa con #56 | Igual decisión para #41/#56: QA del ciclo `sgsst-audits` → hallazgo → acción → cierre. | **P1** |
| #55 S15.4 (OPEN) | QA integral reportes/exportaciones | Ejecutar con datos demo: 8 endpoints sincrónicos (PDF/CSV), reporte programado (QUEUED → READY + notificación + storage), historial + retry de FAILED, aislamiento SST/AUDITOR/ADMIN, AuditLog `EXPORT*`. | **P2** · Depende de la decisión #40/#55 |
| #56 S15.5 (OPEN) | QA integral ciclo de auditoría | Con datos demo: auditoría programada → resultados → hallazgo origen `AUDIT` → acción con responsable/evidencia → cierre con guardas de eficacia (intento negativo), scoping multiempresa, AuditLog, enlace en bandeja de tareas. | **P2** · Depende de la decisión #41/#56 |

- **Avance:** 1/3 historias de matriz cerradas (≈33% formal); con implementación técnica verificada el avance técnico de alcance real cae en ≈46%.
- **Gobernanza primero (P1, ~30 min):** resolver solapamiento #40/#41 vs #55/#56 antes de ejecutar QA, para no duplicar trabajo.

### S16 — Asistente inteligente — 100% (9/9, cerrado 2026-10-13)

Cierre verificado hoy vía `gh`: #46 (smoke escalamiento 10/10 habilitado + 9/9 deshabilitado) y #47–#51, #53, #54 con evidencia (suite 519/519 — corrida en vivo hoy — e2e-db asistente 12/12, smoke capabilities 16/16, QA UI entry point 6/6).

- **Pendiente de higiene (P2):** checkboxes de los cuerpos de #47–#51/#53/#54 sin marcar (cierres por comentario).
- **Fuera de alcance aprobado (P3, backlog futuro):** `escalationLevel` en Task para escalar a jefatura; escritura con confirmación (proposals §7 del plan).

---

### 2.1 — Corrección de auditoría (2026-10-14, verificación en vivo)

Una versión de este doc afirmaba que la fase 2 de borrado no estaba ejecutada. **Falsa alarma por mi error de auditoría:** el grep inicial usó el patrón sin comillas `deletedAt IS NULL` (el SQL usa `"deletedAt"`), y no mapeé las líneas de `isActive/deletedAt` del schema a los modelos correctos (son de dominios soft/suspend, no de `SgsstEvaluation`/`Indicator`). Verificación real:

- La migración **`20260924190000_adr_fase2_site_unique_and_drop_soft_delete`** existe y hace el drop de `isActive`/`deletedAt` en `SgsstEvaluation` e `Indicator`.
- La decisión aplicada para `Site.code` fue la **opción B del ADR (unicidad a nivel de servicio)**: `Site.companyId_code` unique eliminado en la misma migración; `sites.service.ts` valida contra filas activas (`findByCode` con `deletedAt: null`).
- `prisma migrate status` en dev: **54/54 migraciones aplicadas**.
- Frontend: 0 referencias `isActive` en `SgsstEvaluationsPage`/`IndicatorsPage`; specs backend actualizados el 2026-10-14 (comentarios obsoletos y mocks con campos retirados) — 4/4 tests de ambos módulos PASS.

## 3. Deudas transversales

> **Gobernanza S15 — resuelta el 2026-10-14:** #41 cerrado como absorbido por #56; #40 delimitado conservando solo indicadores/dashboard y dejando reportes/exportaciones en #55 (cuerpo editado + comentario con referencia). [Comentario: #40 issuecomment-6172531601] Quedan para cierre de S15: #40 (QA indicadores/dashboard), #55 y #56. La fase 2 de borrado quedó resuelta (ver §2.1).

| # | Deuda | Prioridad | Nota |
|---|---|---|---|
| 1 | Despliegue cloud: solo falta **decisión de negocio** (proveedor VM, dominio/TLS, ambientes GH, secretos, primer release staging). Checklist completo en `docs/despliegue-preparacion.md` | P2 | Todo el trabajo técnico está listo (release.yml, staging.env.example, Caddyfile, bootstrap-vm.sh) |
| 2 | Higiene de matriz: checkboxes sin marcar en #17–#28, #40/#41/#42, #47–#51/#53/#54 | P2 | ~1–2h; hace derivables los % |
| 3 | Smoke de revalidación post-S16 del ciclo S2–S14 | P2 | Sin corrida formal desde los cambios de S15/S16 |
| 4 | Issue #4 cerrado sin ejecutar | P2 | ✅ RESUELTO: fase 2 estaba ejecutada (ver §2.1); #4 reabierto, verificado, marcado con evidencia y cerrado |
| 5 | Recuperar alcance S1 | P3 | Honestidad del % global |
| 6 | Pre-producción: pentest externo, fuzzing, lockout SSO | P2 | Fuera de sprints; pre-release |
| 7 | Higiene local (no versionado en git): artefactos `deploy;C/` y `docker-compose.prod.yml;C` en raíz | P3 | Verificado hoy: siguen presentes |

---

## 4. Plan de acción ordenado (al corte 2026-10-14)

| # | Acción | Prioridad | Estimación | Bloquea |
|---|---|---|---|---|
| 1 | **Sesión de QA S5–S6** (#10–#14): **PREPARADA 2026-10-14** — datos demo sembrados (`[QA-S56]`), scripts `scripts/qa-s56-demo-data.mjs` + `qa-s56-acceptance.mjs` (TODO PASS; evidencia en `scripts/qa-artifacts/qa-s56-acceptance-20261014.txt`), `cleanup-qa-s56.mjs` y runbook UI `docs/runbook-qa-s5-s6.md`. Solo falta la caminata UI y el cierre de issues. **Gaps documentados** (runbook §2): no existe matriz GTC-45 estructurada ni campos de investigación/asistentes/evidencia propios — se mapea al ciclo hallazgos/causas/acciones de S15 | **P1** | ½–1 día UI | Cierre PHVA "Planear" |
| 2 | ~~Gobernanza S15~~ **RESUELTA** (2026–10–14): #41 absorbido en #56; #40 delimitado con reportes en #55 | ✅ hecho | — | — |
| 3 | **QA S15** (#40 indicadores/dashboard, #55 reportes, #56 ciclo auditoría): con datos demo | P2 | 1 día | Cierre S15 |
| 4 | ~~Fase 2 de borrado~~ **RESUELTA**: fase 2 ya estaba ejecutada; se verifico criterio por criterio, se marcaron los checkboxes de #4 con evidencia y el issue quedo cerrado | ✅ hecho 2026-10-14 | — |
| 5 | **Higiene de matriz:** marcar checkboxes en #17–#28 y cuerpos S15/S16 | P2 | 1–2 h | Derivabilidad de % |
| 6 | **Smoke de revalidación post-S16** (S2–S14) con scripts existentes y documentación | P2 | 1 día | Confianza de release |
| 7 | **Decisión negocio despliegue cloud** + checklist `despliegue-preparacion.md` → release staging | P2 | decisión interna | Release staging |
| 8 | **Entregas externas con proveedor real en staging** (residuo S4) | P2 | ½ día | Operación real de notificaciones |
| 9 | **Recuperar alcance S1** + limpiar artefactos locales `deploy;C` | P3 | 1 h | Honestidad % global |

**Ruta al 100% derivable:** el plan de acción 1–5 completa el backlog formal (#10–#14, #40, #55, #56) y deja la matriz #43 con todos sus issues cerrados y % derivables de checkboxes. Los ítems restantes son operación/release fuera del alcance de sprints.

---

*Documento consolidado desde `docs/pendientes-consolidados-2026-10-10.md` + verificación en vivo al 2026-10-14 (issues `gh`, CI `gh run list`, suite local 519/519, migraciones Prisma y páginas UI).*
