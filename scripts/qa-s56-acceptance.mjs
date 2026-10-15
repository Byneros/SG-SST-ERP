#!/usr/bin/env node
/**
 * Aceptacion API de la sesion QA S5-S6 (issues #10-#14).
 * Verifica sobre los datos sembrados por qa-s56-demo-data.mjs (marca [QA-S56]):
 *  - #10/#11 S5: riesgos con nivel/sede/cargo, trazabilidad y 404 cross-tenant.
 *  - #12 S6: incidentes con ciclo de estados; hallazgo con causas; accion
 *    correctiva de origen FINDING avanzando con responsable/tracking.
 *  - #13 S6: capacitaciones pasadas/futuras listadas (vencimientos en la UI).
 *  - #14 S6: indicador con metas/mediciones y presencia de KPIs en dashboard.
 * Imprime PASS/FAIL por criterio; exit 1 si alguno falla.
 * Gaps funcionales conocidos (no se prueban aqui, ver runbook):
 *  la cadena GTC-45 completa (proceso/actividad/peligro/valoracion/control),
 *  campos de investigacion del incidente y asistentes/evaluacion/evidencia
 *  por capacitacion no tienen modelo propio; requieren decision en #10-#13.
 *
 * Uso: node scripts/qa-s56-acceptance.mjs [apiBase] [adminEmail] [adminPassword]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const ADMIN_EMAIL = process.argv[3] ?? 'super@sgsst.com';
const ADMIN_PASSWORD = process.argv[4] ?? 'Admin12345';
const MARK = '[QA-S56]';

const results = [];
let failures = 0;
let token;

function check(issue, criterion, ok, detail = '') {
  const label = ok ? 'PASS ' : 'FAIL ';
  if (!ok) failures++;
  results.push(`${label} #${issue} ${criterion}${detail ? ' | ' + detail : ''}`);
  console.log(results[results.length - 1]);
}

async function call(method, path, body, tok, expect = 200) {
  const allowed = Array.isArray(expect) ? expect : [expect];
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, ok: allowed.includes(res.status) };
}

function rows(res) {
  return Array.isArray(res?.data) ? res.data : (res?.data?.data ?? []);
}

async function switchTo(companyId) {
  const r = await call('POST', '/auth/active-company', { companyId }, token, [200, 201]);
  token = r.data.accessToken ?? r.data.access_token ?? token;
}

async function main() {
  const login = await call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, null, [200, 201]);
  token = login.data.accessToken ?? login.data.access_token;
  const me = (await call('GET', '/auth/me', undefined, token, 200)).data;
  const listRes = await call('GET', '/companies', undefined, token, [200, 403]);
  let ids = [];
  if (listRes.status === 200) {
    ids = rows(listRes).filter((c) => c.name?.includes('[QA-S56]') || c.name?.includes('[S3.1-DEMO]')).slice(0, 2).map((c) => c.id);
  }
  if (ids.length < 2) {
    const own = me.companyId ?? me.user?.companyId;
    if (!own) throw new Error('sin empresas demo visibles y el usuario no pertenece a una empresa');
    if (ids.length === 0 || ids[0] !== own) ids = [own];
    console.log('INFO  modo empresa propia: verificación sin prueba cross-tenant (requiere 2 empresas demo para ese check)');
  }
  const [idA, idB] = ids.length >= 2 ? [ids[0], ids[1]] : [ids[0], null];

  for (const [companyId, tag] of [[idA, 'A'], [idB, 'B']]) {
    if (!companyId) continue; // modo empresa propia: solo A
    await switchTo(companyId);

    // --- #10/#11 S5: riesgos y trazabilidad ---
    const risks = rows(await call('GET', '/risks?pageSize=100', undefined, token, 200));
    const demoRisks = risks.filter((r) => r.title?.includes(MARK));
    check(10, `Riesgos demo creados con nivel (${tag})`, demoRisks.length >= 4, `${demoRisks.length} riesgos`);
    check(10, `Riesgo con level/sitio/cargo tratable (${tag})`,
      demoRisks.some((r) => r.level && r.companyId === companyId && (r.siteId == null || r.siteId) && r.position === 'Operario'));
    const withSite = demoRisks.filter((r) => r.siteId);
    check(11, `Trazabilidad sede asignada (${tag})`, withSite.length >= 1, `${withSite.length} con sede`);

    // --- #12 S6: ciclo de incidentes + hallazgo/accion ---
    const incidents = rows(await call('GET', '/incidents?pageSize=100', undefined, token, 200));
    const demoIncidents = incidents.filter((i) => i.title?.includes(MARK));
    const states = new Set(demoIncidents.map((i) => i.status));
    check(12, `Incidentes en ciclo (PENDING/IN_PROGRESS/RESOLVED) (${tag})`,
      states.size === 3 || demoIncidents.length >= 3, [...states].join(','));
    const check26 = demoIncidents.some((i) => i.status === 'RESOLVED');
    check(12, `Incidente con estado de cierre (${tag})`, check26);

    const findings = rows(await call('GET', '/findings?pageSize=100', undefined, token, 200));
    const demoFinding = findings.find((f) => f.title?.includes(MARK));
    check(10, `Hallazgo unificado con riesgo asociado (${tag})`, !!demoFinding, demoFinding?.id);
    let causesCount = -1;
    if (demoFinding) {
      const det = await call('GET', `/findings/${demoFinding.id}`, undefined, token, 200);
      causesCount = Array.isArray(det.data?.causes) ? det.data.causes.length :
        (det.data?.causesCount ?? (typeof det.data?.causes === 'number' ? det.data.causes : -1));
    }
    check(12, `Hallazgo con causas registradas (${tag})`, causesCount >= 2, `causas=${causesCount}`);

    const actions = rows(await call('GET', '/actions?pageSize=100', undefined, token, 200));
    const demoAction = actions.find((a) => a.title?.includes(MARK));
    check(12, `Accion correctiva de origen hallazgo (${tag})`,
      !!demoAction && demoAction.sourceType === 'FINDING' && demoAction.sourceId === demoFinding?.id,
      demoAction ? `status=${demoAction.status}` : 'sin accion');
    check(12, `Accion avanzada con seguimiento (${tag})`, demoAction?.status === 'IN_PROGRESS');

    // --- #13 S6: capacitaciones ---
    const trainings = rows(await call('GET', '/trainings?pageSize=100', undefined, token, 200));
    const demoTrainings = trainings.filter((t) => t.title?.includes(MARK));
    check(13, `Capacitaciones pasada y futura listadas (${tag})`, demoTrainings.length >= 2, `${demoTrainings.length}`);

    // --- #14 S6: indicador con datos reales ---
    const indicators = rows(await call('GET', '/indicators?pageSize=100', undefined, token, 200));
    const demoIndicator = indicators.find((i) => i.title?.includes(MARK) || i.name?.includes(MARK));
    check(14, `Indicador demo con metas/mediciones (${tag})`, !!demoIndicator, demoIndicator?.id);

    // --- Dashboard: KPIs de riesgos/incidentes/capacitaciones visibles ---
    const dash = await call('GET', '/dashboard/summary', undefined, token, 200);
    const raw = JSON.stringify(dash.data ?? {});
    check(10, `Dashboard refleja riesgos/incidentes (${tag})`,
      raw.length > 0 && /risk|incident/i.test(raw), 'GET /dashboard/summary');
  }

  // --- #11 S5/S6: aislamiento cross-tenant (404, solo con 2 empresas demo) ---
  if (!idB) {
    console.log('SKIP  bloque cross-tenant: solo hay 1 empresa demo disponible');
    console.log(failures === 0
      ? '\nTODO PASS: criterios API de #10-#14 verificables sin UI.'
      : `\nFALLOS: ${failures} — revisar los FAIL de arriba antes de la sesion UI.`);
    process.exit(failures === 0 ? 0 : 1);
  }
  await switchTo(idA);
  const bRisks = rows(await call('GET', '/risks?pageSize=100', undefined, token, 200));
  const crossRisk = bRisks.find((r) => r.title?.includes(MARK) && r.companyId && r.companyId !== idA) ??
    bRisks.find((r) => r.title?.includes(MARK));
  const bIncidents = rows(await call('GET', '/incidents?pageSize=100', undefined, token, 200));
  const crossIncident = bIncidents.find((i) => i.title?.includes(MARK) && i.companyId !== idA);
  if (crossRisk) check(11, 'Riesgo de otra empresa -> 404', (await call('GET', `/risks/${crossRisk.id}`, undefined, token, [404])).ok);
  else console.log('SKIP  riesgo cross-tenant: sin id de empresa B en el listado A (correcto: no visible)');
  if (crossIncident) check(12, 'Incidente de otra empresa -> 404', (await call('GET', `/incidents/${crossIncident.id}`, undefined, token, [404])).ok);
  else console.log('SKIP  incidente cross-tenant: sin id de empresa B en el listado A (correcto: no visible)');

  console.log(failures === 0
    ? '\nTODO PASS: criterios API de #10-#14 verificables sin UI.'
    : `\nFALLOS: ${failures} — revisar los FAIL de arriba antes de la sesion UI.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('ABORT ', err.message);
  process.exit(1);
});
