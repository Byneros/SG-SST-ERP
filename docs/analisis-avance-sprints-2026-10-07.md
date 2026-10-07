# Análisis de avance por sprint — SG-SST-ERP

Fecha de corte: **2026-10-07** (commit `e47b759`, rama `main`).

## 1. Metodología y fuentes verificadas

Porcentajes derivados de criterios **con evidencia verificada** (convención de la matriz #43: los avances derivan de checkboxes, no de estimaciones). Nada se da por completado sin verificación.

Fuentes consultadas:

- Matriz de backlog: issue #43 (38 historias, #5–#42) + issues #44, #45 vía `gh`.
- Estado de CI: 13 corridas consecutivas en rojo (verificado `gh run list`).
- Suite local: **418/418 unitarias PASS** (corrida 2026-10-07, 9.7s), consistente con evidencia S15.3 (399) + S16 framework (+19).
- Docs de evidencia: `informe-seguridad-s7.md`, `runbook-s3-1-prueba-multiempresa.md`, `evidencia-smoke-s8-s10.md`, `reconciliacion-s8-s10.md`, `evidencia-implementacion-s14.md`, `plan-sprint-s15.md`, `evidencia-implementacion-s15.md`, `sprint-16-asistente-inteligente.md`, `plan-s16-framework-asistentes.md`, `plan-escalamiento-tareas-vencidas.md`, `despliegue-preparacion.md`, `plan-fase-9-plataforma.md`.
- Commits: `e47b759` (S16 fases B/C), `9430778` (S16 plan escalamiento, solo doc), `d01019f` (S15.3), `5bef1d1` (S15.1), `0e27e7c` (S14), etc.

## 2. Estado global

| Sprint | Tema | Historias cerradas | Avance verificado | Restante |
|---|---|---|---|---|
| S2 | auth-usuarios-rbac | 1/1 | **100%** | 0% |
| S3 | empresas-empleados-sedes | 0/2 | **~40%** | 60% |
| S4 | documentos-notificaciones | 0/2 | **~25%** | 75% |
| S5 | riesgos-gtc45 | 0/2 | **0%** (QA no ejecutado) | 100% |
| S6 | incidentes-capacitacion | 0/3 | **0%** (QA no ejecutado) | 100% |
| S7 | seguridad-hardening | 0/2 | **90%** | 10% |
| S8 | evaluaciones-plan-anual | 4/4 | **100%** | 0% |
| S9 | inspecciones-epp | 4/4 | **100%** | 0% |
| S10 | medicina-laboral | 4/4 (+#44) | **100%** | 0% |
| S11 | copasst-convivencia | 2/2 | **100%** | 0% |
| S12 | emergencias | 3/3 | **100%** | 0% |
| S13 | contratistas | 4/4 | **100%** | 0% |
| S14 | gestion-del-cambio | 0/2 | **95%** | 5% |
| S15 | auditoria-indicadores-reportes | 1/3 | **~60%** | 40% |
| S16 | asistente IA (fuera de matriz) | s/i | **~45%** | 55% |

- Formal (issues cerrados / total): **23/38 = 60%**.
- Funcional verificado (evidencia técnica completa, cierre formal pendiente): **≈ 78%**.

## 3. Bloqueador P0 transversal: CI en rojo (13 corridas)

**Verificado:** la CI falla de forma consecutiva desde el commit `b931712` ("H-4: rotación de la contraseña del seed con gate en producción", 2026-10-03 17:52). Último éxito: `2026-10-03 17:32` (H-5).

- **Job que falla:** `Docker Compose` — `dependency failed to start: container sgsst_api is unhealthy`.
- **Jobs que pasan:** API (unitarias + e2e + e2e-db + build), Web, Shellcheck.
- **Causa raíz confirmada:** el job docker copia `.env.example` (que trae `SEED_ADMIN_PASSWORD=` **vacío**) y solo reemplaza `JWT_SECRET` y `METRICS_TOKEN`. El contenedor `api` corre con `NODE_ENV: production`, y `assertProductionEnv()` (`sgsst-api/src/config/env.ts` §171–183) lanza `SEED_ADMIN_PASSWORD must be rotated...` cuando la variable está vacía o es `Admin12345`. La API entra en crash-loop y el healthcheck marca unhealthy.

**Tarea única (P0):** inyectar una `SEED_ADMIN_PASSWORD` rotada en el job docker de CI (`.github/workflows/ci.yml`, paso "Prepare local .env", añadir el `sed` equivalente o un `env:` del job).

**Criterio de aceptación:** corrida de CI con los 4 jobs en verde.

**Nota:** esto contradice el "CI en verde" declarado en `docs/despliegue-preparacion.md` — actualizar ese doc al corregir.

## 4. Análisis por sprint

### S2 — Auth, usuarios y RBAC — 100%

Sin pendientes. Issue #5 cerrado con 2/2 checkboxes y evidencia de QA navegador (18 llamadas API 200/201, 0 errores CORS/consola).

---

### S3 — Empresas, empleados y sedes — ~40% (60% restante)

**Pendientes:**

| Historia | Pendiente | Actividades | Prioridad / Dependencias |
|---|---|---|---|
| #6 S3.1 (prueba integral multiempresa) | Evidencia UI + cierre formal | 1) Ejecutar el runbook `docs/runbook-s3-1-prueba-multiempresa.md` (2 empresas demo, 4 pruebas P1–P4 desde la UI). 2) Adjuntar capturas al issue. 3) Marcar 4 checkboxes y cerrar. El soporte automatizado ya está verificado: `qa-s3-isolation.mjs` **16/16 PASS** (informe S7 §1) y `multi-tenant-isolation.e2e-spec.ts`. | **P2** · Depende de stack dev sano (bloqueado solo por decisión de agenda, no técnico) |
| #7 S3.2 (E2E funcional empresa→sede→empleado→usuario) | Ejecución completa | 1) Crear desde UI: empresa → sede → empleado → usuario con rol (datos demo). 2) Login con el usuario nuevo y verificar que solo accede a su empresa. 3) Adjuntar evidencia, marcar checkboxes, cerrar. | **P2** · Depende de S2 (cerrado) y del flujo del runbook S3.1 (mismas empresas demo) |

**Criterios de aceptación (transcritos de los issues):** #6 → A no consulta empleados/sedes de B (404); A no modifica B (404); `companyId` manipulado no evade scope (403/404). #7 → creación del encadenado desde UI; el usuario creado solo accede a su empresa.

**Avance:** #6 ≈ 80% (verificado a nivel HTTP automatizado; falta evidencia UI + aceptación formal); #7 0%.

**Recomendación:** una sola sesión de QA de 1–2 h cierra ambos (empresas demo compartidas). Prioridad media: el aislamiento ya está probado automatizadamente; lo pendiente es evidencia formal y UI.

---

### S4 — Documentos y notificaciones — ~25% (75% restante)

**Pendientes:**

| Historia | Pendiente | Actividades | Prioridad / Dependencias |
|---|---|---|---|
| #8 S4.1 (QA ciclo documental) | Ejecución completa | 1) Recorrer desde UI con datos demo: crear → cargar → versionar → aprobar → publicar → vencer → notificar → archivar. 2) Verificar AuditLog en cada paso. 3) Verificar respeto de `companyId`. 4) Evidencia → checkboxes → cierre. | **P1** · Sin dependencias técnicas; usar stack dev |
| #9 S4.2 (QA entregas externas) | Corrida con entorno real | 1) Levantar stack con SMTP/WhatsApp de prueba o `SKIPPED` documentado. 2) Verificar: entrega exitosa registra intento+estado; fallo dispara reintento con backoff (`EXTERNAL_DELIVERY_*`); límite de intentos marca fallida final; aislamiento por empresa. El e2e `external-deliveries-multi-tenant.e2e-spec.ts` ya existe (commit `504f134`); falta la corrida de aceptación. | **P1** · Correr en la misma sesión de QA que S3/S5 |

**Avance:** #8 0%; #9 ≈ 50% (código+e2e en repo, corrida real pendiente).

---

### S5 — Riesgos GTC-45 — 0% verificado (100% restante)

**Pendientes:**

| Historia | Pendiente | Actividades | Prioridad / Dependencias |
|---|---|---|---|
| #10 S5.1 (flujo GTC-45 completo) | QA integral | 1) Crear desde UI: Proceso → Actividad → Peligro → Riesgo → Valoración → Nivel → Control → Plan de intervención → Seguimiento. 2) Plan con responsable y seguimiento. 3) Resultado visible en dashboard/reportes. | **P1** · El módulo subyacente está implementado (evidenciado en smokes S9: riesgo GTC-45 reactivo); falta ejecutar el QA del flujo completo |
| #11 S5.2 (trazabilidad de riesgos) | QA de campos | 1) Verificar 100% de campos de trazabilidad obligatorios en UI/API (empresa, proceso, actividad, responsable, controles, estado, evidencia). 2) Verificar que el reporte de matriz incluye la trazabilidad completa. | **P1** · Misma sesión que #10 |

**Criterios:** matriz completa creada desde UI; plan de intervención con responsable y seguimiento; resultado visible en dashboard/reportes; trazabilidad completa en reporte.

**Recomendación:** es la mayor brecha de verificación del ciclo PHVA "Planear". Ejecutar antes del despliegue a producción: los riesgos son el dato maestro del SG-SST.

---

### S6 — Incidentes y capacitación — 0% verificado (100% restante)

**Pendientes:**

| Historia | Pendiente | Actividades | Prioridad / Dependencias |
|---|---|---|---|
| #12 S6.1 (investigación de accidentes) | QA del ciclo | Reporte → Investigación → Causas → Evidencias → Acciones → Responsable → Seguimiento → Cierre, con datos demo y evidencia. | **P1** · Misma sesión de QA |
| #13 S6.2 (trazabilidad capacitación) | QA del ciclo | Trabajador → Curso → Asistencia → Evaluación → Evidencia → Vencimiento; vencimientos visibles en dashboard. | **P1** |
| #14 S6.3 (indicadores) | QA de cálculo | Indicador de accidentalidad y de cumplimiento de capacitación calculados desde datos reales. | **P2** · Depende de datos creados en #12/#13 |

**Nota:** el módulo `indicators` y la generación de hallazgos unificados (S15) existen; lo pendiente es la **verificación con datos demo** y el cierre formal.

---

### S7 — Seguridad y hardening — 90% (10% restante)

**Estado verificado:** `docs/informe-seguridad-s7.md` documenta los 5 criterios de #16 **cumplidos con evidencia reproducible**: 65/65 e2e, 26/26 e2e-db, 265→292 unitarias, `qa-s3-isolation` 16/16, `qa-s7-security-alerts` 18/18. Hallazgos H-1 (build), H-2 (doc 403 vs 404), H-3 (alertas de exámenes) corregidos; H-4 (SEED_ADMIN_PASSWORD) y H-5 (endpoint `PATCH /users/:id/unlock` con auditoría) implementados el 2026-10-03. `npm audit` 0/0 vulnerabilidades.

**Pendiente:**

| Tarea | Actividades | Prioridad / Dependencias |
|---|---|---|
| Cierre formal de #15 y #16 | 1) Comentar en #15/#16 el enlace al informe + corridas. 2) Marcar los 3 checkboxes de #15 y 2 de #16. 3) Cerrar ambos issues. | **P1** · Solo revisión humana; sin trabajo técnico |
| Cobertura NO alcanzada (declarada en el informe): pentest externo, fuzzing, lockout del SSO (los flujos OIDC mockean el IdP) | Programar como trabajo pre-producción (no bloquea cierre del sprint). | **P2** · Pre-requisito del release a producción, no del sprint |

**Avance:** criterios 100% verificados; sprint 90% por cierre formal pendiente.

---

### S8 a S13 — 100% (higiene de matriz pendiente)

Todos los issues están **cerrados** y la implementación está verificada:

- **S8** (#17–#20): plan anual, seguimiento, alertas y reportes — smoke 24/24 API + 8/8 UI (`evidencia-smoke-s8-s10.md`).
- **S9** (#21–#24): inspecciones planeadas/no planeadas, actos y condiciones inseguras, EPP con descuento de stock — verificados en el mismo smoke y en `qa-s7-security-alerts` (EPP 5→3, `dueReplacementAt` +90d).
- **S10** (#25–#28): profesiograma, exámenes con concepto ocupacional, restricciones, vigilancia epidemiológica; extensión PVE CIE-10/ausentismo (#44) **cerrada e implementada** (UI de casos, catálogo CIE-10, reporte extendido).
- **S11** (#29–#30): COPASST y Comité de Convivencia (commit `47d0d93`).
- **S12** (#31–#33): brigadas, plan de emergencias por sede, simulacros (commit `9e57ff7`).
- **S13** (#34–#37): contratistas, trabajadores, documentos, autorización de ingreso condicionada (commit `9876048`; `contractors.db-e2e-spec.ts` con PostgreSQL real).

**Pendiente único (P2, gobernanza):** los cuerpos de #17–#28 tienen los checkboxes sin marcar (los issues se cerraron con evidencia en comentarios/commits). Actualizar los cuerpos para que la matriz #43 refleje el avance real y los porcentajes sean derivables.

---

### S14 — Gestión del cambio — 95% (5% restante)

**Estado verificado:** implementación completa backend+UI (`evidencia-implementacion-s14.md`): modelos `ChangeRequest` + workflow de 7 etapas con guardas, 14 tests, smoke HTTP **19/19**, QA UI en navegador frío **pass**, migración `20261005140000_s14_change_management` aplicada en BD dev, suite 354/354 al cierre.

**Pendiente:**

| Tarea | Actividades | Prioridad / Dependencias |
|---|---|---|
| Aceptación formal de #38 y #39 | 1) Pegar los bloques de evidencia como comentarios (el doc indica "pegar cada bloque como comentario"). 2) Revisión humana. 3) Marcar checkboxes ("Solicitud con evaluación obligatoria de riesgos"; "No se cierra un cambio sin evaluación y evidencia"; "Auditoría completa del workflow") y cerrar. | **P1** · Solo revisión humana |

---

### S15 — Auditoría, indicadores y reportes — ~60% (40% restante)

**Discrepancia de trazabilidad detectada (verificada, sin comentarios en los issues):** `plan-sprint-s15.md` re-scoped el sprint a hallazgos unificados (S15.1→#40), acciones correctivas (S15.2→#41) y bandeja de tareas (S15.3→#42), y **todo eso está implementado y verificado** (399/399 tests al cierre, smokes 14/14, 25/25, 23/23, QA UI 3/3 pass). Pero los títulos reales de los issues #40 ("QA integral de indicadores y reportes") y #41 ("Auditoría SG-SST: hallazgo→acción→evidencia→cierre") corresponden al alcance **original** de la matriz, que quedó sin ejecutar formalmente.

| Historia | Estado real | Pendiente | Prioridad |
|---|---|---|---|
| #40 QA integral de indicadores y reportes | ~50% — "verificado parcialmente con demo" según el propio issue; el ciclo datos→dashboard→reporte no tiene QA integral documentado | Decisión de producto: re-denominar #40 al alcance S15.1 (hallazgos) y crear issue nuevo para el QA original, **o** ejecutar el QA de indicadores/reportes con datos demo (PDF/CSV críticos + dashboard). | **P1** |
| #41 Auditoría SG-SST (hallazgo→acción→evidencia→cierre) | ~50% — el módulo `findings` soporta origen `AUDIT` y `actions` cubre el ciclo con guardas de eficacia; falta QA específico del ciclo `sgsst-audits` → finding → acción → cierre | Igual decisión para #41 (re-denominar a acciones correctivas y crear issue nuevo, o ejecutar el QA del ciclo de auditoría). | **P1** |
| #42 Estrategia de borrado | 75% — 3/4 checkboxes marcados | Fase 2: unique parcial de `Site.code` + drop de columnas vestigiales (**issue #4**): migración + verificación dev/prod. | **P2** |

**Recomendación:** resolver la brecha de nomenclatura primero (30 min de decisión de producto); el trabajo técnico restante es un QA puntual + la migración de fase 2 de borrado.

---

### S16 — Asistente inteligente (fuera de la matriz #43) — ~45% (55% restante)

**Estado verificado:**

- **Fase 1 (16.1→16.6 legacy del plan anterior) + S16.1 escalamiento de tareas vencidas implementado (2026-10-07):**
  - Variables `TASK_ESCALATION_*` en `config/env.ts` (default `false`, no exigidas en producción) + spec.
  - `NotificationsService.escalateOverdueTasks()`: hitos según plan (por vencer 3 días → MEDIUM interna; vencida ≤3 días → HIGH interna+email owner+SST; vencida >3 días → +WhatsApp; FINDING CRITICAL → CRITICAL+WhatsApp), anti-duplicado por tarea/hito/día (notif interno y WhatsApp por empresa), take 200, fallback a SST/ADMIN sin owner, respetando scoping de tenant.
  - Job `task-escalation` en BullMQ con cron propio + pasada manual; endpoints `GET /notifications/task-escalation/capabilities` y `POST /notifications/task-escalation/run` (ADMIN/SST).
  - Smoke `scripts/smoke-tasks-escalation.mjs` (capabilities, pasada manual, notificación creada, anti-duplicado, 401, limpieza).
  - Suite: **429/429 unitarias PASS** (antes 418, +11 nuevos).
- **Fases B y C implementadas** (commit `e47b759`): framework de contratos (`ai-assistant.framework.ts`), registro declarativo con whitelist cerrada (`assistant-registry.ts`), asistente central envolviendo las 6 herramientas de fase 1, +19 tests.
- **Streaming** sigue aplazado por decisión documentada; proveedor OpenRouter verificado end-to-end.

**Pendientes (según `plan-s16-framework-asistentes.md`):**

| Fase | Alcance | Prioridad / Dependencias |
|---|---|---|
| E–J (12 asistentes especializados) | risks, incidents, findings, trainings, pve, ppe, contractors, committees, emergency, audit, indicators, documents — herramientas READ por asistente | **P2** · Dependen del framework (ya listo). Una fase por iteración, empezando por E (risks) |
| K (orquestador) | router determinista por keywords, tope 4 asistentes, síntesis final, `AI_ASSISTANT_ORCHESTRATED` | **P2** · Depende de E (≥2 asistentes para tener valor) |
| L (frontend) | entry points contextuales por módulo, `?assistant=`, capabilities ampliado; incluye QA UI del badge de escalamiento (botón opcional "Escalar ahora" en detalle de tarea) | **P2** · Depende de K |
| S16.1 fase 2 | endlich `escalationLevel` en Task para escalar a jefatura tras N hitos | **P3** · Solo si el volumen lo exige |
| Escritura con confirmación (§7) | proposals con confirmación explícita | **P3** · Posterior |

**Gobernanza:** S16 no tiene issues en la matriz (que declara 15 sprints). Crear issues por fase para hacer los porcentajes derivables de checkboxes.

**Criterios de aceptación sugeridos (del plan):** los 418 tests previos pasan sin cambios (no regresión — verificado, suite 429/429) ; e2e-db ampliado con whitelist 403 / EMPLOYEE 403 / aislamiento por asistente; smoke de `capabilities` por rol.

---

## 5. Deudas transversales

1. **Despliegue cloud (roadmap punto 1)** — todo el trabajo técnico preparado y verificado (staging.env.example, Caddyfile, bootstrap-vm.sh, release.yml con migraciones). Pendiente **solo decisión de negocio** (pendiente desde 2026-09-23): proveedor VM (recomendado Hetzner ~USD 6–8/mes), dominio/TLS, ambientes GitHub, secretos y primer release staging. Checklist completo en `docs/despliegue-preparacion.md`.
2. **CI roja** (§3) — P0.
3. **Higiene de matriz** — marcar checkboxes de #6–#16, #38–#41 y cuerpos de #17–#28 para que los porcentajes deriven de checkboxes como dicta la convención.
4. **Higiene local (no versionada):** eliminar artefactos `deploy;C/` y `docker-compose.prod.yml;C` de la raíz local (no están en git).

## 6. Plan de acción ordenado

1. **P0 — Reparar CI** (SEED_ADMIN_PASSWORD en job docker): ~15 min, sin dependencias. Desbloquea la señal de calidad para todo lo demás.
2. **P1 — Sesión de aceptación S3–S6** (1–2 días): runbook S3.1 + S3.2 + QA ciclo documental + entregas externas + GTC-45 + incidentes/capacitación con datos demo; adjuntar evidencias y cerrar #6–#14.
3. **P1 — Cierres formales sin trabajo técnico**: #15/#16 (informe S7), #38/#39 (evidencia S14), y higiene de checkboxes S8–S13.
4. **P1 — Decisión de producto S15**: re-denominar vs. ejecutar alcance original de #40/#41; luego cerrar.
5. ~~**P2 — S16.1 escalamiento**~~ **COMPLETADO 2026-10-07** (backend completo, 429/429 tests, smoke endpoint manual; queda QA UI del badge + fase E risks) y **fase E (risks assistant)** como siguiente incremento de S16.
6. **P2 — Fase 2 de borrado** (issue #4): migración `Site.code` unique + drop columnas.
7. **P2 — Decisión de despliegue**: proveedor/dominio → ejecutar checklist de `despliegue-preparacion.md`.
