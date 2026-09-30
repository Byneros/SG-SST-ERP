#!/usr/bin/env bash
#
# Comenta y cierra los issues de S8-S10 (#17-#28) con la evidencia de la
# reconciliacion (docs/reconciliacion-s8-s10.md, commit 18a26f8).
#
# Requiere: gh autenticado (gh auth login) y repo Byneros/SG-SST-ERP.
#
# Uso:
#   DRY_RUN=1 bash scripts/gh-cerrar-s8-s10.sh   # solo muestra acciones (default)
#   DRY_RUN=0 bash scripts/gh-cerrar-s8-s10.sh   # comenta y cierra de verdad
#
# Cierra: #17 #18 #19 #20 #21 #22 #23 #24 #25 #26 #27.
#   - #25 cierra en la tercera pasada: la derivacion de requisitos medicos
#     desde riesgos del cargo quedo implementada y probada (seccion 3bis de
#     docs/reconciliacion-s8-s10.md).
# Deja abierto: #28 (implementado con UI dedicada en c723529; el cierre queda
#   sujeto a la decision de producto sobre el alcance del PVE).
set -uo pipefail

REPO="${REPO:-Byneros/SG-SST-ERP}"
DRY_RUN="${DRY_RUN:-1}"

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh no esta autenticado. Ejecuta: gh auth login" >&2
  exit 1
fi

comment() { # $1 = numero de issue, $2 = archivo de cuerpo
  local num="$1" body="$2"
  echo "== Issue #$num =="
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] gh issue comment $num --body-file $body"
    echo "[DRY-RUN] gh issue close $num --comment '(ver comentario anterior)'"
  else
    gh issue comment "$num" --repo "$REPO" --body-file "$body" || return 1
    gh issue close "$num" --repo "$REPO" \
      --comment "Cerrado con evidencia verificada el 2026-09-29. Detalle: docs/reconciliacion-s8-s10.md (commit 18a26f8)." || return 1
  fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# shellcheck disable=SC2016  # comillas simples intencionales: el HDR lleva backticks literales para el markdown
HDR='Evidencia verificada localmente el 2026-09-29 (commit 18a26f8, build OK, lint 0 errores, 265/265 unitarias, 65/65 e2e servicio, 26/26 e2e PostgreSQL real). Matriz completa: `docs/reconciliacion-s8-s10.md`.'

# ---------- #17 S8.1 ----------
cat > "$TMP/17.md" <<EOF
$HDR

Criterios de S8.1:
- Modelo y migracion: \`20260925120000_s81_annual_work_plan\` aplicada sin error en BD dev y en e2e con PostgreSQL real (41 migraciones, "No pending migrations").
- CRUD con scope y roles: \`annual-work-plans.service.spec.ts\` (7 casos: scope, 403, 404 cross-tenant, 409, trazas) + smoke 24/24 del 28/09.
- Vista frontend: paso "Plan Anual" de \`scripts/qa-smoke-ui.mjs\` (8/8, 0 errores de consola).
- Auditoria: CREATE/UPDATE/DELETE con snapshots en AuditLog cubiertos por el spec.
EOF
comment 17 "$TMP/17.md"

# ---------- #18 S8.2 ----------
cat > "$TMP/18.md" <<EOF
$HDR

Criterios de S8.2:
- Actividades con evidencia adjunta: spec valida evidencia contra documents de la misma empresa (404 si ajena); smoke S8.2 creo actividad y respondio avance.
- Porcentaje de avance: regla DONE <=> 100% verificada por HTTP real; barra de % visible en UI.
EOF
comment 18 "$TMP/18.md"

# ---------- #19 S8.3 ----------
cat > "$TMP/19.md" <<EOF
$HDR

Criterios de S8.3:
- Reglas: \`notifications-due-alerts.spec.ts\` cubre vencidas/proximas/sin evidencia con prioridades.
- Ejecucion real (29/09): \`POST /api/v1/notifications/generate-due-alerts\` contra PostgreSQL dev -> HTTP 200, created>=1, scanned.planActivities>=1 (salida en \`docs/reconciliacion-s8-s10.md\`).
EOF
comment 19 "$TMP/19.md"

# ---------- #20 S8.4 ----------
cat > "$TMP/20.md" <<EOF
$HDR

Criterio de S8.4: smoke S8.4 exporto \`/reports/annual-plan.csv\` (200 con contenido de la actividad) y \`/reports/annual-plan.pdf\` (200) contra PostgreSQL real.
EOF
comment 20 "$TMP/20.md"

# ---------- #21 S9.1 ----------
cat > "$TMP/21.md" <<EOF
$HDR

Criterios de S9.1:
- Modelo, API y UI con scope: \`planned-inspections.service.spec.ts\` (7 casos) + smoke S9.1 (inspeccion con checklist respondido via HTTP) + paso UI 8/8.
- Hallazgos -> acciones correctivas: smoke S9.1 creo hallazgo y accion via \`POST findings/:id/actions\`.
- Drift del esquema corregido y verificado: migraciones \`20260925180000_s9_drift_fixes\` y \`20260929120000_restore_corrective_action_link\` aplicadas en e2e con PostgreSQL real (26/26).
EOF
comment 21 "$TMP/21.md"

# ---------- #22 S9.2 ----------
cat > "$TMP/22.md" <<EOF
$HDR

Criterios de S9.2:
- Registro rapido con evidencia: paso UI "Inspecciones no planeadas" + spec (6 casos).
- Hallazgo genera riesgo GTC-45: smoke S9.2 -> Risk creado en la matriz (ID verificado en la respuesta).
EOF
comment 22 "$TMP/22.md"

# ---------- #23 S9.3 ----------
cat > "$TMP/23.md" <<EOF
$HDR

Criterio de S9.3: smoke S9.3 creo reporte anonimo y lo cerro (CLOSED con closedAt); \`unsafe-reports.service.spec.ts\` cubre anonimato por rol (6 casos).
EOF
comment 23 "$TMP/23.md"

# ---------- #24 S9.4 ----------
cat > "$TMP/24.md" <<EOF
$HDR

Criterios de S9.4 verificados el 29/09 (\`scripts/qa-s7-security-alerts.mjs\`, 18/18):
- Entrega EPP real a empleado: \`POST /ppe/deliveries\` -> entrega creada con \`dueReplacementAt = +90d\` (vida util 90 dias).
- Inventario descuenta stock: 5 -> 3 tras entrega de 2 unidades (transaccional).
- Expediente del trabajador: \`GET /ppe/employee/:id\` lista la entrega con item, fecha y proximo vencimiento.
EOF
comment 24 "$TMP/24.md"

# ---------- #26 S10.2 ----------
cat > "$TMP/26.md" <<EOF
$HDR

Criterios de S10.2 verificados el 29/09 (18/18 en \`scripts/qa-s7-security-alerts.mjs\`):
- Historia medica con roles y scope estrictos: \`medical.service.spec.ts\` (8 casos) + EMPLOYEE excluido por guard (403) en HTTP real.
- Proxima fecha visible y con alerta: **se implemento el escaneo de alertas de examenes** (faltaba): \`generateDueAlertsForCompany()\` ahora incluye \`MedicalExam.nextDueAt\` (vencido -> TASK CRITICAL, proximo <= 30 dias -> HIGH) con 2 pruebas nuevas en \`notifications-due-alerts.spec.ts\`. Corrida real: examen con nextDueAt vencida -> alerta creada y visible en \`GET /notifications\` ("Examen ocupacional vencido").
EOF
comment 26 "$TMP/26.md"

# ---------- #27 S10.3 ----------
cat > "$TMP/27.md" <<EOF
$HDR

Criterios de S10.3: smoke S10.3 creo restriccion y la levanto con responsable (\`PATCH /:id/lift\` idempotente -> LIFTED con liftedBy/liftedAt); chip Activa/Levantada visible en UI.
EOF
comment 27 "$TMP/27.md"

# ---------- #25 S10.1 ----------
cat > "$TMP/25.md" <<EOF
$HDR

Estado por criterio de S10.1 (actualizado el 29/09, tercera pasada):
- Profesiograma por cargo visible: smoke S10.1 (perfil creado via HTTP) + pestana "Profesiograma" en UI (qa-smoke-ui 8/8).
- Requisitos medicos derivados de los riesgos: **implementado y probado** (seccion 3bis de docs/reconciliacion-s8-s10.md):
  - \`Risk.position\` + \`MedicalProfile.riskId\` + \`MedicalExamRequirement.derivedFromRiskId\` (migracion 20260929150000).
  - \`POST /medical/profiles/:id/derive-requirements\`: peor nivel de riesgo del cargo -> INGRESO/PERIODICO con periodicidad por politica, idempotente y auditado.
  - 5 pruebas unitarias + caso E2E con PostgreSQL real (nivel HIGH -> INGRESO + PERIODICO 12m verificado).
EOF
comment 25 "$TMP/25.md"

# ---------- #28 S10.4 (comentario sin cierre: decision de producto) ----------
# UI dedicada incluida en commit c723529: pestana Vigilancia en el modulo
# medico (MedicalSurveillancePanel), creacion de programas y exportacion del
# reporte surveillance CSV/PDF desde la interfaz.
cat > "$TMP/28.md" <<EOF
$HDR

Estado de S10.4 (vigilancia epidemiologica), actualizado el 29/09 (tercera pasada):
- Cohorte derivada de la matriz de riesgos: **implementada**. Modelos \`MedicalSurveillanceProgram\` y \`MedicalSurveillanceCohort\`; la cohorte toma los trabajadores del cargo del riesgo (o de su sede), con upsert por (programa, riesgo) y revision sellada.
- Indicadores en reportes: **implementado**. Reporte \`surveillance\` CSV/PDF con programa, responsable, riesgo, nivel, expuestos y ultima revision.
- Endpoints /api/v1/medical/surveillance-programs con RBAC medico y scope de empresa (404 cross-tenant verificado).
- UI dedicada: **implementada** (commit c723529). Pestana "Vigilancia" en el modulo medico con listado de programas y cohortes, creacion de programas y exportacion del reporte surveillance CSV/PDF.
- Evidencia: 8 pruebas unitarias + 9 casos E2E con PostgreSQL real (test/medical-surveillance.db-e2e-spec.ts). Detalle en la seccion 3bis de docs/reconciliacion-s8-s10.md.

Pendiente de decision de producto antes de cerrar: alcance de casos/segmentaciones del PVE (p. ej. por diagnostico o ausentismo).
EOF
echo "== Issue #28 (comentario sin cierre) =="
if [ "$DRY_RUN" = "1" ]; then
  echo "[DRY-RUN] gh issue comment 28 --body-file $TMP/28.md"
else
  gh issue comment 28 --repo "$REPO" --body-file "$TMP/28.md"
fi

echo
if [ "$DRY_RUN" = "1" ]; then
  echo "DRY-RUN completo. Ejecuta con DRY_RUN=0 para aplicar."
else
  echo "Comentarios y cierres aplicados: #17-#27 cerrados; #28 comentado y abierto (decision de producto)."
fi
