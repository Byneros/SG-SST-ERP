#!/usr/bin/env node
/**
 * Smoke #57: matriz de riesgos GTC-45 estructurada (proceso -> actividad ->
 * peligro -> valoracion -> controles -> riesgo) + reporte risks-matrix CSV/PDF.
 * Los registros creados se eliminan al final (limpieza por prefijo [SMOKE-S57]).
 * Uso: node scripts/smoke-s57-risk-matrix.mjs [apiBase] [email] [password]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD = process.argv[4] ?? '';

const results = [];
let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`;
  results.push(line);
  console.log(line);
}

const PREFIX = '[SMOKE-S57]';
async function call(method, path, body, token, raw = false) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? '' };
  let data = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) { try { data = await res.json(); } catch { data = null; } }
  return { status: res.status, data, contentType: ct };
}

async function main() {
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  if (login.status !== 200 && login.status !== 201) {
    console.log(`FAIL login (status ${login.status})`); process.exit(1);
  }
  const token = login.data.accessToken;
  const me = (await call('GET', '/auth/me', undefined, token)).data;
  const companyId = me.companyId ?? me.user?.companyId;
  console.log('login ok; empresa:', companyId);

  // 1. Arbol inicial + limpieza de restos de corridas anteriores
  const tree0 = await call('GET', '/risk-matrix', undefined, token);
  check('GET /risk-matrix (arbol)', tree0.status === 200, `status ${tree0.status}`);
  const old = (tree0.data ?? []).filter((p) => p.name?.startsWith(PREFIX));
  for (const p of old) { const d = await call('DELETE', `/risk-matrix/processes/${p.id}`, undefined, token); if (d.status !== 200) console.log('  (aviso) no se pudo limpiar', p.id, d.status); }

  // 2. Crear proceso -> actividad -> peligro
  const proc = await call('POST', '/risk-matrix/processes', { companyId, name: `${PREFIX} Proceso de bodega`, description: 'Smoke #57' }, token);
  check('POST processes crea proceso', proc.status === 201 && !!proc.data?.id, `status ${proc.status}`);
  const processId = proc.data?.id;
  const act = await call('POST', `/risk-matrix/processes/${processId}/activities`, { name: `${PREFIX} Almacenamiento` }, token);
  check('POST activities crea actividad', act.status === 201 && !!act.data?.id, `status ${act.status}`);
  const activityId = act.data?.id;
  const haz = await call('POST', `/risk-matrix/activities/${activityId}/hazards`, { name: `${PREFIX} Caída de objetos`, hazardType: 'FISICO' }, token);
  check('POST hazards crea peligro FISICO', haz.status === 201 && !!haz.data?.id, `status ${haz.status}`);
  const hazardId = haz.data?.id;

  // 3. Valoracion 1:1 (4x5 = 20 -> nivel IV/critico) + riesgo vinculado
  const val = await call('PUT', `/risk-matrix/hazards/${hazardId}/valoracion`, { probability: 4, severity: 5 }, token);
  check('PUT valoracion deriva nivel IV', val.status === 200 && val.data?.riskLevel === 'IV', `status ${val.status} nivel ${val.data?.riskLevel}`);
  const val2 = await call('PUT', `/risk-matrix/hazards/${hazardId}/valoracion`, { probability: 2, severity: 2 }, token);
  check('PUT valoracion re-upsert deriva nivel I', val2.status === 200 && val2.data?.riskLevel === 'I', `nivel ${val2.data?.riskLevel}`);

  const sites = (await call('GET', '/sites', undefined, token)).data;
  const siteList = Array.isArray(sites) ? sites : sites?.data ?? [];
  const risk = await call('POST', `/risk-matrix/hazards/${hazardId}/risk`, siteList.length ? { siteId: siteList[0].id } : {}, token);
  check('POST risk vinculado sigue valoracion (LOW/I)', risk.status === 201 && risk.data?.level === 'LOW', `status ${risk.status} nivel ${risk.data?.level}`);

  // 4. Controles (numeral 5 GTC-45)
  const ctl = await call('POST', `/risk-matrix/hazards/${hazardId}/controls`, { source: 'EPP', type: 'Casco', effectiveness: 'Alta' }, token);
  check('POST controls crea control EPP', ctl.status === 201 && ctl.data?.source === 'EPP', `status ${ctl.status}`);
  const ctlU = await call('PATCH', `/risk-matrix/controls/${ctl.data?.id}`, { effectiveness: 'Media' }, token);
  check('PATCH controls actualiza efectividad', ctlU.status === 200 && ctlU.data?.effectiveness === 'Media', `status ${ctlU.status}`);

  // 5. Arbol final refleja la cadena completa
  const tree = await call('GET', '/risk-matrix', undefined, token);
  const procRow = (tree.data ?? []).find((p) => p.id === processId);
  const hazRow = procRow?.activities?.find((a) => a.id === activityId)?.hazards?.find((h) => h.id === hazardId);
  const okTree = !!hazRow && hazRow.valorations?.length === 1 && hazRow.valorations[0].riskLevel === 'I' &&
    hazRow.controls?.some((c) => c.id === ctl.data?.id) && hazRow.risk?.id === risk.data?.id;
  check('GET /risk-matrix refleja cadena completa', okTree, hazRow ? 'arbol ok' : 'peligro no visible en arbol');

  // 6. Riesgo duplicado rechazado (400)
  const dup = await call('POST', `/risk-matrix/hazards/${hazardId}/risk`, {}, token);
  check('POST risk duplicado rechazado (400/409)', dup.status === 400 || dup.status === 409, `status ${dup.status}`);

  // 7. Aislamiento multi-empresa: otra empresa no ve el proceso
  const loginB = await call('POST', '/auth/login', { email: 'admin-b@demo.com', password: 'Admin12345' });
  if (loginB.status === 200 || loginB.status === 201) {
    const tokB = loginB.data.accessToken;
    const treeB = await call('GET', '/risk-matrix', undefined, tokB);
    const leak = (treeB.data ?? []).some((p) => p.id === processId);
    check('Aislamiento: empresa B no ve el proceso de A', !leak, `empresas en arbol B: ${(treeB.data ?? []).length}`);
    const patchB = await call('PATCH', `/risk-matrix/processes/${processId}`, { name: 'hack' }, tokB);
    check('Aislamiento: empresa B no puede editar proceso de A (404)', patchB.status === 404, `status ${patchB.status}`);
  } else {
    console.log('  (aviso) empresa demo admin-b no disponible:', loginB.status);
  }

  // 8. Reporte sincronico risks-matrix CSV y PDF
  const csv = await call('GET', '/reports/risks-matrix.csv', undefined, token, true);
  check('CSV risks-matrix entrega archivo', csv.status === 200 && csv.buf.length > 20, `${csv.buf.length}B ${csv.contentType.slice(0, 30)}`);
  const pdf = await call('GET', '/reports/risks-matrix.pdf', undefined, token, true);
  check('PDF risks-matrix entrega PDF valido', pdf.status === 200 && pdf.buf.slice(0, 4).toString() === '%PDF', `${pdf.buf.length}B`);

  // 9. Limpieza (hazard -> actividad -> proceso; el riesgo se borra con la cascada)
  const dh = await call('DELETE', `/risk-matrix/hazards/${hazardId}`, undefined, token);
  const da = await call('DELETE', `/risk-matrix/activities/${activityId}`, undefined, token);
  const dp = await call('DELETE', `/risk-matrix/processes/${processId}`, undefined, token);
  const treeAfter = await call('GET', '/risk-matrix', undefined, token);
  const gone = !(treeAfter.data ?? []).some((p) => p.id === processId);
  check('Limpieza: proceso eliminado del arbol', gone && dh.status === 200 && da.status === 200 && dp.status === 200, `d=${dh.status}/${da.status}/${dp.status}`);

  console.log(`\n${failures === 0 ? 'TODO PASS' : failures + ' FAIL'} (${results.length} checks)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1); });
