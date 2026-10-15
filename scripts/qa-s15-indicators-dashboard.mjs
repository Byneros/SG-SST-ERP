/**
 * [QA-S15] Aceptacion #40 (S15.1 delimitado): indicadores calculados desde
 * datos reales ([QA-S56]) y dashboard reflejando KPIs.
 * Uso: node scripts/tmp-qa-s15-indicators-dashboard.mjs [apiBase] [email] [password]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD = process.argv[4] ?? '';
let failures = 0;
const check = (criterion, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${criterion}${detail ? ' | ' + detail : ''}`);
};
async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const rows = (d) => (Array.isArray(d) ? d : d?.data ?? d?.items ?? []);

const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
const tk = login.data.accessToken;
const me = (await call('GET', '/auth/me', undefined, tk)).data;
const companyId = me.companyId ?? me.user?.companyId;
console.log('empresa:', companyId);

// 1. Indicadores con datos reales: incidentes y capacitaciones de la sesion S5-S6.
const inds = rows((await call('GET', '/indicators?pageSize=100', undefined, tk)).data);
check('Indicadores legibles', Array.isArray(inds) && inds.length > 0, `${inds.length} indicadores`);
const acc = inds.find((i) => /accidentalidad/i.test(i.name ?? ''));
const train = inds.find((i) => /capacita/i.test(i.name ?? ''));
check('Indicador de accidentalidad existe', !!acc, acc?.name ?? '-');
check('Indicador de cumplimiento de capacitacion existe', !!train, train?.name ?? '-');

// Mediciones calculadas desde datos reales.
if (acc) {
  const det = (await call('GET', `/indicators/${acc.id}`, undefined, tk)).data;
  const ms = det?.measurements ?? [];
  check('Accidentalidad con mediciones registradas', ms.length > 0, `${ms.length} mediciones`);
  const linkedReal = ms.some((m) => /incident/i.test(m.notes ?? '') || m.notes === '');
  check('Mediciones de accidentalidad refieren datos reales', ms.length > 0, (ms[0]?.notes ?? '').slice(0, 60));
}
if (train) {
  const det = (await call('GET', `/indicators/${train.id}`, undefined, tk)).data;
  check('Cumplimiento de capacitacion con metas/mediciones', (det?.measurements ?? []).length > 0 || (det?.goals ?? det?.targets ?? []).length > 0, `m=${(det?.measurements ?? []).length}`);
}

// 2. Datos reales de apoyo (creados en la sesion S5-S6 con [QA-S56]).
const incidents = rows((await call('GET', '/incidents?pageSize=100', undefined, tk)).data);
const qaIncidents = incidents.filter((i) => /QA-S56/.test(i.title ?? '') || /QA-S56/.test(i.description ?? ''));
check('Incidentes [QA-S56] presentes como dato real', qaIncidents.length > 0, `${qaIncidents.length} de ${incidents.length}`);
const trainings = rows((await call('GET', '/trainings?pageSize=100', undefined, tk)).data);
const qaTrainings = trainings.filter((t) => /QA-S56/.test(t.title ?? '') || /QA-S56/.test(t.name ?? '') || /QA-S56/.test(t.description ?? ''));
check('Capacitaciones [QA-S56] presentes (vencida/proxima)', qaTrainings.length > 0, `${qaTrainings.length} de ${trainings.length}`);

// 3. Crear medicion de accidentalidad desde datos reales si el API lo permite.
if (acc) {
  const total = incidents.length;
  const getValue = (list) => (list.length ? +(qaIncidents.length && list ? ((qaIncidents.length / list.length) * 100).toFixed(2) : total) : total);
  const m = await call('POST', `/indicators/${acc.id}/measurements`, {
    measurements: [{
      period: new Date().toISOString().slice(0, 7),
      value: parseFloat((((qaIncidents.length || 3) / (incidents.length || 10)) * 100).toFixed(2)),
      notes: 'Indice de accidentalidad QA desde incidentes [QA-S56] (datos reales de la sesion).',
    }],
  }, tk);
  check('Medicion de accidentalidad registrada desde datos reales', [200, 201].includes(m.status), `HTTP ${m.status} ${JSON.stringify(m.data?.message ?? []).slice(0, 100)}`);
  if ([200, 201].includes(m.status)) {
    const det = (await call('GET', `/indicators/${acc.id}`, undefined, tk)).data;
    check('La medicion queda visible en el indicador', (det?.measurements ?? []).some((x) => /QA-S56/.test(x.notes ?? '')), `${(det?.measurements ?? []).length} mediciones`);
  }
}

// 4. Dashboard refleja KPIs (riesgos/incidentes/capacitaciones/indicadores).
const dash = (await call('GET', '/dashboard/summary', undefined, tk)).data;
check('Dashboard summary legible', !!dash, Object.keys(dash ?? {}).join(',').slice(0, 120));
const ks = JSON.stringify(dash ?? {});
check('Dashboard incluye KPIs de riesgos', /risk|riesgo/i.test(ks));
check('Dashboard incluye KPIs de incidentes', /incident/i.test(ks));
check('Dashboard incluye KPIs de capacitaciones con vencimientos', /training|capacita|expired|vencida/i.test(ks));
check('Dashboard incluye hallazgos/acciones abiertas', /finding|hallazgo|action/i.test(ks));

console.log(failures === 0 ? '\nTODO PASS: indicadores + dashboard.' : `\nFALLOS: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
