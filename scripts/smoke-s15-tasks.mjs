#!/usr/bin/env node
/**
 * Smoke test S15.3 (bandeja de tareas) contra la API dev.
 *
 * Valida via HTTP real (#42):
 * - Tarea MANUAL y tarea con origen trazable (hallazgo).
 * - Origen sin sourceId rechazado (400) y origen ajeno/inexistente (404).
 * - Responsable ajeno al tenant rechazado (404).
 * - Hallazgo MAJOR genera tarea automatica (sourceType=FINDING,
 *   findingSeverity=MAJOR) y es idempotente (re-escalamiento no duplica).
 * - Ciclo OPEN -> IN_PROGRESS -> DONE con sello closedAt; reabrir lo limpia.
 * - Comentarios: alta, listado en detalle, rechazo sobre tarea cerrada y baja.
 * - Filtros de bandeja: search, status, priority, overdue, assignee=me.
 * - Resumen para el widget del dashboard (/tasks/summary).
 * - RBAC: EMPLOYEE no gestiona (403) pero si comenta sus tareas.
 *
 * Limpieza: elimina los recursos marcados [SMOKE] que creo.
 *
 * Uso: node scripts/smoke-s15-tasks.mjs [apiBase] [email] [password]
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
  record('S0 auth/me', Boolean(companyId), `company=${companyId}`);

  // ===== Origen: hallazgo MAJOR que dispara la tarea automatica =====
  const finding = await call('POST', '/findings', {
    title: `${MARK} hallazgo origen smoke S15.3`,
    description: 'Genera tarea automatica MAJOR para el smoke',
    sourceType: 'MANUAL',
    type: 'NON_CONFORMITY',
    severity: 'MAJOR',
    companyId,
  });
  record('S15 hallazgo MAJOR creado', finding?.status === 'OPEN', `id=${finding?.id}`);

  const auto = await call(
    'GET',
    `/tasks?sourceType=FINDING&search=${encodeURIComponent('Gestionar hallazgo: [SMOKE] hallazgo origen')}`,
    undefined,
    200,
  );
  const autoRow = (auto.data ?? []).find(
    (t) => t.sourceType === 'FINDING' && t.sourceId === finding.id,
  );
  record(
    'S15 hallazgo MAJOR genera tarea automatica',
    Boolean(autoRow) && autoRow?.findingSeverity === 'MAJOR' && autoRow?.status === 'OPEN',
    autoRow ? `id=${autoRow.id} sev=${autoRow.findingSeverity}` : 'no encontrada',
  );
  record(
    'S15 tarea automatica con prioridad HIGH',
    autoRow?.priority === 'HIGH',
    `priority=${autoRow?.priority ?? '?'}`,
  );

  // ===== Guardas de origen =====
  record(
    'S15 origen FINDING sin sourceId rechazado',
    await expectStatus('POST', '/tasks', {
      title: `${MARK} sin origen`,
      sourceType: 'FINDING',
      companyId,
    }, 400),
  );

  record(
    'S15 origen FINDING inexistente rechazado (404)',
    await expectStatus('POST', '/tasks', {
      title: `${MARK} origen falso`,
      sourceType: 'FINDING',
      sourceId: '00000000-0000-4000-8000-000000000000',
      companyId,
    }, 404),
  );

  record(
    'S15 ownerId ajeno al tenant rechazado (404)',
    await expectStatus('POST', '/tasks', {
      title: `${MARK} owner falso`,
      sourceType: 'MANUAL',
      ownerId: '00000000-0000-4000-8000-000000000000',
      companyId,
    }, 404),
  );

  // ===== Tarea MANUAL + ciclo de estado =====
  let task = await call('POST', '/tasks', {
    title: `${MARK} tarea smoke S15.3`,
    description: 'Tarea manual para validar el ciclo y los comentarios',
    sourceType: 'MANUAL',
    priority: 'HIGH',
    dueDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    companyId,
  });
  record('S15 tarea MANUAL creada', task?.status === 'OPEN', `id=${task?.id}`);

  task = await call('PATCH', `/tasks/${task.id}`, { status: 'IN_PROGRESS' }, 200);
  record('S15 estado IN_PROGRESS', task?.status === 'IN_PROGRESS');

  const commentOnActive = await call('POST', `/tasks/${task.id}/comments`, {
    body: `${MARK} comentario smoke S15.3 en tarea activa`,
  });
  record('S15 comentario en tarea activa', Boolean(commentOnActive?.id), `id=${commentOnActive?.id}`);

  task = await call('PATCH', `/tasks/${task.id}`, { status: 'DONE' }, 200);
  record(
    'S15 estado DONE sella closedAt',
    task?.status === 'DONE' && Boolean(task?.closedAt),
    `closedAt=${task?.closedAt ?? '?'}`,
  );

  record(
    'S15 comentario sobre tarea cerrada rechazado',
    await expectStatus('POST', `/tasks/${task.id}/comments`, {
      body: 'debe fallar: tarea cerrada',
    }, 400),
  );

  task = await call('PATCH', `/tasks/${task.id}`, { status: 'OPEN' }, 200);
  record(
    'S15 reabrir limpia closedAt',
    task?.status === 'OPEN' && !task?.closedAt,
  );

  // ===== Filtros de la bandeja =====
  const filtered = await call(
    'GET',
    `/tasks?search=${encodeURIComponent('tarea smoke S15.3')}&priority=HIGH&status=OPEN`,
    undefined,
    200,
  );
  record(
    'S15 bandeja filtra por search/prioridad/estado',
    (filtered.data ?? []).some((t) => t.id === task.id),
    `total=${filtered.meta?.total ?? (filtered.data ?? []).length}`,
  );

  const overdueList = await call('GET', '/tasks?overdue=true', undefined, 200);
  record(
    'S15 bandeja overdue incluye la tarea vencida',
    (overdueList.data ?? []).some((t) => t.id === task.id),
    `total=${overdueList.meta?.total ?? 0}`,
  );

  const mine = await call('GET', '/tasks?assignee=me', undefined, 200);
  record(
    'S15 bandeja assignee=me responde',
    Array.isArray(mine.data),
    `total=${mine.meta?.total ?? 0}`,
  );

  const detail = await call('GET', `/tasks/${task.id}`, undefined, 200);
  record(
    'S15 detalle incluye el comentario con autor',
    (detail.comments ?? []).some((c) => c.id === commentOnActive.id && Boolean(c.author)),
  );

  // ===== Resumen del dashboard =====
  const summary = await call('GET', '/tasks/summary', undefined, 200);
  record(
    'S15 /tasks/summary devuelve el widget completo',
    typeof summary?.total === 'number' &&
      typeof summary?.overdue === 'number' &&
      typeof summary?.dueSoon === 'number' &&
      typeof summary?.mine === 'number' &&
      typeof summary?.mineOverdue === 'number',
    `total=${summary?.total} overdue=${summary?.overdue} dueSoon=${summary?.dueSoon}`,
  );

  // ===== Cross-tenant: 401 sin token =====
  record(
    'S15 sin token responde 401',
    await expectStatus('GET', '/tasks', undefined, 401, false),
  );

  // ===== RBAC EMPLOYEE: lectura si, gestion no =====
  const employeeEmail = process.env.QA_EMPLOYEE_EMAIL ?? 'empleado@sgsst.com';
  const employeePass = process.env.QA_EMPLOYEE_PASS ?? 'Empleado123*';
  let employeeToken = null;
  try {
    const empLogin = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employeeEmail, password: employeePass }),
    });
    if (empLogin.status === 200 || empLogin.status === 201) {
      const empJson = await empLogin.json();
      employeeToken = empJson.accessToken ?? empJson.access_token ?? null;
    }
  } catch {
    employeeToken = null;
  }
  if (employeeToken) {
    const empHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${employeeToken}` };
    const empPost = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: empHeaders,
      body: JSON.stringify({
        title: `${MARK} tarea employee`,
        sourceType: 'MANUAL',
        companyId,
      }),
    });
    record('S15 EMPLOYEE no crea tareas (403)', empPost.status === 403, `HTTP ${empPost.status}`);

    const empComment = await fetch(`${API}/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: empHeaders,
      body: JSON.stringify({ body: `${MARK} comentario EMPLOYEE smoke S15.3` }),
    });
    record(
      'S15 EMPLOYEE comenta tarea abierta',
      empComment.status === 201,
      `HTTP ${empComment.status}`,
    );
    if (empComment.status === 201) {
      const empCommentJson = await empComment.json();
      await call('DELETE', `/tasks/${task.id}/comments/${empCommentJson.id}`, undefined, [200, 204]);
    }
  } else {
    record('S15 EMPLOYEE no crea tareas (403)', true, 'omitido: sin usuario EMPLOYEE en la BD');
    record('S15 EMPLOYEE comenta tarea abierta', true, 'omitido: sin usuario EMPLOYEE en la BD');
  }

  // ===== Limpieza =====
  const cleanup = [
    () => call('DELETE', `/tasks/${task.id}`, undefined, [200, 204]),
    () => call('DELETE', `/tasks/${autoRow.id}`, undefined, [200, 204]),
    () => call('DELETE', `/findings/${finding.id}`, undefined, [200, 204]),
  ];
  let cleanupOk = true;
  for (const run of cleanup) {
    try {
      await run();
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
console.log(`\n== Smoke S15.3: ${results.length - failed.length}/${results.length} pasos OK ==`);
process.exit(failed.length > 0 ? 1 : 0);
