#!/usr/bin/env node
/**
 * Smoke test S15.2 (acciones correctivas/preventivas/mejora) contra la API dev.
 *
 * Valida via HTTP real (#41):
 * - CORRECTIVE exige hallazgo de origen del tenant (400 sin origen, 404 ajeno).
 * - Avance OPEN -> IN_PROGRESS -> DONE con guarda de evidencia.
 * - Verificacion: CORRECTIVE exige causa raiz; PREVENTIVE exige beneficio
 *   esperado; hallazgo CRITICAL exige verificador distinto del responsable.
 * - Sello de eficacia, verificador y fecha; CANCELLED solo desde OPEN/IN_PROGRESS.
 *
 * Limpieza: elimina los recursos marcados [SMOKE] que creo.
 *
 * Uso: node scripts/smoke-s15-actions.mjs [apiBase] [email] [password] [emailSST]
 */

const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD =
  process.argv[4] ??
  process.env.QA_PASS ??
  process.env.SEED_ADMIN_PASSWORD ??
  '';
// Segundo usuario para la regla de verificador distinto en hallazgos CRITICAL.
const EMAIL_SST = process.argv[5] ?? 'sst@sgsst.com';
const MARK = '[SMOKE]';

const results = [];
let token = null;
let tokenSst = null;

function record(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, body, expect = 201, withToken = null) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${withToken ?? token}`,
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

async function expectStatus(method, path, body, status, withToken = null) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${withToken ?? token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response.status === status;
}

async function main() {
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString();

  // 0. Logins (admin y SST para la regla CRITICAL)
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, [200, 201]);
  token = login.accessToken ?? login.access_token;
  record('S0 login admin', Boolean(token));
  const loginSst = await call('POST', '/auth/login', { email: EMAIL_SST, password: PASSWORD }, [200, 201]);
  tokenSst = loginSst.accessToken ?? loginSst.access_token;
  record('S0 login SST (verificador)', Boolean(tokenSst));

  const me = await call('GET', '/auth/me', undefined, 200);
  const companyId = me.companyId ?? me.user?.companyId;
  const adminId = me.id ?? me.sub ?? me.user?.id;
  record('S0 auth/me', Boolean(companyId && adminId), `company=${companyId}`);

  // ===== Hallazgos de origen =====
  const findingMajor = await call('POST', '/findings', {
    title: `${MARK} hallazgo origen S15.2`,
    description: 'Hallazgo MAJOR para accion correctiva',
    sourceType: 'MANUAL',
    severity: 'MAJOR',
    companyId,
  });
  record('S15.2 hallazgo MAJOR creado', Boolean(findingMajor?.id), `id=${findingMajor?.id}`);

  const findingCritical = await call('POST', '/findings', {
    title: `${MARK} hallazgo critico S15.2`,
    description: 'Hallazgo CRITICAL para regla de verificador',
    sourceType: 'MANUAL',
    severity: 'CRITICAL',
    ownerId: adminId,
    companyId,
  });
  record('S15.2 hallazgo CRITICAL creado', Boolean(findingCritical?.id), `id=${findingCritical?.id}`);

  // ===== Guardas de creacion =====
  record(
    'S15.2 CORRECTIVE sin hallazgo rechazada',
    await expectStatus('POST', '/actions', {
      title: `${MARK} sin origen`,
      description: 'debe fallar',
      kind: 'CORRECTIVE',
      dueDate,
      companyId,
    }, 400),
  );

  record(
    'S15.2 CORRECTIVE con hallazgo ajeno rechazada (404)',
    await expectStatus('POST', '/actions', {
      title: `${MARK} origen falso`,
      description: 'debe fallar',
      kind: 'CORRECTIVE',
      sourceType: 'FINDING',
      sourceId: '00000000-0000-4000-8000-000000000000',
      dueDate,
      companyId,
    }, 404),
  );

  // ===== Flujo completo de la CORRECTIVE =====
  let action = await call('POST', '/actions', {
    title: `${MARK} accion correctiva S15.2`,
    description: 'Reparar y documentar la correccion',
    kind: 'CORRECTIVE',
    sourceType: 'FINDING',
    sourceId: findingMajor.id,
    ownerId: adminId,
    dueDate,
    companyId,
  });
  record('S15.2 CORRECTIVE creada (OPEN)', action?.status === 'OPEN', `id=${action?.id}`);

  action = await call('POST', `/actions/${action.id}/advance`, { target: 'IN_PROGRESS' }, [200, 201]);
  record('S15.2 OPEN -> IN_PROGRESS', action?.status === 'IN_PROGRESS');

  record(
    'S15.2 DONE sin evidencia rechazado',
    await expectStatus('POST', `/actions/${action.id}/advance`, { target: 'DONE' }, 400),
  );

  const document = await call('POST', '/documents', {
    name: `${MARK} evidencia S15.2`,
    fileUrl: '/smoke/s15-accion-evidencia.pdf',
    category: 'OTHER',
    status: 'PUBLISHED',
    companyId,
  });
  record('S15.2 documento de evidencia creado', Boolean(document?.id), `doc=${document?.id}`);

  action = await call('PATCH', `/actions/${action.id}`, { evidenceId: document.id }, 200);
  record('S15.2 evidencia adjuntada', action?.evidenceId === document.id);

  action = await call('POST', `/actions/${action.id}/advance`, { target: 'DONE' }, [200, 201]);
  record('S15.2 IN_PROGRESS -> DONE con evidencia', action?.status === 'DONE');

  record(
    'S15.2 verify CORRECTIVE sin causa raiz rechazado',
    await expectStatus('POST', `/actions/${action.id}/verify`, { effectiveness: 'EFFECTIVE' }, 400),
  );

  action = await call('PATCH', `/actions/${action.id}`, { rootCause: `${MARK} falta de plan de purga` }, 200);

  action = await call('POST', `/actions/${action.id}/verify`, { effectiveness: 'EFFECTIVE', result: `${MARK} fuga reparada` }, [200, 201]);
  record(
    'S15.2 verify sella eficacia + verificador',
    action?.status === 'VERIFIED' && action?.effectiveness === 'EFFECTIVE' && Boolean(action?.verifiedAt) && Boolean(action?.closedAt),
    `verifiedAt=${action?.verifiedAt ?? '?'}`,
  );

  record(
    'S15.2 cancelar VERIFIED rechazado',
    await expectStatus('PATCH', `/actions/${action.id}`, { status: 'CANCELLED' }, 400),
  );

  // ===== Regla CRITICAL: verificador distinto del responsable =====
  let criticalAction = await call('POST', '/actions', {
    title: `${MARK} accion critica S15.2`,
    description: 'Accion derivada de hallazgo critico',
    kind: 'CORRECTIVE',
    sourceType: 'FINDING',
    sourceId: findingCritical.id,
    ownerId: adminId,
    rootCause: `${MARK} causa raiz del hallazgo critico`,
    dueDate,
    companyId,
  });
  record('S15.2 accion CRITICAL creada con responsable', Boolean(criticalAction?.id), `id=${criticalAction?.id}`);

  await call('POST', `/actions/${criticalAction.id}/advance`, { target: 'IN_PROGRESS' }, [200, 201]);
  criticalAction = await call('PATCH', `/actions/${criticalAction.id}`, { evidenceId: document.id }, 200);
  criticalAction = await call('POST', `/actions/${criticalAction.id}/advance`, { target: 'DONE' }, [200, 201]);
  record('S15.2 accion CRITICAL en DONE', criticalAction?.status === 'DONE');

  record(
    'S15.2 CRITICAL: responsable no puede verificarse a si mismo',
    await expectStatus('POST', `/actions/${criticalAction.id}/verify`, { effectiveness: 'EFFECTIVE' }, 400),
  );

  criticalAction = await call(
    'POST',
    `/actions/${criticalAction.id}/verify`,
    { effectiveness: 'INEFFECTIVE', result: `${MARK} requiere nueva accion` },
    [200, 201],
    tokenSst,
  );
  record(
    'S15.2 CRITICAL: verificador distinto verifica (INEFFECTIVE)',
    criticalAction?.status === 'VERIFIED' && criticalAction?.effectiveness === 'INEFFECTIVE',
  );

  // ===== PREVENTIVE con guarda de beneficio esperado =====
  let preventive = await call('POST', '/actions', {
    title: `${MARK} accion preventiva S15.2`,
    description: 'Reforzar capacitacion antes de temporada alta',
    kind: 'PREVENTIVE',
    dueDate,
    companyId,
  });
  record('S15.2 PREVENTIVE creada sin origen', preventive?.kind === 'PREVENTIVE', `id=${preventive?.id}`);

  await call('POST', `/actions/${preventive.id}/advance`, { target: 'IN_PROGRESS' }, [200, 201]);
  preventive = await call('PATCH', `/actions/${preventive.id}`, { evidenceId: document.id }, 200);
  preventive = await call('POST', `/actions/${preventive.id}/advance`, { target: 'DONE' }, [200, 201]);

  record(
    'S15.2 verify PREVENTIVE sin beneficio rechazado',
    await expectStatus('POST', `/actions/${preventive.id}/verify`, { effectiveness: 'EFFECTIVE' }, 400),
  );

  preventive = await call('PATCH', `/actions/${preventive.id}`, { expectedBenefit: `${MARK} menos incidentes en temporada` }, 200);
  preventive = await call('POST', `/actions/${preventive.id}/verify`, { effectiveness: 'EFFECTIVE' }, [200, 201]);
  record('S15.2 verify PREVENTIVE con beneficio', preventive?.status === 'VERIFIED');

  // ===== Cancelacion =====
  const cancelable = await call('POST', '/actions', {
    title: `${MARK} accion cancelable S15.2`,
    description: 'Se cancela desde OPEN',
    kind: 'IMPROVEMENT',
    expectedBenefit: `${MARK} mejora de senalizacion`,
    dueDate,
    companyId,
  });
  const cancelled = await call('PATCH', `/actions/${cancelable.id}`, { status: 'CANCELLED' }, 200);
  record(
    'S15.2 CANCELLED desde OPEN sella closedAt',
    cancelled?.status === 'CANCELLED' && Boolean(cancelled?.closedAt),
  );

  // ===== Limpieza =====
  const cleanup = [
    () => call('DELETE', `/actions/${action.id}`, undefined, [200, 204]),
    () => call('DELETE', `/actions/${criticalAction.id}`, undefined, [200, 204]),
    () => call('DELETE', `/actions/${preventive.id}`, undefined, [200, 204]),
    () => call('DELETE', `/actions/${cancelable.id}`, undefined, [200, 204]),
    () => call('DELETE', `/findings/${findingMajor.id}`, undefined, [200, 204]),
    () => call('DELETE', `/findings/${findingCritical.id}`, undefined, [200, 204]),
    () => call('DELETE', `/documents/${document.id}`, undefined, [200, 204, 405]),
  ];
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
console.log(`\n== Smoke S15.2: ${results.length - failed.length}/${results.length} pasos OK ==`);
process.exit(failed.length > 0 ? 1 : 0);
