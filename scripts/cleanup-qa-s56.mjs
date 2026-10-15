#!/usr/bin/env node
/**
 * Limpieza one-shot de los residuos [QA-S56] de la sesion QA S5-S6 en las
 * empresas demo (acciones, hallazgos, indicadores, capacitaciones, incidentes,
 * riesgos, empleados; sedes quedan con baja logica).
 * Uso: node scripts/cleanup-qa-s56.mjs [apiBase] [adminEmail] [adminPassword]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const ADMIN_EMAIL = process.argv[3] ?? 'super@sgsst.com';
const ADMIN_PASSWORD = process.argv[4] ?? 'Admin12345';
const MARKS = ['[QA-S56]'];

const results = { removed: 0, errors: 0 };

async function fetchJson(path, options) {
  const res = await fetch(`${API}${path}`, options);
  try { return { status: res.status, data: await res.json() }; }
  catch { return { status: res.status, data: null }; }
}

async function login(email, password) {
  const r = await fetchJson('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const token = r.data?.accessToken ?? r.data?.access_token;
  if (!token) throw new Error(`login fallo (HTTP ${r.status})`);
  return token;
}

let token;
async function switchTo(companyId) {
  const r = await fetchJson('/auth/active-company', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ companyId }),
  });
  token = r.data?.accessToken ?? r.data?.access_token ?? token;
}

function rows(res) {
  // res es la respuesta de fetchJson ({status, data}) o el body directo;
  // algunos listados devuelven envelope {data: [...], meta} y otros array.
  const body = Array.isArray(res) ? res : res?.data;
  if (Array.isArray(body)) return body;
  return Array.isArray(body?.data) ? body.data : [];
}

async function purge(companyId) {
  await switchTo(companyId);
  // Orden de borrado: acciones (referencian hallazgos) -> hallazgos ->
  // indicadores -> capacitaciones -> incidentes -> riesgos -> empleados.
  for (const resource of ['actions', 'findings', 'indicators', 'trainings', 'incidents', 'risks', 'employees']) {
    const list = await fetchJson(`/${resource}?pageSize=100`, { headers: { Authorization: `Bearer ${token}` } });
    if (process.env.CLEANUP_DEBUG) console.log(`DEBUG ${resource} HTTP ${list.status} rows=${rows(list).length}`);
    for (const row of rows(list)) {
      const label = `${row.title ?? row.name ?? row.document ?? row.lastName ?? ''}`;
      const hit = MARKS.some((m) => label.includes(m)) || (resource === 'employees' && /QA56/.test(`${row.document ?? ''}${row.lastName ?? ''}`));
      if (hit) {
        const del = await fetchJson(`/${resource}/${row.id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        const ok = del.status < 300;
        if (!ok) results.errors++;
        else results.removed++;
        console.log(`${ok ? 'OK  ' : 'ERR '} ${resource} ${label || row.id}`);
      }
    }
  }
  const sites = await fetchJson(`/sites?pageSize=100`, { headers: { Authorization: `Bearer ${token}` } });
  for (const site of rows(sites)) {
    if (MARKS.some((m) => `${site.name ?? ''}`.includes(m)) && (site.deletedAt == null)) {
      console.log(`SKIP sites (soft delete ya aplicado por DELETE) ${site.name}`);
    }
  }
}

async function main() {
  token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const me = (await fetchJson('/auth/me', { headers: { Authorization: `Bearer ${token}` } })).data;
  const list = await fetchJson('/companies', { headers: { Authorization: `Bearer ${token}` } });
  let targets = [];
  if (list.status === 200) {
    targets = rows(list).filter((c) => c.name?.includes('[S3.1-DEMO]') || c.name?.includes('[QA-S56]')).slice(0, 2);
  }
  if (targets.length === 0) {
    const ownId = me.companyId ?? me.user?.companyId;
    if (!ownId) throw new Error('no hay empresas demo ni empresa propia');
    targets = [{ id: ownId, name: 'empresa propia del admin' }];
  }
  for (const c of targets) {
    console.log(`--- empresa ${c.name ?? c.id} (${c.id})`);
    await purge(c.id);
  }
  console.log(`eliminados: ${results.removed}, errores: ${results.errors}`);
  process.exit(results.errors > 0 ? 1 : 0);
}

main().catch((err) => { console.error('ABORT', err.message); process.exit(1); });
