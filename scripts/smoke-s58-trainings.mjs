#!/usr/bin/env node
/**
 * Smoke #58: capacitaciones con asistentes, evaluación, evidencia por
 * trabajador y vencimiento del certificado + dashboard de vencimientos.
 * Los registros creados se eliminan al final (limpieza por prefijo [SMOKE-S58]).
 * Uso: node scripts/smoke-s58-trainings.mjs [apiBase] [email] [password]
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

const PREFIX = '[SMOKE-S58]';
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

  // 0. Datos base: trabajadores y documento de evidencia
  const employeesRes = await call('GET', '/employees', undefined, token);
  const employees = Array.isArray(employeesRes.data) ? employeesRes.data : employeesRes.data?.data ?? [];
  const emp = employees.find((e) => !e.deletedAt) ?? null;
  const docsRes = await call('GET', '/documents', undefined, token);
  const docs = Array.isArray(docsRes.data) ? docsRes.data : docsRes.data?.data ?? [];
  const doc = docs.find((d) => !d.deletedAt) ?? null;
  if (!emp) console.log('  (aviso) sin trabajadores demo; los checks de employeeId se saltarán');
  if (!doc) console.log('  (aviso) sin documentos demo; los checks de evidencia se saltarán');

  // 1. Limpieza de restos de corridas anteriores
  const list0 = await call('GET', '/trainings', undefined, token);
  for (const t of (list0.data ?? []).filter((x) => x.title?.startsWith(PREFIX))) {
    const d = await call('DELETE', `/trainings/${t.id}`, undefined, token);
    if (d.status !== 200) console.log('  (aviso) no se pudo limpiar', t.id, d.status);
  }

  // 2. Crear capacitación con asistentes inline (trabajador + externo por nombre)
  const date = '2026-01-15T10:00:00.000Z';
  const body = {
    title: `${PREFIX} Inducción general`,
    date,
    instructor: 'Instructor QA',
    validityMonths: 2,
    attendees: [
      ...(emp ? [{ employeeId: emp.id, status: 'PASSED', score: 92 }] : []),
      { name: `${PREFIX} Contratista externo`, status: 'FAILED', score: 40 },
    ],
  };
  const created = await call('POST', '/trainings', body, token);
  const okCreate = created.status === 201 && !!created.data?.id;
  check('POST /trainings con asistentes inline', okCreate, `status ${created.status}`);
  const trainingId = created.data?.id;
  const att = created.data?.attendees ?? [];
  const empAtt = att.find((a) => a.employeeId === emp?.id);
  const extAtt = att.find((a) => a.name?.includes('Contratista externo'));
  check('Asistente interno congeló nombre del trabajador', !!empAtt && empAtt.name === `${emp.firstName} ${emp.lastName}`.trim(), empAtt?.name);
  check('Asistente externo por nombre', !!extAtt && extAtt.status === 'FAILED', extAtt?.status);
  // Vencimiento derivado: fecha + 2 meses (aprox 61 días => ~2026-03-16)
  const expectedExpiry = new Date(new Date(date).getTime() + 61 * 24 * 3600 * 1000);
  check('Vencimiento derivado de validityMonths', !!empAtt?.expiresAt && Math.abs(new Date(empAtt.expiresAt) - expectedExpiry) < 2 * 24 * 3600 * 1000, empAtt?.expiresAt);

  // 3. Evaluación/evidencia via PATCH /trainings/attendees/:id
  if (empAtt && doc) {
    const patched = await call('PATCH', `/trainings/attendees/${empAtt.id}`, { score: 95, evidenceId: doc.id, notes: 'evidencia firma' }, token);
    check('PATCH attendee añade score/evidencia', patched.status === 200 && patched.data?.score === 95 && patched.data?.evidence?.id === doc.id, `status ${patched.status}`);
  } else if (empAtt) {
    const patched = await call('PATCH', `/trainings/attendees/${empAtt.id}`, { score: 95 }, token);
    check('PATCH attendee añade score', patched.status === 200 && patched.data?.score === 95, `status ${patched.status}`);
  }

  // 4. Alta de asistente por endpoint + rechazo de asistente sin employee/name
  const extra = await call('POST', `/trainings/${trainingId}/attendees`, emp ? { employeeId: emp.id } : { name: `${PREFIX} Extra` }, token);
  check('POST attendees por endpoint', extra.status === 201 && !!extra.data?.id, `status ${extra.status}`);
  const bad = await call('POST', `/trainings/${trainingId}/attendees`, {}, token);
  check('POST attendees sin employee/name rechazado', bad.status === 400, `status ${bad.status}`);
  const badEmp = await call('POST', `/trainings/${trainingId}/attendees`, { employeeId: '00000000-0000-0000-0000-000000000000' }, token);
  check('POST attendees con employee inexistente rechazado (400/404)', badEmp.status === 400 || badEmp.status === 404, `status ${badEmp.status}`);

  // 5. Cambia a PASSED derivando vencimiento (la capacitación tiene vigencia)
  if (extra.ok !== false && extra.data?.id) {
    const passed = await call('PATCH', `/trainings/attendees/${extra.data.id}`, { status: 'PASSED' }, token);
    if (extra.data.employeeId === emp?.id) {
      check('PATCH status PASSED deriva vencimiento', passed.status === 200 && !!passed.data?.expiresAt, passed.data?.expiresAt);
    } else {
      check('PATCH status PASSED actualizado', passed.status === 200 && passed.data?.status === 'PASSED', `status ${passed.status}`);
    }
  }

  // 6. Dashboard de vencimientos (vencidos con fecha pasada + resumen)
  const exp = await call('GET', '/trainings/expirations?days=365', undefined, token);
  const hasItems = exp.status === 200 && Array.isArray(exp.data?.items);
  const listed = hasItems ? exp.data.items.some((i) => i.training?.title?.startsWith(PREFIX)) : false;
  check('GET /trainings/expirations lista certificados por vencer/vencidos', hasItems && exp.data?.summary && typeof exp.data.summary.expired === 'number', `status ${exp.status}`);
  check('Los asistentes de la smoke de capacitación aparecen en el dashboard', listed, hasItems ? `${exp.data.items.length} items` : 'sin items');

  // 7. Aislamiento multi-empresa: otra empresa no ve la capacitación ni edita asistentes
  const loginB = await call('POST', '/auth/login', { email: 'admin-b@demo.com', password: 'Admin12345' });
  if (loginB.status === 200 || loginB.status === 201) {
    const tokB = loginB.data.accessToken;
    const listB = await call('GET', '/trainings', undefined, tokB);
    const leak = (listB.data ?? []).some((t) => t.id === trainingId);
    check('Aislamiento: empresa B no ve la capacitación de A', !leak, `capacitaciones B: ${(listB.data ?? []).length}`);
    const pat = await call('PATCH', `/trainings/${trainingId}`, { title: 'hack' }, tokB);
    check('Aislamiento: empresa B no puede editar capacitación de A (404)', pat.status === 404, `status ${pat.status}`);
    const gexp = await call('GET', '/trainings/expirations', undefined, tokB);
    check('Aislamiento: expirations de B no lista capacitaciones de A', gexp.status === 200 && !(gexp.data?.items ?? []).some((i) => i.training?.title?.startsWith(PREFIX)), `status ${gexp.status}`);
  } else {
    console.log('  (aviso) admin-b demo no disponible:', loginB.status);
  }

  // 8. Limpieza (el delete del training hace cascade de asistentes)
  const del = await call('DELETE', `/trainings/${trainingId}`, undefined, token);
  const listAfter = await call('GET', '/trainings', undefined, token);
  const gone = !(listAfter.data ?? []).some((t) => t.id === trainingId);
  check('Limpieza: capacitación eliminada del listado', gone && del.status === 200, `status ${del.status}`);

  console.log(`\n${failures === 0 ? 'TODO PASS' : failures + ' FAIL'} (${results.length} checks)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1); });
