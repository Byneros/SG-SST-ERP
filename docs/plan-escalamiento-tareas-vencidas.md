# Plan: escalamiento de tareas vencidas por email/WhatsApp

> Origen: deuda del sprint S15 (`docs/plan-sprint-s15.md` § "Fuera de alcance").
> Reutiliza el modulo de notificaciones existente; no introduce proveedores
> nuevos. Ver `docs/correo-transaccional.md` y `docs/whatsapp-alertas.md`.

## Objetivo

Cuando una `Task` activa (OPEN/IN_PROGRESS) se acerca a su vencimiento o queda
vencida, el sistema escala automaticamente al responsable (y al equipo SST de
la empresa) por los canales ya soportados: notificacion interna (siempre),
correo (SMTP) y WhatsApp (Meta Cloud API).

## Arquitectura propuesta

```text
BullMQ (cola sgsst-notifications, job "task-escalation")
   -> NotificationsQueueService (worker existente, cron nuevo)
        -> NotificationsService.escalateOverdueTasks(companyId)
             |- consulta Task activa con dueDate proxima o pasada
             |- anti-duplicado: 1 notificacion por tarea/canal/dia
             |- crea Notification (userId = ownerId o SSTs de la empresa)
             |- ExternalDelivery email y/o whatsapp (retries ya existentes)
```

Puntos de integracion con el codigo actual:

- `NotificationsQueueService` (sgsst-api/src/modules/notifications/
  notifications-queue.service.ts): agregar el job `task-escalation` con cron
  propio, junto a `generate-due-alerts` y `retry-external-deliveries`.
- `NotificationsService.generateDueAlertsForCompany()` (linea ~513) es el
  patron a copiar: consulta por empresa, creacion de `Notification` y
  delegacion de entregas externas.
- `email.service.ts` / `whatsapp.service.ts` sin cambios: solo aplican a
  prioridad HIGH/CRITICAL y registran en `ExternalDelivery`.
- Empresa: respetar `whatsappAlertsEnabled` y `whatsappAlertPhone` del CRUD
  de empresas (S7); email a `owner.email` (notificacion interna siempre).

## Reglas de escalamiento

| Momento                    | Destinatario            | Prioridad | Canales            |
|----------------------------|-------------------------|-----------|--------------------|
| Vence en 3 dias            | owner                   | MEDIUM    | interna            |
| Vencida <= 3 dias          | owner + SST             | HIGH      | interna + email    |
| Vencida > 3 dias           | owner + SST             | HIGH      | interna + email + WhatsApp |
| Tarea FINDING CRITICAL     | igual a la fila anterior| CRITICAL  | igual + WhatsApp   |

- Si la tarea no tiene `ownerId`: notificar a los usuarios ADMIN/SST de la
  empresa (mismo criterio de la generacion automatica de S15.3).
- Anti-escalamiento: no notificar tareas DONE/CANCELLED ni la misma alerta
  dos veces el mismo dia. Ventana configurable `TASK_ESCALATION_DAILY=false`
  para permitir recordatorio diario persistente (default: 1 vez por hito).

## Variables de entorno nuevas (sgsst-api)

```env
TASK_ESCALATION_ENABLED=true
TASK_ESCALATION_CRON=0 8 * * *        # diario 8am hora servidor
TASK_ESCALATION_ADVANCE_DAYS=3        # avisar N dias antes del vencimiento
TASK_ESCALATION_DAILY=false           # recordatorio diario persistente
```

`TASK_ESCALATION_ENABLED=false` deja el comportamiento actual (el cron no se
agenda y el endpoint manual responde 501-like en `capabilities`). En
produccion, `assertProductionEnv()` no exige estas variables: el escalamiento
es opcional y degrada a solo notificacion interna.

## API

- `GET /api/v1/notifications/capabilities`: exponer `taskEscalation`
  (enabled + cron) para que el dashboard muestre el estado.
- `POST /api/v1/notifications/task-escalation/run` (ADMIN/SST): fuerza una
  pasada manual para su empresa (mismo patron que
  `retry-external-deliveries`), util en QA y soporte.
- Accion desde la UI (opcional, fase 2): boton "Escalar ahora" en el detalle
  de una tarea que encola una alerta inmediata para esa tarea.

## Modelo de datos

Sin migracion nueva en fase 1: el anti-duplicado se resuelve consultando la
`Notification` del dia (por `entity='Task'`, `entityId=task.id`, titulo de
hito y `createdAt >= inicioDelDia`). Si el volumen lo exige, fase 2 agrega
`Task.escalationLevel` (Int, default 0) para escalar a jefatura tras N hitos.

## Orden de implementacion (mismo flujo que S15)

1. Schema/vars: variables en `config/env.ts` + spec de config.
2. `NotificationsService.escalateOverdueTasks(companyId)` + unit tests
   (hitos, anti-duplicado, sin owner, empresa sin WhatsApp).
3. Job en `NotificationsQueueService` con cron + spec.
4. Endpoint manual + capabilities.
5. Smoke `scripts/smoke-tasks-escalation.mjs` (crea tarea vencida, corre
   pasada manual, verifica `Notification` + `ExternalDelivery` SKIPPED si
   canales apagados) y QA UI (badge de notificaciones con la alerta).
6. Evidencia en docs y commit unico estilo "S16.1: escalamiento de tareas
   vencidas (...)".

## Riesgos y mitigaciones

- Ruido por recordatorios repetidos: anti-duplicado diario + hitos discretos.
- Empresas sin SMTP/WhatsApp configurado: `ExternalDelivery` queda SKIPPED y
  la notificacion interna se crea igual (comportamiento ya implementado).
- Task masivas vencidas tras una caida: procesar por empresa con `take`
  (paginacion) y `removeOnComplete` para no saturar la cola.
- Zona horaria: `dueDate` es fecha; comparar contra inicio/fin de dia local
  del servidor y documentar que el cron corre en hora del servidor.
