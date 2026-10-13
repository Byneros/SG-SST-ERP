# Evidencia smoke S16.1 — escalamiento de tareas vencidas (issue #46)

Fecha: 2026-10-13 · Rama `main` · Commit de implementación: `e70a819` (S16.1).
Cierra los 4 criterios de aceptación del issue #46 y, con ello, el sprint S16
(9/9 formal — ver `docs/pendientes-consolidados-2026-10-10.md`).

## 1. Script

`scripts/smoke-tasks-escalation.mjs` (existente, ajustado en esta sesión):
crea una tarea vencida `[SMOKE]` con `ownerId` del actor, fuerza una pasada
manual (`POST /notifications/task-escalation/run`), verifica `Notification`,
`ExternalDelivery`, anti-duplicado, RBAC (401 sin token) y limpia los
recursos `[SMOKE]` (verificada HTTP 200/204).

Ajuste realizado: la corrida original creaba la tarea sin owner, disparaba el
fallback documentado a ADMIN/SST (`created=3`) y el paso fallaba porque el
chequeo exigía `ownerId`. El script ahora resuelve el id vía `/auth/me`
(`me.sub ?? me.id ?? me.user?.id`) y asigna `ownerId` en la creación,
validando la ruta principal (owner) y no solo el fallback.

## 2. Resultado modo habilitado (10/10 PASS)

Instancia HTTP local (puerto 3003) con `DOTENV_CONFIG_PATH` apuntando a un
`.env` temporal de QA (eliminado tras la corrida) contra la **BD/Redis dev
reales** (`DATABASE_URL` del contenedor, host cambiado a `localhost:5434`),
con:

- `TASK_ESCALATION_ENABLED=true`
- `EMAIL_ENABLED=false` · `WHATSAPP_ENABLED=false` (canales externos apagados
  → camino SKIPPED esperado)

```text
PASS  S0 login
PASS  S0 auth/me — company=1472d34f-… userId=presente
PASS  S16.1 capabilities expone enabled/cron/advanceDays — enabled=true cron=0 8 * * * advanceDays=3
PASS  S16.1 tarea vencida creada — id=752a0ed2-…
PASS  S16.1 pasada manual responde — {"success":true,"scanned":1,"created":3,…}
PASS  S16.1 notificacion de escalamiento creada (owner/admin) — notifications=1 ownerId=27d9058d-…
PASS  S16.1 ExternalDelivery registrada (o SKIPPED si canales apagados) — deliveries=1 status=SKIPPED
PASS  S16.1 segunda pasada no duplica (anti-duplicado del mismo dia) — antes=1 despues=1
PASS  S16.1 sin token responde 401
PASS  limpieza de recursos [SMOKE]
== Smoke S16.1: 10/10 pasos OK ==
```

Correspondencia con los criterios de #46:

1. **Notificación + ExternalDelivery con canal habilitado / SKIPPED si apagado** — PASS: la pasada manual creó la notificación para el owner (`entity=Task*) y la `ExternalDelivery` quedó `SKIPPED` (canales externos deshabilitados) sin afectar la notificación interna.
2. **Anti-duplicado por tarea/canal/día e hito** — PASS: segunda pasada consecutiva crea 0 notificaciones nuevas (`antes=1 despues=1`).
3. **Smoke con tarea vencida + pasada manual** — PASS: completa, con limpieza `[SMOKE]` verificada.
4. **`TASK_ESCALATION_ENABLED=false` degrada sin errores** — PASS: verificado con el mismo script contra la API del contenedor (modo deshabilitado, §3) por HTTP real, y por la unit spec de la suite.

## 3. Resultado modo deshabilitado (9/9 PASS)

Mismo script contra `http://localhost:3002/api/v1` (contenedor `sgsst_api`
reconstruido con `d243f86`; `TASK_ESCALATION_*` no definidos en compose →
`env.ts` resume `false`):

```text
PASS  S0 login
PASS  S0 auth/me — company=1472d34f-… userId=presente
PASS  S16.1 capabilities expone enabled/cron/advanceDays — enabled=false cron=0 8 * * * advanceDays=3
PASS  S16.1 tarea vencida creada — id=a0b59d2d-…
PASS  S16.1 pasada manual responde — {"success":true,"queued":true,"jobId":"533"}
PASS  S16.1 notificacion … — omitida: escalamiento deshabilitado
PASS  S16.1 segunda pasada no duplica — omitida: escalamiento deshabilitado
PASS  S16.1 sin token responde 401
PASS  limpieza de recursos [SMOKE]
== Smoke S16.1: 9/9 pasos OK ==
```

Complemento de suite: `notifications-due-alerts.spec.ts` incluye el caso
unidad **"devuelve skipped con created=0 cuando TASK_ESCALATION_ENABLED=false"**
(incluido en las 519/519 unitarias del corte).

## 4. Contexto al momento de la evidencia

- Unitarias 519/519 · e2e-db 67/67 · builds API/web OK (corridas en la misma sesión, commit `d243f86`).
- El contenedor del API quedó reconstruido con el código actual (`docker compose up -d --build api`), lo que también actualiza el entorno dev para QA posterior.
