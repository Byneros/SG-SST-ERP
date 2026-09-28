#!/usr/bin/env node
/**
 * Limpieza de recursos [SMOKE] dejados por corridas abortadas del smoke test
 * S8-S10. Busca por marca "[SMOKE]" en los listados y borra via API. Tambien
 * elimina el riesgo GTC-45 conocido generado por una corrida anterior.
 *
 * Uso: node scripts/smoke-s8-10-cleanup.mjs [apiBase] [email] [password]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD = process.argv[4] ?? 'Admin12345';
const MARK = '[SMOKE]';
const KNOWN_RISK_ID = process.env.SMOKE_RISK_ID ?? '8e3fbd52-426c-4a11-b56d-561b7d4fca40';

let token = null;

async function call(method, path, body, expect = [200, 201, 204]) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!expect.includes(response.status)) {
    console.log(`  ! ${method} ${path} -> ${response.status}`);
    return null;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function pickList(payload) {
  return Array.isArray(payload) ? payload : (payload?.data ?? []);
}

async function main() {
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, [200, 201]);
  token = login.accessToken ?? login.access_token;
  if (!token) { console.log('login fallo'); process.exit(1); }

  let deleted = 0;

  const riskById = await call('DELETE', `/risks/${KNOWN_RISK_ID}`, undefined, [200, 204, 404]);
  if (riskById !== null || true) {
    // call() ya devolvio null para 404 tolerado; contamos intento como ok si no fue error duro.
  }

  const collections = [
    ['planned-inspections', (x) => `/planned-inspections/${x.id}`],
    ['unplanned-inspections', (x) => `/unplanned-inspections/${x.id}`],
    ['unsafe-reports', (x) => `/unsafe-reports/${x.id}`],
    ['risks', (x) => `/risks/${x.id}`],
    ['ppe/items', (x) => `/ppe/items/${x.id}`],
    ['employees', (x) => `/employees/${x.id}`],
    ['medical/restrictions', (x) => `/medical/restrictions/${x.id}`],
    ['medical/exams', (x) => `/medical/exams/${x.id}`],
    ['annual-work-plans', (x) => `/annual-work-plans/${x.id}`],
  ];
  for (const [path, urlOf] of collections) {
    const page = await call('GET', `/${path}?page=1&pageSize=100`, undefined, [200]);
    const items = pickList(page).filter(
      (x) => (x.title ?? x.name ?? x.description ?? '').includes(MARK) || (path === 'employees' && `${x.firstName ?? ''} ${x.lastName ?? ''}`.includes('Smoke')),
    );
    for (const item of items) {
      const status = await fetch(`${API}${urlOf(item)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`  delete ${path}/${item.id} -> ${status.status}`);
      if ([200, 204].includes(status.status)) deleted += 1;
    }
  }
  // Actividades marcadas dentro de planes existentes.
  const plans = pickList(await call('GET', '/annual-work-plans?page=1&pageSize=100', undefined, [200]));
  for (const plan of plans) {
    const acts = pickList(
      await call('GET', `/annual-work-plans/${plan.id}/activities?page=1&pageSize=100`, undefined, [200]),
    ).filter((a) => (a.name ?? '').includes(MARK));
    for (const a of acts) {
      const status = await fetch(`${API}/annual-work-plans/${plan.id}/activities/${a.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`  delete activity/${a.id} -> ${status.status}`);
      if ([200, 204].includes(status.status)) deleted += 1;
    }
  }
  console.log(`\nLimpieza [SMOKE]: ${deleted} recursos eliminados`);
}

await main();
