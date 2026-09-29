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
# Cierra: #17 #18 #19 #20 #21 #22 #23 #24 #26 #27
# Deja abiertos: #25 (criterio 2 sin implementar) y #28 (sin desarrollo).
set -uo pipefail

REPO="${REPO:-Byneros/SG-SST-ERP}"
DRY_RUN="${DRY_RUN:-1}"
BASE="$PWD"

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

# ---------- #25 S10.1 (solo comentario, NO cerrar) ----------
cat > "$TMP/25.md" <<EOF
$HDR

Estado por criterio de S10.1:
- [x] Profesiograma por cargo visible: smoke S10.1 (perfil creado via HTTP) + pestana "Profesiograma" en UI (qa-smoke-ui 8/8).
- [ ] Requisitos medicos derivados de los riesgos: **no implementado**. \`MedicalExamRequirement\` no tiene relacion con \`Risk\` en el esquema Prisma ni \`medical.service.ts\` consulta riesgos del cargo. Los requisitos se registran manualmente por perfil.

El issue permanece abierto hasta implementar la derivacion automatica de requisitos desde los riesgos asociados al cargo.
EOF
echo "== Issue #25 (comentario sin cierre) =="
if [ "$DRY_RUN" = "1" ]; then
  echo "[DRY-RUN] gh issue comment 25 --body-file $TMP/25.md"
else
  gh issue comment 25 --repo "$REPO" --body-file "$TMP/25.md"
fi

# ---------- #28 S10.4 (solo comentario, NO cerrar) ----------
cat > "$TMP/28.md" <<EOF
$HDR

Estado de S10.4 (vigilancia epidemiologica): **sin implementacion en el repositorio**. Verificado el 29/09:
- No existe modulo, modelos Prisma ni endpoints (busqueda de \`epidemiolog|cohort|vigilancia\` sin resultados en codigo).
- La evidencia del smoke S8-S10 no cubre este issue (solo #25-#27).
- El inventario de fase 2 (\`docs/fase-2-inventario-modulos-sgsst.md\`) define \`epidemiological_programs\` y \`pve_cases\` como pendientes.

Pendiente: desarrollo completo (cohorte derivada de la matriz de riesgos, programas PVE, seguimiento, casos, indicadores y reportes). El issue permanece abierto.
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
  echo "Comentarios y cierres aplicados: #17-#24, #26, #27 cerrados; #25 y #28 comentados y abiertos."
fi
