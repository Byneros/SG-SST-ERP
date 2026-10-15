# Runbook QA S5–S6 (issues #10–#14) — sesión de aceptación funcional

> Sesión: **QA con datos demo desde la UI**, 1–2 días para cerrar #10–#14.
> Preparada el 2026-10-14. Complemento de `docs/analisis-avance-sprints-2026-10-14.md` (plan de acción paso 1).
> Los porcentajes de la matriz #43 derivan de checkboxes con evidencia: esta sesión produce la evidencia.

## 0. Preparación

1. Levantar el stack dev: `docker compose up --build` (API en el puerto `API_PORT`; los scripts usan default `http://localhost:3002/api/v1` — ajustar si difiere).
2. Sembrar datos demo:
   ```bash
   node scripts/qa-s56-demo-data.mjs http://localhost:3002/api/v1 super@sgsst.com '<SEED_ADMIN_PASSWORD>'
   ```
   Siembra en las empresas demo (`[S3.1-DEMO]` Empresa A/B S.A.S.): sedes, riesgos LOW→CRITICAL con sede y cargo, hallazgo MANUAL con 2 causas, plan correctivo `IN_PROGRESS`, incidentes en 3 estados, capacitaciones vencida/próxima, indicador con metas y mediciones. Todo con marca `[QA-S56]`.
3. Verificación previa a la UI (opcional):
   ```bash
   node scripts/qa-s56-acceptance.mjs http://localhost:3002/api/v1 super@sgsst.com '<SEED_ADMIN_PASSWORD>'
   ```
   Debe terminar en `TODO PASS`. Evidencia: guardar salida en `scripts/qa-artifacts/qa-s56-acceptance-YYYYMMDD.txt`.
4. Al terminar la sesión: `node scripts/cleanup-qa-s56.mjs ...` (deja la base limpia; guarda el log como evidencia).

## 1. Recorrido UI por issue

| Issue | Pasos UI | Criterio del issue | Evidencia a adjuntar |
|---|---|---|---|
| #10 S5.1 | Riesgos → ver los 4 `[QA-S56]` con nivel/sede/cargo → Hallazgos → hallazgo `[QA-S56]` → causas → Acciones → plan correctivo `IN_PROGRESS` → Bandeja de tareas | "Matriz completa creada desde la UI"; "Plan de intervención con responsable y seguimiento"; "Resultado visible en dashboard/reportes" | Captura listado riesgos 4 niveles + detalle hallazgo con causas + dashboard con KPIs |
| #11 S5.2 | Riesgos → detalle de un riesgo HIGH → verificar campos de trazabilidad (empresa, sede, responsable/cargo, estado/nivel, descripción del peligro) → Reportes/exportaciones → verificar que los datos de riesgos aparezcan (ver §2 gaps) | "100% de campos de trazabilidad obligatorios en UI/API"; "Reporte de matriz incluye la trazabilidad completa" | Captura detalle riesgo + del reporte |
| #12 S6.1 | Incidentes → los 3 `[QA-S56]` → abrir incidente `IN_PROGRESS` → verificar hallazgo/acción creadas desde él (ciclo investigación: causas en el hallazgo + plan correctivo con avance) → cerrar flujo con incidente `RESOLVED` | "Incidente con investigación y causas registradas"; "Acciones con responsable y seguimiento hasta cierre" | Captura incidente + hallazgo con 2 causas + acción con avance |
| #13 S6.2 | Capacitaciones → `[QA-S56] vencida` (-370d) y `próxima` (+15d) → Dashboard → verificar vencimientos de capacitación visibles | "Capacitación con asistentes y evidencia adjunta"; "Vencimientos visibles en dashboard" | Captura listado capacitaciones + dashboard; **ver gap B en §2 para asistentes/evidencia** |
| #14 S6.3 | Indicadores → `[QA-S56] Índice de accidentalidad` → verificar metas (2) y mediciones (2, con nota "incidente abierto") cruzadas con los incidentes de #12 → Dashboard | "Indicador de accidentalidad calculado desde datos reales"; "Indicador de cumplimiento de capacitación" | Captura indicador + dashboard |

Criterios de cierre por issue: adjuntar evidencia, marcar los checkboxes del cuerpo y cerrar el issue con comentario.

## 2. Gaps funcionales detectados (decisión de producto ANTES de la sesión o durante)

La verificación del 2026-10-14 contra el código (`schema.prisma`, DTOs) establece que **no existe módulo dedicado de matriz GTC-45** ni campos de investigación/asistentes/evidencia en incidentes/capacitaciones. Los criterios de los issues se interpretan así hoy, o requieren desarrollo (nuevo sprint):

**Gap A — Cadena GTC-45 completa (#10, #11).** El modelo `Risk` es simple (`title`, `description`, `level`, `siteId`, `position`). No hay modelos para Proceso → Actividad → Peligro → Valoración → Control. Lo que existe: hallazgos unificados (S15) con **causas estilizadas (Ishikawa/5-porqués en texto libre)** + acciones correctivas con **causa raíz, responsable, avance y evidencia documental obligatoria en DONE** — es el canal trazable equivalente y es lo que los scripts entregan como "plan de intervención con responsable y seguimiento". No existe **reporte de matriz de riesgos** en el módulo `reports` (solo summary/employees/expired-documents/audits); el "resultado visible en dashboard/reportes" se satisface con los KPIs por sede del dashboard. Decisión: (a) aceptar el mapeo hallazgos/acciones y cerrar #10/#11 con esa evidencia, o (b) abrir issue de feature "matriz GTC-45 estructurada" y re-scope #10/#11.

**Gap B — Capacitación: asistentes/evaluación/evidencia (#13).** `Training` no tiene asistentes, evaluación ni evidencia adjunta (los alumnos/evidencias se documentan hoy como archivos en el módulo de documentos). La parte de "vencimientos visibles en dashboard" sí es verificable (capacitaciones con fecha vencida/próxima y KPIs). Decisión: cerrar #13 parcialmente documentando el gap, o abrir issue de feature.

**Gap C — Incidente: investigación estructurada (#12).** `Incident` no tiene campos de investigación/causas/evidencias propias; el canal trazable es el hallazgo `MANUAL` con causas + acción correctiva (mismo mecanismo del Gap A). Los estados de incidente (`PENDING`→`IN_PROGRESS`→`RESOLVED`) sí cubren el ciclo hasta cierre.

**Nota transversal:** con los gaps A/B/C documentados, la sesión puede ejecutarse **completa** y los issues cierran con evidencia + observación explícita; sin cerrarlos, la matriz queda frenada aunque el resto esté listo.

## 3. Comandos resumen

```bash
# 1) datos demo
node scripts/qa-s56-demo-data.mjs
# 2) pre-checar a nivel API
node scripts/qa-s56-acceptance.mjs
# ... sesión UI según §1 ...
# 3) limpieza
node scripts/cleanup-qa-s56.mjs
```
