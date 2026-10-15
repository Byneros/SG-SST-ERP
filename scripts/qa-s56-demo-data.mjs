#!/usr/bin/env node
/**
 * Datos demo QA S5-S6 (issues #10-#14) — sesión de QA funcional.
 * Reutiliza las empresas demo de S3.1 ([S3.1-DEMO] Empresa A/B S.A.S.); si no
 * existen las crea. Siembra por empresa, con marca [QA-S56] (búsqueda por
 * titulo para idempotencia):
 *  - S5: sedes, riesgos con nivel/sede/cargo (GTC-45 reactivo), hallazgo MANUAL
 *    con causas (metodo Ishikawa sugerido por el DTO) y accion correctiva
 *    avanzada a IN_PROGRESS con responsable tracking.
 *  - S6: incidentes en los 3 estados (PENDING/IN_PROGRESS/RESOLVED),
 *    capacitaciones pasadas y futuras, indicador con metas y mediciones.
 * No elimina nada; para limpiar: scripts/cleanup-qa-s56.mjs.
 *
 * Uso: node scripts/qa-s56-demo-data.mjs [apiBase] [adminEmail] [adminPassword]
 * Default: http://localhost:3002/api/v1, super@sgsst.com.
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const ADMIN_EMAIL = process.argv[3] ?? 'super@sgsst.com';
const ADMIN_PASSWORD = process.argv[4] ?? 'Admin12345';
const MARK = '[QA-S56]';
const DEMO_MARK = '[S3.1-DEMO]';
const TS = Date.now();

let failures = 0;
let root;

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
    const msg = data && typeof data === 'object' && 'message' in data
      ? JSON.stringify(data.message).slice(0, 200) : '';
    throw new Error(`${method} ${path} -> HTTP ${res.status} (esperaba ${allowed.join('|')}) ${msg}`);
  }
  return { status: res.status, data };
}

function rows(res) {
  return Array.isArray(res?.data) ? res.data : (res?.data?.data ?? []);
}

async function login(email, password) {
  const r = await call('POST', '/auth/login', { email, password }, null, [200, 201]);
  const token = r.data.accessToken ?? r.data.access_token;
  if (!token) throw new Error('login sin accessToken');
  return token;
}

async function main() {
  root = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const me = (await call('GET', '/auth/me', undefined, root, 200)).data;
  console.log(`PASS  login ${me.role ?? me.user?.role ?? 'USER'}`);

  // Empresas: si el actor lista empresas (SUPER_ADMIN) y hay marcas demo, siembra
  // en A/B; si es ADMIN de una empresa (o no hay demo), siembra en la suya.
  let targetCompanies = [];
  const listRes = await call('GET', '/companies', undefined, root, [200, 403]);
  if (listRes.status === 200) {
    const companies = rows(listRes).filter((c) => c.name?.includes(DEMO_MARK) || c.name?.includes(MARK));
    targetCompanies = companies.slice(0, 2);
  }
  if (targetCompanies.length < 2 && !me.companyId) {
    throw new Error('sin empresas demo visibles y el usuario no pertenece a una empresa');
  }
  if (targetCompanies.length < 2) targetCompanies = [{ id: me.companyId ?? me.user?.companyId }];
  console.log(`PASS  empresas objetivo: ${targetCompanies.map((c) => c.id).join(' | ')}`);

  const summary = [];
  const tags = ['A', 'B'];
  for (let i = 0; i < targetCompanies.length; i++) {
    summary.push(await seedCompany(targetCompanies[i].id, tags[i]));
  }
  console.log('PASS  resumen:');
  for (const line of summary) console.log('  ' + line);
  if (failures) {
    console.error(`FALLOS: ${failures}`);
    process.exit(1);
  }
  console.log(`LISTO  datos demo [QA-S56] sembrados en ${targetCompanies.length === 2 ? 'ambas empresas' : 'la empresa del admin'}.`);
}

async function switchTo(companyId) {
  try {
    const r = await call('POST', '/auth/active-company', { companyId }, root, [200, 201]);
    root = r.data.accessToken ?? r.data.access_token ?? root;
  } catch {
    // ADMIN de empresa propia: el backend usa la company activa del token;
    // si el switch no esta permitido, continuamos sin cambiar de empresa.
    console.log(`INFO  switch a ${companyId} no permitido; se continua con la empresa activa`);
  }
}

async function seedCompany(companyId, tag) {
  await switchTo(companyId);
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const created = { risks: [], incidents: [], trainings: [], findings: [], actions: [], indicators: [] };

  // --- Trazabilidad S5: sede demo (idempotente) + empleado demo ---
  const existingSites = rows(await call('GET', `/sites?pageSize=100`, undefined, root, 200));
  const existingDemoSite = existingSites.find((s) => s.name?.includes(`${MARK} Sede demo ${tag}`) && s.deletedAt == null);
  const site = existingDemoSite
    ? { data: existingDemoSite, status: 200 }
    : await call('POST', '/sites', {
        name: `${MARK} Sede demo ${tag}`, code: `QA56-${tag}-${String(TS).slice(-5)}`, companyId,
      }, root, [200, 201]);
  created.site = site.data.id;
  console.log(existingDemoSite ? `INFO  ${tag}: sede demo reutilizada (idempotencia)` : '');
  const employee = await call('POST', '/employees', {
    firstName: 'QA', lastName: `Operario ${tag}`, document: `QA56-${tag}-${String(TS).slice(-6)}`,
    position: 'Operario', companyId,
  }, root, [200, 201]);
  created.employee = employee.data.id;

  // --- S5.1/#10: riesgos con nivel, sede y cargo (GTC-45 reactivo) ---
  const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  for (let i = 0; i < levels.length; i++) {
    const risk = await call('POST', '/risks', {
      title: `${MARK} Riesgo ${levels[i]} ${tag}`,
      description: `Riesgo demo ${levels[i]} asociado a proceso cargue de materiales, actividad manipulacion manual, peligro trabajo en altura.`,
      level: levels[i], siteId: site.data.id, position: 'Operario', companyId,
    }, root, [200, 201]);
    created.risks.push(risk.data.id);
  }
  console.log(`PASS  ${tag}: 4 riesgos (LOW..CRITICAL) con sede y cargo`);

  // --- S5.1/#10 via hallazgo+accion: hallazgo MANUAL con causas + plan correctivo ---
  const finding = await call('POST', '/findings', {
    title: `${MARK} Hallazgo demo ${tag}`,
    description: `Incumplimiento demo: proteccion anticaida ausente en plataforma del proceso de cargue.`,
    sourceType: 'MANUAL', type: 'NON_CONFORMITY', severity: 'MAJOR', companyId,
  }, root, [200, 201]);
  created.findings.push(finding.data.id);
  await call('POST', `/findings/${finding.data.id}/causes`, {
    causeType: 'Causa raiz', description: 'Falta de inspeccion semanal del andamio por parte del supervisor.',
  }, root, [200, 201]);
  await call('POST', `/findings/${finding.data.id}/causes`, {
    causeType: 'Condiciones', description: 'Plataforma sin linea de vida certificada.',
  }, root, [200, 201]);

  const action = await call('POST', '/actions', {
    title: `${MARK} Plan de intervencion ${tag}`,
    description: 'Plan correctivo: instalar linea de vida y capacitar al equipo de cargue.',
    kind: 'CORRECTIVE', sourceType: 'FINDING', sourceId: finding.data.id,
    rootCause: 'Falta de inspeccion semanal del andamio.',
    expectedBenefit: 'Eliminar exposicion a altura sin proteccion.',
    dueDate: day(30), companyId,
  }, root, [200, 201]);
  created.actions.push(action.data.id);
  await call('POST', `/actions/${action.data.id}/advance`, { target: 'IN_PROGRESS' }, root, [200, 201]);
  console.log(`PASS  ${tag}: hallazgo MANUAL con 2 causas + accion correctiva IN_PROGRESS`);

  // --- S6.1/#12: incidentes en 3 estados ---
  const incident = await call('POST', '/incidents', {
    title: `${MARK} Incidente demo ${tag}`,
    description: 'Incidente demo: caida leve de material en zona de cargue sin lesionados.',
    date: day(0), siteId: site.data.id, companyId,
  }, root, [200, 201]);
  created.incidents.push(incident.data.id);

  const incident2 = await call('POST', '/incidents', {
    title: `${MARK} Incidente en investigacion ${tag}`,
    description: 'Accidente demo de trabajo con lesion leve en mano derecha.',
    date: day(-10), siteId: site.data.id, companyId,
  }, root, [200, 201]);
  await call('PATCH', `/incidents/${incident2.data.id}`, { status: 'IN_PROGRESS' }, root, [200]);
  created.incidents.push(incident2.data.id);

  const incident3 = await call('POST', '/incidents', {
    title: `${MARK} Incidente cerrado ${tag}`,
    description: 'Casi accidente demo: deslizamiento en pasillo por piso humedo.',
    date: day(-30), siteId: site.data.id, companyId,
  }, root, [200, 201]);
  await call('PATCH', `/incidents/${incident3.data.id}`, { status: 'RESOLVED' }, root, [200]);
  created.incidents.push(incident3.data.id);
  console.log(`PASS  ${tag}: 3 incidentes (PENDING/IN_PROGRESS/RESOLVED)`);

  // --- S6.2/#13: capacitaciones pasada y futura ---
  const trainingPast = await call('POST', '/trainings', {
    title: `${MARK} Capacitacion vencida ${tag}`,
    description: 'Induccion SST anual (reclamada al ano vencido, para QA de vencimientos).',
    date: day(-370), siteId: site.data.id, companyId,
  }, root, [200, 201]);
  created.trainings.push(trainingPast.data.id);
  const trainingFuture = await call('POST', '/trainings', {
    title: `${MARK} Capacitacion proxima ${tag}`,
    description: 'Capacitacion demo: trabajo seguro en alturas, refresher trimestral.',
    date: day(15), siteId: site.data.id, companyId,
  }, root, [200, 201]);
  created.trainings.push(trainingFuture.data.id);
  console.log(`PASS  ${tag}: 2 capacitaciones (vencida -370d / proxima +15d)`);

  // --- S6.3/#14: indicador con meta y medicion ---
  const indicator = await call('POST', '/indicators', {
    name: `${MARK} Indice de accidentalidad ${tag}`,
    description: 'Indicador demo alimentado con los incidentes de la sesion QA S5-S6.',
    code: `QA56-${tag}`, unit: '%', value: 1.2, direction: 'LOWER_IS_BETTER', companyId,
    siteId: site.data.id,
  }, root, [200, 201]);
  created.indicators.push(indicator.data.id);
  await call('PUT', `/indicators/${indicator.data.id}/targets`, {
    targets: [
      { period: new Date().getFullYear() + '', target: 2.0 },
      { period: `${new Date().getFullYear()}-Q4`, target: 1.5 },
    ],
  }, root, [200]);
  await call('POST', `/indicators/${indicator.data.id}/measurements`, {
    measurements: [
      { period: day(0).slice(0, 7), value: 1.2, notes: 'Demo medida con incidente abierto del dia.' },
      { period: day(-30).slice(0, 7), value: 0.0, notes: 'Demo mes sin accidentes.' },
    ],
  }, root, [200, 201]);
  console.log(`PASS  ${tag}: indicador con 2 metas y 2 mediciones`);

  return `${tag}: site=${created.site} risks=${created.risks.length} findings=${created.findings.length} ` +
    `actions=${created.actions.length} incidents=${created.incidents.length} trainings=${created.trainings.length} indicators=${created.indicators.length}`;
}

main().catch((err) => {
  console.error('ABORT ', err.message);
  process.exit(1);
});
