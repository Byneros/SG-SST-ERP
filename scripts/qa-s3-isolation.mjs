#!/usr/bin/env node
/**
 * S3.1 (Issue #6) — Prueba de aislamiento multiempresa via HTTP real.
 *
 * Sigue docs/runbook-s3-1-prueba-multiempresa.md:
 * - Crea dos empresas [S3ISO] con sedes, empleados, capacitaciones y admins.
 * - P1: usuario A no consulta empleados de B -> 404.
 * - P2: usuario A no consulta/modifica sedes de B -> 404.
 * - P3: usuario A no modifica registros de B -> 404 (y el dato no cambia).
 * - P4: companyId manipulado no evade el scope -> 403/404.
 * - Extra: el listado de A solo contiene recursos de A.
 *
 * Limpieza: elimina los recursos [S3ISO] que creo.
 * Uso: node scripts/qa-s3-isolation.mjs [apiBase] [adminEmail] [adminPassword]
 * Por defecto: http://localhost:3002/api/v1 admin@sgsst.com Admin12345
 */

const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const ADMIN_EMAIL = process.argv[3] ?? 's3iso-super@demo.com';
const ADMIN_PASSWORD = process.argv[4] ?? 'Admin12345';
const MARK = '[S3ISO]';
const TS = Date.now();

const results = [];

function record(step, ok, detail = '') {
  results.push({ step, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, body, token, expect = 200) {
  const allowed = Array.isArray(expect) ? expect : [expect];
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!allowed.includes(res.status)) {
    const msg =
      data && typeof data === 'object' && 'message' in data
        ? JSON.stringify(data.message).slice(0, 180)
        : '';
    throw new Error(`${method} ${path} -> HTTP ${res.status} (esperaba ${allowed.join('|')}) ${msg}`);
  }
  return { status: res.status, data };
}

async function main() {
  // ===== 0. Sesiones =====
  const rootLogin = await call('POST', '/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  }, null, [200, 201]);
  let root = rootLogin.data.accessToken ?? rootLogin.data.access_token;
  record('S0 login SUPER_ADMIN', Boolean(root));

  /** SUPER_ADMIN opera cada tenant con su empresa activa (POST /auth/active-company). */
  async function switchTo(companyId) {
    const r = await call('POST', '/auth/active-company', { companyId }, root, [200, 201]);
    root = r.data.accessToken ?? r.data.access_token ?? root;
  }

  // Limpieza de restos de corridas abortadas anteriores.
  try {
    const leftovers = await call('GET', '/companies', undefined, root, 200);
    const rows = Array.isArray(leftovers.data) ? leftovers.data : (leftovers.data.data ?? []);
    for (const c of rows.filter((c) => c.name?.includes(MARK))) {
      await call('DELETE', `/companies/${c.id}`, undefined, root, [200, 204, 409]).catch(() => null);
    }
  } catch {
    // best effort
  }

  // ===== 1. Empresas A y B =====
  const nitA = `90${String(TS).slice(-7)}-${(TS % 9) + 1}`;
  const nitB = `91${String(TS).slice(-7)}-${(TS % 9) + 1}`;
  const companyA = await call('POST', '/companies', { name: `${MARK} Empresa A`, nit: nitA }, root, [200, 201]);
  const companyB = await call('POST', '/companies', { name: `${MARK} Empresa B`, nit: nitB }, root, [200, 201]);
  const idA = companyA.data.id;
  const idB = companyB.data.id;
  record('Dos empresas creadas', Boolean(idA && idB), `A=${idA} B=${idB}`);

  // ===== 2. Sedes, empleados y capacitaciones por empresa =====
  await switchTo(idA);
  const siteA = await call('POST', '/sites', { name: `${MARK} Sede A`, companyId: idA }, root, [200, 201]);
  const empA = await call('POST', '/employees', {
    firstName: 'Usuario', lastName: `ISO-A-${TS}`, document: `S3A-${TS}`,
    position: 'Operario A', companyId: idA,
  }, root, [200, 201]);
  const trainingA = await call('POST', '/trainings', {
    title: `${MARK} capacitacion A`, date: new Date().toISOString(), companyId: idA,
  }, root, [200, 201]);

  await switchTo(idB);
  const siteB = await call('POST', '/sites', { name: `${MARK} Sede B`, companyId: idB }, root, [200, 201]);
  const empB = await call('POST', '/employees', {
    firstName: 'Usuario', lastName: `ISO-B-${TS}`, document: `S3B-${TS}`,
    position: 'Operario B', companyId: idB,
  }, root, [200, 201]);
  const trainingB = await call('POST', '/trainings', {
    title: `${MARK} capacitacion B`, date: new Date().toISOString(), companyId: idB,
  }, root, [200, 201]);
  record('Recursos de prueba por empresa', Boolean(empA.data.id && empB.data.id && trainingA.data.id && trainingB.data.id));

  // ===== 3. Admins por empresa y login como A =====
  await switchTo(idA);
  const adminAEmail = `s3iso-a-${TS}@demo.com`;
  const adminBEmail = `s3iso-b-${TS}@demo.com`;
  await call('POST', '/users', {
    name: `${MARK} Admin A`, email: adminAEmail, password: 'Admin12345',
    role: 'ADMIN', companyId: idA,
  }, root, [200, 201]);
  await switchTo(idB);
  await call('POST', '/users', {
    name: `${MARK} Admin B`, email: adminBEmail, password: 'Admin12345',
    role: 'ADMIN', companyId: idB,
  }, root, [200, 201]);
  const loginA = await call('POST', '/auth/login', {
    email: adminAEmail, password: 'Admin12345',
  }, null, [200, 201]);
  const tokenA = loginA.data.accessToken ?? loginA.data.access_token;
  record('Login como admin de A', Boolean(tokenA));

  // ===== P1: A no consulta empleados de B -> 404 =====
  const p1a = await fetch(`${API}/employees/${empB.data.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  record('P1 GET /employees/{id-de-B} -> 404', p1a.status === 404, `HTTP ${p1a.status}`);

  const p1b = await fetch(`${API}/employees?companyId=${idB}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const p1bOk = p1b.status === 403 || p1b.status === 404;
  record('P1 GET /employees?companyId={B} -> 403/404', p1bOk, `HTTP ${p1b.status}`);

  // ===== P2: A no consulta/modifica sedes de B -> 404 =====
  const p2a = await fetch(`${API}/sites/${siteB.data.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  record('P2 GET /sites/{sede-de-B} -> 404', p2a.status === 404, `HTTP ${p2a.status}`);

  const p2b = await fetch(`${API}/sites/${siteB.data.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ name: 'intruso' }),
  });
  record('P2 PATCH /sites/{sede-de-B} -> 404', p2b.status === 404, `HTTP ${p2b.status}`);

  // ===== P3: A no modifica registros de B -> 404 y el dato no cambia =====
  const p3a = await fetch(`${API}/employees/${empB.data.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ position: 'hacked' }),
  });
  record('P3 PATCH /employees/{id-de-B} -> 404', p3a.status === 404, `HTTP ${p3a.status}`);

  const empBAfter = await call('GET', `/employees/${empB.data.id}`, undefined, root, 200);
  record(
    'P3 el empleado de B no cambio',
    empBAfter.data.position === 'Operario B',
    `position=${empBAfter.data.position}`,
  );

  const p3b = await fetch(`${API}/trainings/${trainingB.data.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  record('P3 DELETE /trainings/{cap-B} -> 404', p3b.status === 404, `HTTP ${p3b.status}`);

  const trainingBAfter = await call('GET', `/trainings/${trainingB.data.id}`, undefined, root, [200, 404]);
  record(
    'P3 la capacitacion de B sigue presente',
    trainingBAfter.status === 200,
    `GET -> HTTP ${trainingBAfter.status}`,
  );

  // ===== P4: companyId manipulado no evade el scope -> 403/404 =====
  const p4a = await fetch(`${API}/risks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: `${MARK} riesgo intruso`, level: 'HIGH', companyId: idB }),
  });
  const p4aOk = p4a.status === 403 || p4a.status === 404;
  record('P4 POST /risks con companyId de B -> 403/404', p4aOk, `HTTP ${p4a.status}`);

  const p4b = await fetch(`${API}/incidents?companyId=${idB}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const p4bOk = p4b.status === 403 || p4b.status === 404;
  record('P4 GET /incidents?companyId={B} -> 403/404', p4bOk, `HTTP ${p4b.status}`);

  // ===== Extra: A solo ve sus propios recursos =====
  const listA = await call('GET', '/employees', undefined, tokenA, 200);
  const rowsA = Array.isArray(listA.data) ? listA.data : (listA.data.data ?? []);
  const foreignRows = rowsA.filter((e) => e.companyId !== idA);
  record('Listado de A contiene solo empleados de A', foreignRows.length === 0, `${rowsA.length} filas, ${foreignRows.length} ajenas`);

  // ===== Limpieza (por empresa activa) =====
  const rootDelete = (path, expect = [200, 204, 404, 405, 409]) =>
    call('DELETE', path, undefined, root, expect).catch(() => null);

  await switchTo(idA).catch(() => null);
  await rootDelete(`/employees/${empA.data.id}`, [200, 204]);
  await rootDelete(`/trainings/${trainingA.data.id}`, [200, 204]);
  await rootDelete(`/sites/${siteA.data.id}`, [200, 204]);
  const usersList = await call('GET', `/users?companyId=${idA}`, undefined, root, [200, 404]).catch(() => null);
  const adminAId = usersList?.data && (Array.isArray(usersList.data) ? usersList.data : usersList.data.data ?? [])
    .find((u) => u.email === adminAEmail)?.id;
  if (adminAId) await rootDelete(`/users/${adminAId}`, [200, 204]);
  await rootDelete(`/companies/${idA}`, [200, 204, 403]);

  await switchTo(idB).catch(() => null);
  await rootDelete(`/employees/${empB.data.id}`, [200, 204]);
  await rootDelete(`/trainings/${trainingB.data.id}`, [200, 204]);
  await rootDelete(`/sites/${siteB.data.id}`, [200, 204]);
  await rootDelete(`/companies/${idB}`, [200, 204, 403]);
  record('Limpieza de recursos [S3ISO]', true);
}

try {
  await main();
} catch (error) {
  record('flujo abortado', false, String(error.message ?? error).slice(0, 300));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n== S3.1 aislamiento multiempresa: ${results.length - failed.length}/${results.length} pasos OK ==`);
process.exit(failed.length > 0 ? 1 : 0);
