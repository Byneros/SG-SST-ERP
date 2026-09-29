#!/usr/bin/env node
/**
 * QA Sprint 7 (issues #15/#16) + evidencia pendiente S8.3/S9.4/S10.2.
 *
 * Valida via HTTP real contra la API dev:
 * - Rutas protegidas: 401 sin token y con token invalido.
 * - RBAC: EMPLOYEE no puede escribir ni acceder a datos medicos (404) ni
 *   entregar EPP (403); escritura de empleados/datos sensibles bloqueada.
 * - S10.2 (#26): generate-due-alerts crea alerta de examen ocupacional
 *   vencido (nextDueAt) y queda visible en /notifications.
 * - S9.4 (#24): entrega EPP real a un empleado con descuento de stock,
 *   reposicion por vida util y expediente del trabajador.
 * - S7 (#16): lockout al superar LOGIN_LOCKOUT_MAX_ATTEMPTS (5) y bloqueo
 *   persistente aunque la contraseña sea correcta. Se ejecuta AL FINAL y el
 *   desbloqueo se hace por SQL en el paso de limpieza del operador.
 *
 * Uso: node scripts/qa-s7-security-alerts.mjs [apiBase] [email] [password]
 * Por defecto: http://localhost:3002/api/v1 admin@sgsst.com Admin12345
 */

const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD = process.argv[4] ?? 'Admin12345';
const MARK = '[S7QA]';
const TS = Date.now();

const results = [];
let token = null;

function record(step, ok, detail = '') {
  results.push({ step, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function raw(method, path, body, auth, expect) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function call(method, path, body, auth, expect = 200) {
  const allowed = Array.isArray(expect) ? expect : [expect];
  const r = await raw(method, path, body, auth, expect);
  if (!allowed.includes(r.status)) {
    const msg =
      r.data && typeof r.data === 'object' && 'message' in r.data
        ? JSON.stringify(r.data.message).slice(0, 180)
        : '';
    throw new Error(`${method} ${path} -> HTTP ${r.status} (esperaba ${allowed.join('|')}) ${msg}`);
  }
  return r;
}

async function main() {
  // ===== S0: sesion admin =====
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, null, [200, 201]);
  token = login.data.accessToken ?? login.data.access_token;
  const me = await call('GET', '/auth/me', undefined, token, 200);
  const companyId = me.companyId ?? me.user?.companyId ?? me.data?.companyId;
  record('S0 login y scope de empresa', Boolean(token && companyId), `company=${companyId}`);

  // ===== Rutas protegidas =====
  const anon = await raw('GET', '/employees', null, null);
  record('GET sin token -> 401', anon.status === 401, `HTTP ${anon.status}`);
  const garbage = await raw('GET', '/employees', null, 'token-falso');
  record('GET con token invalido -> 401', garbage.status === 401, `HTTP ${garbage.status}`);
  const anonWrite = await raw('POST', '/documents', { name: 'x' }, null);
  record('POST sin token -> 401', anonWrite.status === 401, `HTTP ${anonWrite.status}`);

  // ===== S10.2 (#26): alerta de examen ocupacional =====
  const employee = await call('POST', '/employees', {
    firstName: 'QA', lastName: `S7-${TS}`, document: `S7-${TS}`,
    position: 'Operario QA', companyId,
  }, token, [200, 201]);

  const past = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const exam = await call('POST', '/medical/exams', {
    examType: 'PERIODICO',
    concept: 'APTO',
    scheduledAt: past(400),
    performedAt: past(395),
    provider: 'QA-IPS',
    nextDueAt: past(35),
    employeeId: employee.data.id,
    companyId,
  }, token, [200, 201]);
  record('S10.2 examen con nextDueAt vencida creado', Boolean(exam.data?.id));

  const gen = await call('POST', '/notifications/generate-due-alerts', {}, token, [200, 201]);
  const scanned = gen.data?.scanned ?? {};
  record(
    'S10.2 generate-due-alerts escanea examenes y crea alerta',
    gen.data?.created >= 1 && scanned.medicalExams >= 1,
    `created=${gen.data?.created}, scanned=${JSON.stringify(scanned)}`,
  );

  const notifs = await call('GET', '/notifications', undefined, token, 200);
  const rows = Array.isArray(notifs.data) ? notifs.data : (notifs.data.data ?? []);
  const examAlert = rows.find(
    (n) => n.entity === 'MedicalExam' && n.entityId === exam.data.id,
  );
  record(
    'S10.2 alerta visible en /notifications para ADMIN/SST',
    Boolean(examAlert),
    examAlert ? `titulo="${examAlert.title}"` : 'no encontrada',
  );

  // ===== S9.4 (#24): entrega EPP real =====
  const ppeItem = await call('POST', '/ppe/items', {
    name: `${MARK} guante QA`, type: 'Guante', standard: 'NA-9999', size: 'M',
    usefulLifeDays: 90, stockMin: 1, stock: 5, companyId,
  }, token, [200, 201]);

  const delivery = await call('POST', '/ppe/deliveries', {
    itemId: ppeItem.data.id,
    employeeId: employee.data.id,
    quantity: 2,
    deliveredAt: new Date().toISOString(),
    signature: 'QA',
    companyId,
  }, token, [200, 201]);
  const dueRepl = delivery.data?.dueReplacementAt
    ? new Date(delivery.data.dueReplacementAt)
    : null;
  const days90 = dueRepl
    ? Math.round((dueRepl.getTime() - Date.now()) / 86400000)
    : -1;
  record(
    'S9.4 entrega creada con reposicion a ~90 dias',
    Boolean(delivery.data?.id) && days90 >= 88 && days90 <= 92,
    `dueReplacementAt=+${days90}d`,
  );

  const expediente = await call('GET', `/ppe/employee/${employee.data.id}`, undefined, token, 200);
  const expRows = Array.isArray(expediente.data)
    ? expediente.data
    : (expediente.data?.deliveries ?? expediente.data?.data ?? []);
  const inHistory = expRows.some(
    (d) => d.itemId === ppeItem.data.id || d.item?.id === ppeItem.data.id,
  );
  record('S9.4 expediente del trabajador muestra la entrega', inHistory, `${expRows.length} filas`);

  const itemAfter = await call('GET', '/ppe/items', undefined, token, 200);
  const itemRows = Array.isArray(itemAfter.data) ? itemAfter.data : (itemAfter.data.data ?? []);
  const stockNow = itemRows.find((i) => i.id === ppeItem.data.id)?.stock;
  record('S9.4 stock descontado (5 -> 3)', stockNow === 3, `stock=${stockNow}`);

  // ===== RBAC con usuario EMPLOYEE =====
  const empEmail = `s7qa-emp-${TS}@demo.com`;
  const empUser = await call('POST', '/users', {
    name: `${MARK} EMPLOYEE`, email: empEmail, password: 'Admin12345',
    role: 'EMPLOYEE', companyId,
  }, token, [200, 201]);

  const empLogin = await call('POST', '/auth/login', {
    email: empEmail, password: 'Admin12345',
  }, null, [200, 201]);
  const empToken = empLogin.data.accessToken ?? empLogin.data.access_token;
  record('Login EMPLOYEE', Boolean(empToken));

  const empWrite = await raw('PATCH', `/employees/${employee.data.id}`, { position: 'hack' }, empToken);
  record('RBAC EMPLOYEE PATCH /employees -> 403', empWrite.status === 403, `HTTP ${empWrite.status}`);

  const empDelete = await raw('DELETE', `/employees/${employee.data.id}`, null, empToken);
  record('RBAC EMPLOYEE DELETE /employees -> 403', empDelete.status === 403, `HTTP ${empDelete.status}`);

  const empMedical = await raw('GET', '/medical/exams', null, empToken);
  // El guard responde 403 (@Roles); el servicio devuelve 404 en llamadas
  // directas. Ambos excluyen a EMPLOYEE del modulo de datos sensibles.
  const empMedicalOk = empMedical.status === 403 || empMedical.status === 404;
  record('RBAC EMPLOYEE GET /medical/exams -> 403/404', empMedicalOk, `HTTP ${empMedical.status}`);

  const empPpe = await raw('POST', '/ppe/deliveries', {
    itemId: ppeItem.data.id, employeeId: employee.data.id, quantity: 1, companyId,
  }, empToken);
  record('RBAC EMPLOYEE POST /ppe/deliveries -> 403', empPpe.status === 403, `HTTP ${empPpe.status}`);

  const empUsers = await raw('GET', '/users', null, empToken);
  const empUsersOk = empUsers.status === 403 || empUsers.status === 404;
  record('RBAC EMPLOYEE GET /users -> 403/404', empUsersOk, `HTTP ${empUsers.status}`);

  // Limpieza parcial via API (usuario EMPLOYEE de prueba).
  await call('DELETE', `/users/${empUser.data.id}`, undefined, token, [200, 204, 403]).catch(() => null);

  // ===== S7 lockout (AL FINAL; el reset es por SQL en limpieza) =====
  let lockMessage = '';
  for (let i = 1; i <= 5; i += 1) {
    const attempt = await raw('POST', '/auth/login', { email: EMAIL, password: 'incorrecta' }, null);
    lockMessage = String(attempt.data?.message ?? '');
  }
  record(
    'Lockout: 5.º intento fallido activa bloqueo',
    lockMessage.toLowerCase().includes('locked'),
    `msg="${lockMessage.slice(0, 90)}"`,
  );

  const lockedButCorrect = await raw('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, null);
  record(
    'Lockout: contraseña correcta sigue bloqueada',
    lockedButCorrect.status === 401 &&
      String(lockedButCorrect.data?.message ?? '').toLowerCase().includes('invalid credentials'),
    `HTTP ${lockedButCorrect.status}`,
  );
}

try {
  await main();
} catch (error) {
  record('flujo abortado', false, String(error.message ?? error).slice(0, 300));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n== QA S7 + evidencia S10: ${results.length - failed.length}/${results.length} pasos OK ==`);
process.exit(failed.length > 0 ? 1 : 0);
