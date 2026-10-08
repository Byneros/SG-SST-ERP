#!/usr/bin/env node
/**
 * Runbook S3.1 (Issue #6) — datos demo persistentes.
 * Crea Empresa A S.A.S. y Empresa B S.A.S. ([S3.1-DEMO]) con sedes,
 * empleados, 1 riesgo y 1 capacitacion cada una, mas ADMIN por empresa.
 * No limpia: se conservan como datos semilla del entorno dev (runbook, paso 3).
 * Uso: node scripts/qa-s31-demo-data.mjs [apiBase] [adminEmail] [adminPassword]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const ADMIN_EMAIL = process.argv[3] ?? 'super@sgsst.com';
const ADMIN_PASSWORD = process.argv[4] ?? 'Admin12345';
const MARK = '[S3.1-DEMO]';
const TS = Date.now();

let failures = 0;
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
    failures++;
    const msg = data && typeof data === 'object' && 'message' in data ? JSON.stringify(data.message).slice(0, 180) : '';
    throw new Error(`${method} ${path} -> HTTP ${res.status} (esperaba ${allowed.join('|')}) ${msg}`);
  }
  return { status: res.status, data };
}

async function main() {
  const login = await call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, null, [200, 201]);
  let root = login.data.accessToken ?? login.data.access_token;
  console.log('PASS  login SUPER_ADMIN');

  // Reutilizar empresas demo si ya existen.
  const list = await call('GET', '/companies', undefined, root, 200);
  const rows = Array.isArray(list.data) ? list.data : (list.data.data ?? []);
  const existing = rows.filter((c) => c.name?.includes(MARK));
  if (existing.length >= 2) {
    console.log('PASS  empresas demo ya existen, se siembran datos sobre ellas:', existing.map((c) => `${c.name} (${c.id})`).join(' | '));
  }

  // Mapeo por SUFIJO del nombre (no por posición del listado): la corrida
  // original puede haber creado A/B en cualquier orden.
  const bySuffix = (suffix) =>
    existing.find((c) => c.name?.includes(`Empresa ${suffix} S.A.S.`));
  const idA = bySuffix('A')?.id ?? (await call('POST', '/companies', { name: `${MARK} Empresa A S.A.S.`, nit: `900000001-${(TS % 9) + 1}` }, root, [200, 201])).data.id;
  const idB = bySuffix('B')?.id ?? (await call('POST', '/companies', { name: `${MARK} Empresa B S.A.S.`, nit: `900000002-${(TS % 9) + 1}` }, root, [200, 201])).data.id;
  console.log(`PASS  empresas A=${idA} B=${idB}`);

  async function switchTo(companyId) {
    const r = await call('POST', '/auth/active-company', { companyId }, root, [200, 201]);
    root = r.data.accessToken ?? r.data.access_token ?? root;
  }

  async function seedCompany(id, tag, suffix) {
    await switchTo(id);
    const site = await call('POST', '/sites', { name: `${MARK} Sede ${tag}`, companyId: id }, root, [200, 201]);
    const emps = [];
    for (let i = 1; i <= 2; i++) {
      emps.push((await call('POST', '/employees', {
        firstName: 'Demo', lastName: `Trabajador ${i}${suffix}`,
        document: `CC-${i}${suffix}-${String(TS).slice(-6)}`,
        position: 'Operario', companyId: id,
      }, root, [200, 201])).data.id);
    }
    const risk = (await call('POST', '/risks', {
      name: `Riesgo demo ${tag}`, description: 'Riesgo de relleno S3.1', companyId: id,
      hazard: 'Ruido', level: 'MEDIO',
    }, root, [200, 201, 400])).data;
    const training = (await call('POST', '/trainings', {
      title: `${MARK} Capacitacion ${tag}`, date: new Date().toISOString(), companyId: id,
    }, root, [200, 201])).data;
    console.log(`PASS  datos ${tag}: sede=${site.data.id} empleados=${emps.join(',')} riesgo=${risk?.id ?? 'n/a'} capacitacion=${training.id}`);
    return { site: site.data.id, emps, training: training.id };
  }

  const a = await seedCompany(idA, 'A', 'A');
  await seedCompany(idB, 'B', 'B');

  // Segunda sede en A para el flujo S3.2.
  await switchTo(idA);
  await call('POST', '/sites', { name: `${MARK} Sede A2`, companyId: idA }, root, [200, 201]);

  // Admins por empresa con credenciales del runbook.
  await switchTo(idA);
  await call('POST', '/users', { name: `${MARK} Admin A`, email: 'admin-a@demo.com', password: 'Admin12345', role: 'ADMIN', companyId: idA }, root, [200, 201, 409]);
  await switchTo(idB);
  await call('POST', '/users', { name: `${MARK} Admin B`, email: 'admin-b@demo.com', password: 'Admin12345', role: 'ADMIN', companyId: idB }, root, [200, 201, 409]);
  console.log('PASS  admins admin-a@demo.com y admin-b@demo.com (Admin12345)');

  // Referencias para las pruebas P1-P4 manuales.
  console.log('--- IDs para runbook P1-P4 ---');
  console.log(JSON.stringify({ idA, idB, ...a }, null, 1));
  if (failures) process.exit(1);
}

main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
