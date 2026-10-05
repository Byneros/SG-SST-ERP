# Plan sprint S15: acciones correctivas, preventivas y de mejora (Actuar)

> Estado: EN EJECUCION. Decisiones cerradas el 2026-10-05 (aceptadas las
> recomendaciones): 1) coexistencia sin migracion de hallazgos; 2) verificador
> distinto del responsable solo para hallazgos CRITICAL; 3) bandeja de tareas
> se mantiene en S15.3. Al cerrar S14 (gestion del cambio, #38/#39), el ciclo PHVA
> del producto tiene cubierto: **Planear** (plan anual, objetivos), **Hacer**
> (capacitaciones, EPP, inspecciones, medicina, emergencias, contratistas) y
> **Verificar** (auditorias, evaluaciones 0312, indicadores). Falta el
> **Actuar** estructurado: acciones correctivas, preventivas y de mejora con
> causa raiz, verificacion de eficacia y bandeja unificada de tareas.

## Contexto y brecha detectada

Hoy el sistema genera hallazgos en varios puntos (inspecciones planeadas con
`InspectionFinding`, inspecciones no planeadas, auditorias SG-SST,
`UnsafeReport`) pero cada uno vive aislado y el seguimiento se hace por modulo.
El inventario funcional (docs/fase-2-inventario-modulos-sgsst.md, modulos 37,
38, 39, 40 y 46) define lo que falta:

- Hallazgos unificados con severidad, origen y estado.
- Acciones correctivas con causa raiz, responsable, vencimiento, evidencia y
  verificacion de eficacia (regla legal: no conformidad mayor exige accion
  correctiva con eficacia verificada).
- Acciones preventivas y de mejora sin no conformidad previa.
- Bandeja de tareas centralizada con vencimientos y escalamiento (modulo 46).

## Objetivos del sprint (issues propuestos)

### S15.1 - Issue #40: Hallazgos unificados (findings)

- Modelos: `Finding` (companyId, sourceType
  INSPECTION_PLANNED|INSPECTION_UNPLANNED|AUDIT|UNSAFE_REPORT|INDICATOR,
  sourceId, type NC/OM/OBS, severity MINOR/MAJOR/CRITICAL, description,
  status OPEN/IN_PROGRESS/CLOSED, ownerId) y `FindingCause` (causeType,
  description).
- API `/api/v1/findings` CRUD + `/:id/causes`, scope companyId, RBAC (gestion
  ADMIN/SST, lectura + AUDITOR), hard delete con AuditLog (ADR de borrado).
- Migracion de datos: backfill opcional de hallazgos existentes de
  planned/unplanned inspections como `Finding` con su sourceType (o se deja
  coexistiendo; decidir en planificacion con el usuario).
- UI: vista Hallazgos con filtros por origen, severidad y estado; dialogo de
  detalle con causas y acciones derivadas.

### S15.2 - Issue #41: Acciones correctivas, preventivas y de mejora

- Modelos: `ActionPlan` unificado (kind CORRECTIVE|PREVENTIVE|IMPROVEMENT,
  sourceType/sourceId opcional hacia findings, rootCause, description,
  ownerId, dueDate, status OPEN/IN_PROGRESS/DONE/VERIFIED/CANCELLED,
  effectiveness PENDING/EFFECTIVE/INEFFECTIVE, evidenceId -> Document,
  verifiedById/verifiedAt).
- Reglas del dominio:
  - Cierre de una CORRECTIVE exige causa raiz y verificacion de eficacia
    (400 si falta; equivalente a las guardas de S14).
  - La verificacion de eficacia exige verificador distinto del responsable
    cuando la accion deriva de hallazgo CRITICAL.
  - PREVENTIVE/IMPROVEMENT no exigen no conformidad previa pero si beneficio
    o resultado esperado al cerrar.
- API `/api/v1/actions` CRUD + `/:id/verify`, auditoria por transicion
  (ACTION_FLOW_ADVANCE, mismo patron CHANGE_FLOW_ADVANCE).
- UI: vista Acciones con tabs por tipo, chips de estado/eficacia, dialogo de
  verificacion con fecha y responsable.

### S15.3 - Issue #42: Bandeja de tareas (seguimiento unificado)

- Modelos: `Task` (companyId, sourceType/sourceId hacia finding/action/change
  request, title, ownerId, dueDate, priority, status) y `TaskComment`.
- Generacion automatica: al crear un finding MAJOR/CRITICAL se crea una Task
  para el owner; al vencer una accion, alerta en dashboard (el worker de
  notificaciones ya existe y se reutiliza).
- API `/api/v1/tasks` con filtro "mis tareas" por ownerId, reasignacion y
  comentarios.
- UI: bandeja con filtros por responsable/prioridad/vencidas; widget resumen
  en Dashboard (vencidas, proximas 7 dias, por responsable).

## Fuera de alcance del sprint

- Escalamiento automatico por email/WhatsApp de tareas vencidas (usa el
  modulo de notificaciones existente; se deja para S16 con el asistente).
- Backfill masivo de hallazgos historicos (solo coexistencia con sourceType).
- KPIs nuevos de acciones (eficacia, reincidencia) en el modulo indicadores:
  se agregan como mediciones en un sprint posterior si hay tiempo.

## Orden de trabajo y verificacion (mismo flujo que S14)

1. S15.1 findings: schema + migracion -> modulo backend + tests -> UI ->
   smoke HTTP + QA UI (scripts qa-s15-*).
2. S15.2 acciones con guardas de eficacia: igual flujo; reutilizar el patron
   de workflow del servicio de change-requests.
3. S15.3 bandeja: igual flujo; widget de dashboard al final.
4. Evidencia en docs/evidencia-implementacion-s15.md al cierre, commit unico
   estilo "S15: ... (#40, #41, #42)".

## Decisiones (RESUELTAS 2026-10-05)

1. Coexistencia: `Finding` unificado con `sourceType`/`sourceId` hacia los
   hallazgos por modulo; sin migracion de datos historicos.
2. Verificacion de eficacia (S15.2): verificador distinto del responsable
   unicamente cuando la accion deriva de un hallazgo CRITICAL.
3. Bandeja de tareas: se mantiene en S15.3 (el patron Task es simple y el
   worker de notificaciones ya existe).
