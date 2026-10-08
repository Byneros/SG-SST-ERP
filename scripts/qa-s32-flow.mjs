#!/usr/bin/env node
/**
 * S3.2 (Issue #7) — Flujo encadenado empresa→sede→empleado→usuario con rol,
 * más verificación de que el usuario creado solo accede a su empresa.
 *
 * Usa las empresas demo [S3.1-DEMO] (A y B) sembradas en el entorno dev.
 * Uso: node scripts/qa-s32-flow.mjs [apiBase] [adminEmail] [adminPassword]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const ADMIN_EMAIL = process.argv[3] ?? 'super@sgsst.com';
const ADMIN_PASSWORD = process.argv[4] ?? 'Admin12345';
const MARK = '[S3.2]';
const DEMO_MARK = '[S3.1-DEMO]';
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
  try { data = await res.json(); } catch { data = null; }
  if (!allowed.includes(res.status)) {
    const msg = data && typeof data === 'object' && 'message' in data ? JSON.stringify(data.message).slice(0, 180) : '';
    throw new Error(`${method} ${path} -> HTTP ${res.status} (esperaba ${allowed.join('|')}) ${msg}`);
  }
  return { status: res.status, data };
}

async function main() {
  const login = await call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, null, [200, 201]);
  let root = login.data.accessToken ?? login.data.access_token;
  record('S0 login SUPER_ADMIN', Boolean(root));

  async function switchTo(companyId) {
    const r = await call('POST', '/auth/active-company', { companyId }, root, [200, 201]);
    root = r.data.accessToken ?? r.data.access_token ?? root;
  }

  // Empresas demo de S3.1 (A = la primera en el listado con el marcador).
  const list = await call('GET', '/companies', undefined, root, 200);
  const rows = Array.isArray(list.data) ? list.data : (list.data.data ?? []);
  // Mapeo por sufijo real (la empresa A tiene "A S.A.S.", la B "B S.A.S.").
  const companyA = rows.filter((c) => c.name?.includes(DEMO_MARK) && c.name.includes('A S.A.S.')).at(-1);
  const companyB = rows.filter((c) => c.name?.includes(DEMO_MARK) && c.name.includes('B S.A.S.')).at(-1);
  if (!companyA || !companyB) throw new Error('empresas demo [S3.1-DEMO] no encontradas; correr scripts/qa-s31-demo-data.mjs primero');
  record('Empresas demo encontradas', Boolean(companyA.id && companyB.id), `A=${companyA.id} B=${companyB.id}`);

  // Paso 1: sede en A (el flujo UI empieza en Empresa A ya activa para el SUPER_ADMIN).
  await switchTo(companyA.id);
  const site = await call('POST', '/sites', { name: `${MARK} Sede QA`, companyId: companyA.id }, root, [200, 201]);
  record('Crear sede en A', Boolean(site.data.id), site.data.id);

  // Paso 2: empleado asignado a la sede (el modelo usa document único global).
  const document = `CC-${TS}`.slice(0, 20);
  const employee = await call('POST', '/employees', {
    firstName: 'Nuevo', lastName: `Usuario QA ${TS}`, document, position: 'Analista SST',
    companyId: companyA.id, siteId: site.data.id,
  }, root, [200, 201]);
  record('Crear empleado en la sede', Boolean(employee.data.id), employee.data.id);

  // Paso 3: usuario con rol sobre ese empleado.
  const email = `s32-${TS}@demo.com`;
  const createdUser = await call('POST', '/users', {
    name: `Usuario QA ${TS}`, email, password: 'Admin12345', role: 'ADMIN',
    companyId: companyA.id,
  }, root, [200, 201, 400]);
  record('Crear usuario con rol ADMIN de A', createdUser.status === 201 || createdUser.status === 200, `email=${email} ${createdUser.status !== 201 && createdUser.status !== 200 ? '(sin vinculo de empleado disponible via API)' : ''}`);

  // Paso 4: el usuario nuevo inicia sesión.
  const userLogin = await call('POST', '/auth/login', { email, password: 'Admin12345' }, null, [200, 201]);
  const tokenNew = userLogin.data.accessToken ?? userLogin.data.access_token;
  record('Login del usuario nuevo', Boolean(tokenNew));

  // Paso 5: el usuario nuevo solo accede a su empresa.
  const ownEmp = await fetch(`${API}/employees/${employee.data.id}`, { headers: { Authorization: `Bearer ${tokenNew}` } });
  record('P-A1 el usuario nuevo consulta SU empleado -> 200', ownEmp.status === 200, `HTTP ${ownEmp.status}`);

  // Recursos de B para cruzar: sede y empleado existentes de la demo B.
  const sitesList = await fetch(`${API}/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenNew}` },
    body: JSON.stringify({ page: 1, pageSize: 5 }),
  }).catch(() => null);

  // Aislamiento cruzado con recurso real de B:
  await switchTo(companyB.id);
  const crossSite = await call('POST', '/sites', { name: `${MARK} Sede B ref`, companyId: companyB.id }, root, [200, 201]);
  const crossEmp = await call('POST', '/employees', {
    firstName: 'Ref', lastName: `B ${TS}`, document: `CCX${TS}`.slice(0, 20), position: 'Ref', companyId: companyB.id,
  }, root, [200, 201]);

  const p1 = await fetch(`${API}/employees/${crossEmp.data.id}`, { headers: { Authorization: `Bearer ${tokenNew}` } });
  record('P-A2 el usuario nuevo NO consulta empleado de B -> 404', p1.status === 404, `HTTP ${p1.status}`);
  const p2 = await fetch(`${API}/sites/${crossSite.data.id}`, { headers: { Authorization: `Bearer ${tokenNew}` } });
  record('P-A3 el usuario nuevo NO consulta sede de B -> 404', p2.status === 404, `HTTP ${p2.status}`);
  const p3 = await fetch(`${API}/employees?companyId=${companyB.id}`, { headers: { Authorization: `Bearer ${tokenNew}` } });
  record('P-A4 companyId manipulado no evade scope -> 403', p3.status === 403 || p3.status === 404, `HTTP ${p3.status}`);

  // Limpieza de recursos de referencia creados en B.
  await call('DELETE', `/employees/${crossEmp.data.id}`, undefined, root, [200, 204, 409]).catch(() => null);

  const count = results.filter((r) => r.ok).length;
  console.log(`\n== S3.2 flujo encadenado: ${count}/${results.length} pasos OK ==`);
  if (count !== results.length) process.exit(1);
}

main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
