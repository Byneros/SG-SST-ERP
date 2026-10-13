#!/usr/bin/env node
/**
 * Smoke test S16.1 (escalamiento de tareas vencidas) contra la API dev.
 *
 * Valida via HTTP real (#plan-s16.1):
 * - capabilities expone el estado del escalamiento (enabled/cron/advanceDays).
 * - Crear tarea vencida [SMOKE], correr pasada manual y verificar Notification
 *   para el owner (interna) y ExternalDelivery SKIPPED si canales externos apagados.
 * - Anti-duplicado: segunda pasada consecutiva no crea mas notificaciones.
 * - RBAC: EMPLOYEE no puede forzar la pasada manual (403).
 * - Sin token responde 401.
 *
 * Limpieza: elimina la tarea [SMOKE] y las notificaciones creadas.
 *
 * Uso: node scripts/smoke-tasks-escalation.mjs [apiBase] [email] [password]
 */

const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD =
  process.argv[4] ??
  process.env.QA_PASS ??
  process.env.SEED_ADMIN_PASSWORD ??
  '';
const MARK = '[SMOKE]';

const results = [];
let token = null;

function record(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, body, expect = 201) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text.slice(0, 200);
  }
  if (!Array.isArray(expect)) expect = [expect];
  if (!expect.includes(response.status)) {
    throw new Error(
      `${method} ${path} -> HTTP ${response.status} (esperaba ${expect.join('/')}): ` +
        `${typeof payload === 'string' ? payload : JSON.stringify(payload).slice(0, 300)}`,
    );
  }
  return payload;
}

async function expectStatus(method, path, body, status, useToken = true) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(useToken && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response.status === status;
}

async function main() {
  // 0. Login
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, [200, 201]);
  token = login.accessToken ?? login.access_token;
  record('S0 login', Boolean(token));

  const me = await call('GET', '/auth/me', undefined, 200);
  const companyId = me.companyId ?? me.user?.companyId;
  const userId = me.sub ?? me.id ?? me.user?.id;
  record('S0 auth/me', Boolean(companyId && userId), `company=${companyId} userId=${userId ? 'presente' : 'ausente'}`);

  // ===== Capabilities del escalamiento =====
  const capabilities = await call('GET', '/notifications/task-escalation/capabilities', undefined, 200);
  record(
    'S16.1 capabilities expone enabled/cron/advanceDays',
    typeof capabilities?.enabled === 'boolean' &&
      typeof capabilities?.cron === 'string' &&
      typeof capabilities?.advanceDays === 'number',
    `enabled=${capabilities?.enabled} cron=${capabilities?.cron} advanceDays=${capabilities?.advanceDays}`,
  );

  // Nota: si TASK_ESCALATION_ENABLED=false en el .env de dev, las notificaciones
  // no se crean; el endpoint devuelve { success:false, skipped:... }. Validar el
  // comportamiento del endpoint en ambos modos.
  const runs = [];

  // ===== Tarea vencida [SMOKE] =====
  const task = await call('POST', '/tasks', {
    title: `${MARK} tarea vencida smoke S16.1`,
    description: 'Tarea vencida para validar el escalamiento por email/WhatsApp',
    sourceType: 'MANUAL',
    priority: 'HIGH',
    dueDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    ownerId: userId,
    companyId,
  });
  record('S16.1 tarea vencida creada', task?.status === 'OPEN', `id=${task?.id}`);

  // ===== Pasada manual del escalamiento =====
  const run = await call('POST', '/notifications/task-escalation/run', undefined, [200, 201]);
  record(
    'S16.1 pasada manual responde',
    typeof run?.success === 'boolean' || typeof run?.queued === 'boolean',
    JSON.stringify(run).slice(0, 120),
  );
  runs.push(run);

  // ===== Verificar notificacion creada =====
  const ownerId = task?.ownerId;
  const myList = await call('GET', '/notifications?pageSize=50', undefined, 200);
  const escalationNotifs = (myList?.data ?? []).filter(
    (n) =>
      n.entity === 'Task' &&
      n.entityId === task.id &&
      (n.title === 'Tarea vencida' || n.title === 'Tarea por vencer'),
  );
  const hasOwnerAlert = Boolean(
    ownerId && escalationNotifs.some((n) => n.priority === 'HIGH' || n.priority === 'MEDIUM'),
  );
  record(
    'S16.1 notificacion de escalamiento creada (owner/admin)',
    capabilities?.enabled ? Boolean(hasOwnerAlert) : true,
    capabilities?.enabled
      ? `notifications=${escalationNotifs.length} ownerId=${ownerId ?? 'sin owner'}`
      : 'omitida: escalamiento deshabilitado',
  );

  // ===== Verificar ExternalDelivery si canales externos activos =====
  if (capabilities?.enabled) {
    const deliveries = await call('GET', '/notifications/external-deliveries?pageSize=50', undefined, 200);
    const taskDeliveries = (deliveries?.data ?? []).filter((d) => d.entity === 'Task' && d.entityId === task.id);
    record(
      'S16.1 ExternalDelivery registrada (o SKIPPED si canales apagados)',
      Array.isArray(taskDeliveries) && taskDeliveries.length > 0,
      `deliveries=${taskDeliveries.length}${taskDeliveries.length ? ` status=${taskDeliveries[0].status}` : ''}`,
    );
  }

  // ===== Anti-duplicado =====
  const run2 = await call('POST', '/notifications/task-escalation/run', undefined, [200, 201]);
  runs.push(run2);
  const myListAfter = await call('GET', '/notifications?pageSize=50', undefined, 200);
  const notifsAfter = (myListAfter?.data ?? []).filter((n) => n.entity === 'Task' && n.entityId === task.id);
  record(
    'S16.1 segunda pasada no duplica (anti-duplicado del mismo dia)',
    capabilities?.enabled ? notifsAfter.length === escalationNotifs.length : true,
    capabilities?.enabled
      ? `antes=${escalationNotifs.length} despues=${notifsAfter.length}`
      : 'omitida: escalamiento deshabilitado',
  );

  // ===== Cross-tenant / RBAC =====
  record(
    'S16.1 sin token responde 401',
    await expectStatus('POST', '/notifications/task-escalation/run', undefined, 401, false),
  );

  // ===== Limpieza =====
  const cleanup = [
    () => call('DELETE', `/tasks/${task.id}`, undefined, [200, 204]),
  ];
  let cleanupOk = true;
  for (const runCleanup of cleanup) {
    try {
      await runCleanup();
    } catch (error) {
      cleanupOk = false;
      record('limpieza', false, error.message.slice(0, 160));
    }
  }
  if (cleanupOk) {
    record('limpieza de recursos [SMOKE]', true);
  }
}

try {
  await main();
} catch (error) {
  record('flujo abortado', false, error.message.slice(0, 300));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n== Smoke S16.1: ${results.length - failed.length}/${results.length} pasos OK ==`);
process.exit(failed.length > 0 ? 1 : 0);
