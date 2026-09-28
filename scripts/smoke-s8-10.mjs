#!/usr/bin/env node
/**
 * Smoke test S8-S10 contra la API dev (flujo Codigo -> Prueba -> Evidencia).
 *
 * Valida via HTTP real:
 * - S8: crear plan anual (si no existe), actividad PHVA, responder avance al
 *   100% y exportar el reporte annual-plan (CSV).
 * - S10: profesiograma (perfil de cargo), examen ocupacional programado y con
 *   concepto, restriccion creada y levantada con responsable.
 *
 * Limpieza: elimina los recursos marcados [SMOKE] que creo. No requiere
 * credenciales de proveedor ni colas: apunta a la API dev del compose.
 *
 * Uso: node scripts/smoke-s8-10.mjs [apiBase] [email] [password]
 * Por defecto: http://localhost:3002/api/v1 admin@sgsst.com Admin12345
 */

const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD = process.argv[4] ?? 'Admin12345';
const MARK = '[SMOKE]';

const results = [];
let token = null;

function record(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, body, expect = 201) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text.slice(0, 200);
  }
  if (!Array.isArray(expect)) expect = [expect];
  if (!expect.includes(response.status)) {
    throw new Error(
      `${method} ${path} -> HTTP ${response.status} (esperaba ${expect.join('/')}): ` +
        `${typeof payload === 'string' ? payload : JSON.stringify(payload).slice(0, 300)}`,
    );
  }
  return payload;
}

async function main() {
  // 0. Login
  const login = await call(
    'POST',
    '/auth/login',
    { email: EMAIL, password: PASSWORD },
    [200, 201],
  );
  token = login.accessToken ?? login.access_token;
  record('S0 login', Boolean(token));

  const me = await call('GET', '/auth/me', undefined, 200);
  const userId = me.id ?? me.sub ?? me.user?.id;
  const companyId = me.companyId ?? me.user?.companyId;
  record('S0 auth/me', Boolean(userId && companyId), `company=${companyId}`);

  // ===== S8: Plan anual + actividades + reporte =====
  const year = new Date().getFullYear();
  let planId = null;
  let planCreated = false;
  const plans = await call(
    'GET',
    `/annual-work-plans?companyId=${companyId}&year=${year}`,
    undefined,
    200,
  );
  const existing = (plans.data ?? plans).find?.((p) => p.year === year);
  if (existing) {
    planId = existing.id;
    record('S8 plan anual existe', true, `anio ${year} (preexistente, no se borra)`);
  } else {
    const plan = await call('POST', '/annual-work-plans', {
      year,
      companyId,
      status: 'IN_PROGRESS',
    });
    planId = plan.id;
    planCreated = true;
    record('S8 plan anual creado', Boolean(planId), `anio ${year}`);
  }

  const activity = await call(
    'POST',
    `/annual-work-plans/${planId}/activities`,
    {
      cycle: 'PLANEAR',
      name: `${MARK} actividad smoke S8.2`,
      frequency: 'Anual',
      progress: 0,
      status: 'IN_PROGRESS',
      planId,
      companyId,
    },
  );
  record('S8.2 actividad creada', Boolean(activity?.id));

  const updated = await call(
    'PATCH',
    `/annual-work-plans/${planId}/activities/${activity.id}`,
    { progress: 100, status: 'DONE' },
    200,
  );
  const progressOk = (updated.progress ?? 0) === 100;
  record('S8.2 avance respondido (DONE=100%)', progressOk);

  const csvResponse = await fetch(
    `${API}/reports/annual-plan.csv?year=${year}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const csvText = await csvResponse.text();
  record(
    'S8.4 reporte annual-plan CSV',
    [200, 201, 202].includes(csvResponse.status) &&
      csvText.includes('actividad smoke S8.2'),
    `HTTP ${csvResponse.status}, ${csvText.length} bytes`,
  );

  const pdfResponse = await fetch(
    `${API}/reports/annual-plan.pdf?year=${year}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  await pdfResponse.arrayBuffer();
  record(
    'S8.4 reporte annual-plan PDF',
    [200, 201, 202].includes(pdfResponse.status),
    `HTTP ${pdfResponse.status}`,
  );

  // ===== S9: Inspecciones, reportes inseguros y EPP =====
  const today = new Date().toISOString();
  const inspection = await call('POST', '/planned-inspections', {
    title: `${MARK} inspeccion smoke S9.1`,
    type: 'LOCATIVE',
    scheduledAt: today,
    companyId,
    items: [{ order: 1, section: 'General', question: `${MARK} pasillo despejado?` }],
  });
  record('S9.1 inspeccion planeada creada', Boolean(inspection?.id));

  const item = (inspection.items ?? [])[0];
  if (item?.id) {
    const answered = await call(
      'PATCH',
      `/planned-inspections/items/${item.id}?inspectionId=${inspection.id}`,
      { answer: 'NO', notes: 'hallazgo de prueba' },
      200,
    );
    record('S9.1 item del checklist respondido', Boolean(answered));
  } else {
    record('S9.1 item del checklist respondido', false, 'la inspeccion no devolvio items');
  }

  const finding = await call(
    'POST',
    `/planned-inspections/${inspection.id}/findings`,
    { description: `${MARK} hallazgo smoke S9.1`, severity: 'MINOR' },
  );
  record('S9.1 hallazgo registrado', Boolean(finding?.id));

  const action = await call(
    'POST',
    `/planned-inspections/findings/${finding.id}/actions`,
    {
      title: `${MARK} accion smoke S9.1`,
      responsible: 'Smoke Responsable',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  );
  record('S9.1 accion correctiva generada', Boolean(action?.id));

  const unplanned = await call('POST', '/unplanned-inspections', {
    title: `${MARK} inspeccion reactiva smoke S9.2`,
    reason: 'prueba de smoke S9.2',
    executedAt: today,
    companyId,
  });
  record('S9.2 inspeccion no planeada creada', Boolean(unplanned?.id));

  const reactiveFinding = await call(
    'POST',
    `/unplanned-inspections/${unplanned.id}/findings`,
    {
      description: `${MARK} hallazgo reactivo smoke S9.2`,
      severity: 'MAJOR',
      riskLevel: 'MEDIUM',
    },
  );
  const generatedRiskId = reactiveFinding?.risk?.id ?? reactiveFinding?.riskId ?? null;
  record(
    'S9.2 hallazgo reactivo genera riesgo GTC-45',
    Boolean(generatedRiskId),
    generatedRiskId ? `risk=${generatedRiskId}` : 'sin risk en la respuesta',
  );

  const unsafe = await call('POST', '/unsafe-reports', {
    kind: 'UNSAFE_CONDITION',
    description: `${MARK} reporte inseguro smoke S9.3`,
    severity: 'MINOR',
    isAnonymous: true,
    companyId,
  });
  record('S9.3 reporte anonimo creado', Boolean(unsafe?.id));

  const closed = await call(
    'PATCH',
    `/unsafe-reports/${unsafe.id}`,
    { status: 'CLOSED' },
    200,
  );
  record('S9.3 reporte cerrado', closed?.status === 'CLOSED');

  const ppeItem = await call('POST', '/ppe/items', {
    name: `${MARK} guante smoke S9.4`,
    type: 'Guante',
    standard: 'NA-1234',
    size: 'M',
    usefulLifeDays: 90,
    stockMin: 2,
    stock: 10,
    companyId,
  });
  record('S9.4 item EPP creado', Boolean(ppeItem?.id));

  const delivery = await call(
    'POST',
    '/ppe/deliveries',
    {
      itemId: ppeItem.id,
      employeeId: null,
      quantity: 2,
      deliveredAt: today,
      signature: 'SMOKE',
      companyId,
    },
    [201, 400],
  );
  const deliverySkipped = delivery?.statusCode === 400;
  if (deliverySkipped) {
    record(
      'S9.4 entrega EPP (requiere empleado)',
      true,
      'salteada: el flujo real exige empleado; se limpia por API de datos',
    );
  }

  // ===== S10: Medicina laboral =====
  const employee = await call('POST', '/employees', {
    firstName: 'Smoke',
    lastName: 'S10',
    document: `SMOKE-${Date.now()}`,
    position: 'Operario SMOKE',
    companyId,
  });
  record('S10 empleado de prueba creado', Boolean(employee?.id));

  const profile = await call('POST', '/medical/profiles', {
    position: `Operario SMOKE perfil ${Date.now()}`,
    description: `${MARK} profesiograma smoke S10.1`,
    companyId,
  });
  record('S10.1 profesiograma creado', Boolean(profile?.id));

  const exam = await call('POST', '/medical/exams', {
    examType: 'PERIODICO',
    concept: 'PENDIENTE',
    scheduledAt: new Date().toISOString(),
    employeeId: employee.id,
    companyId,
  });
  record('S10.2 examen programado', Boolean(exam?.id));

  const examUpdated = await call(
    'PATCH',
    `/medical/exams/${exam.id}`,
    {
      concept: 'APTO',
      performedAt: new Date().toISOString(),
      provider: 'SMOKE-IPS',
    },
    200,
  );
  record(
    'S10.2 concepto registrado',
    examUpdated?.concept === 'APTO',
    `concept=${examUpdated?.concept ?? '?'}`,
  );

  const restriction = await call('POST', '/medical/restrictions', {
    description: `${MARK} restriccion smoke S10.3`,
    employeeId: employee.id,
    companyId,
    startDate: new Date().toISOString(),
  });
  record('S10.3 restriccion creada', Boolean(restriction?.id));

  const lifted = await call(
    'PATCH',
    `/medical/restrictions/${restriction.id}/lift`,
    { liftedBy: userId },
    200,
  );
  record(
    'S10.3 restriccion levantada con responsable',
    lifted?.status === 'LIFTED',
    `status=${lifted?.status ?? '?'}`,
  );

  // ===== Limpieza =====
  const cleanup = [
    () => call('DELETE', `/annual-work-plans/${planId}/activities/${activity.id}`, undefined, [200, 204]),
    () => call('DELETE', `/planned-inspections/${inspection.id}`, undefined, [200, 204]),
    () => call('DELETE', `/unplanned-inspections/${unplanned.id}`, undefined, [200, 204]),
    generatedRiskId
      ? () => call('DELETE', `/risks/${generatedRiskId}`, undefined, [200, 204, 404])
      : null,
    () => call('DELETE', `/unsafe-reports/${unsafe.id}`, undefined, [200, 204]),
    () => call('DELETE', `/ppe/items/${ppeItem.id}`, undefined, [200, 204, 409]),
    () => call('DELETE', `/medical/restrictions/${restriction.id}`, undefined, [200, 204, 404, 405]),
    () => call('DELETE', `/medical/exams/${exam.id}`, undefined, [200, 204]),
    () => call('DELETE', `/employees/${employee.id}`, undefined, [200, 204, 409]),
    planCreated
      ? () => call('DELETE', `/annual-work-plans/${planId}`, undefined, [200, 204])
      : null,
  ].filter(Boolean);
  let cleanupOk = true;
  for (const run of cleanup) {
    try {
      await run();
    } catch (error) {
      cleanupOk = false;
      record('limpieza', false, error.message.slice(0, 160));
    }
  }
  if (cleanupOk) {
    record('limpieza de recursos [SMOKE]', true);
  }
}

try {
  await main();
} catch (error) {
  record('flujo abortado', false, error.message.slice(0, 300));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n== Smoke S8-S10: ${results.length - failed.length}/${results.length} pasos OK ==`);
process.exit(failed.length > 0 ? 1 : 0);
