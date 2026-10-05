#!/usr/bin/env node
/**
 * Smoke test S14 (gestion del cambio) contra la API dev.
 *
 * Valida via HTTP real el workflow completo (#38/#39):
 * - Solicitud con riesgo de la matriz (evaluacion obligatoria).
 * - Avance etapa por etapa con guardas: cada 400 por dato faltante se prueba
 *   antes de completar el dato y avanzar.
 * - Sello de aprobador al pasar a IMPLEMENTATION y cierre con verificacion.
 * - Rechazo de saltos de etapa y de avances sobre un workflow cerrado.
 *
 * Limpieza: elimina los recursos marcados [SMOKE] que creo.
 *
 * Uso: node scripts/smoke-s14.mjs [apiBase] [email] [password]
 * Por defecto: http://localhost:3002/api/v1 admin@sgsst.com (password via env
 * SEED_ADMIN_PASSWORD del .env local, o argumento).
 */

const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD =
  process.argv[4] ??
  process.env.QA_PASS ??
  process.env.SEED_ADMIN_PASSWORD ??
  '';
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

/** Espera un 400 y (opcional) que el mensaje mencione el texto dado. */
async function expect400(method, path, body, mustMention = null) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status !== 400) return false;
  if (!mustMention) return true;
  const text = await response.text();
  return text.toLowerCase().includes(mustMention.toLowerCase());
}

async function main() {
  // 0. Login
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, [200, 201]);
  token = login.accessToken ?? login.access_token;
  record('S0 login', Boolean(token));

  const me = await call('GET', '/auth/me', undefined, 200);
  const companyId = me.companyId ?? me.user?.companyId;
  record('S0 auth/me', Boolean(companyId), `company=${companyId}`);

  // ===== Recursos base: riesgo de la matriz y documento de evidencia =====
  const risk = await call('POST', '/risks', {
    title: `${MARK} riesgo smoke S14`,
    level: 'MEDIUM',
    description: 'Riesgo creado por el smoke del workflow S14',
    companyId,
  });
  record('S14 riesgo de la matriz creado', Boolean(risk?.id), `risk=${risk?.id}`);

  // ===== S14.1: solicitud con evaluacion de riesgos obligatoria =====
  let change = await call('POST', '/change-requests', {
    title: `${MARK} cambio smoke S14`,
    reason: 'Prueba de smoke del workflow de gestion del cambio',
    process: 'Operaciones',
    responsible: 'Smoke Responsable',
    riskId: risk.id,
    companyId,
  });
  record('S14.1 solicitud creada (REQUESTED)', change?.status === 'REQUESTED', `id=${change?.id}`);

  // Sin riesgo no se puede crear (400 de validacion del DTO).
  record(
    'S14.1 solicitud sin riesgo rechazada',
    await expect400('POST', '/change-requests', {
      title: `${MARK} cambio sin riesgo`,
      reason: 'debe fallar',
      process: 'Operaciones',
      responsible: 'Smoke',
      companyId,
    }),
  );

  // ===== S14.2: guardas y avance etapa por etapa =====
  record(
    'S14.2 salto REQUESTED->CONTROLS rechazado',
    await expect400('POST', `/change-requests/${change.id}/advance`, { target: 'CONTROLS' }, 'transicion'),
  );

  const toEvaluation = await call(
    'POST',
    `/change-requests/${change.id}/advance`,
    { target: 'EVALUATION' },
    [200, 201],
  );
  record('S14.2 REQUESTED->EVALUATION', toEvaluation?.status === 'EVALUATION');

  record(
    'S14.2 guard EVALUATION sin peligros/impactos',
    await expect400(
      'POST',
      `/change-requests/${change.id}/advance`,
      { target: 'CONTROLS' },
      'peligros',
    ),
  );

  change = await call(
    'PATCH',
    `/change-requests/${change.id}`,
    {
      hazards: `${MARK} peligro smoke S14: cambio de sustancia quimica`,
      impacts: `${MARK} impacto smoke S14: exposicion dermica`,
    },
    200,
  );
  const toControls = await call(
    'POST',
    `/change-requests/${change.id}/advance`,
    { target: 'CONTROLS' },
    [200, 201],
  );
  record('S14.2 EVALUATION->CONTROLS con peligros e impactos', toControls?.status === 'CONTROLS');

  record(
    'S14.2 guard CONTROLS sin controles',
    await expect400('POST', `/change-requests/${change.id}/advance`, { target: 'APPROVAL' }, 'controles'),
  );

  change = await call(
    'PATCH',
    `/change-requests/${change.id}`,
    { controls: `${MARK} controles smoke S14: extraccion local y EPI` },
    200,
  );
  const toApproval = await call(
    'POST',
    `/change-requests/${change.id}/advance`,
    { target: 'APPROVAL' },
    [200, 201],
  );
  record('S14.2 CONTROLS->APPROVAL con controles', toApproval?.status === 'APPROVAL');

  const toImplementation = await call(
    'POST',
    `/change-requests/${change.id}/advance`,
    { target: 'IMPLEMENTATION' },
    [200, 201],
  );
  record(
    'S14.2 APPROVAL->IMPLEMENTATION sella aprobador',
    toImplementation?.status === 'IMPLEMENTATION' && Boolean(toImplementation?.approvedAt),
    `approvedAt=${toImplementation?.approvedAt ?? '?'}`,
  );

  record(
    'S14.2 guard IMPLEMENTATION sin evidencia',
    await expect400(
      'POST',
      `/change-requests/${change.id}/advance`,
      { target: 'VERIFICATION' },
      'evidencia',
    ),
  );

  const document = await call('POST', '/documents', {
    name: `${MARK} evidencia smoke S14`,
    fileUrl: '/smoke/s14-evidencia.pdf',
    category: 'OTHER',
    status: 'PUBLISHED',
    companyId,
  });
  record('S14.2 documento de evidencia creado', Boolean(document?.id), `doc=${document?.id}`);

  change = await call(
    'PATCH',
    `/change-requests/${change.id}`,
    { implementationEvidenceId: document.id },
    200,
  );
  const toVerification = await call(
    'POST',
    `/change-requests/${change.id}/advance`,
    { target: 'VERIFICATION' },
    [200, 201],
  );
  record('S14.2 IMPLEMENTATION->VERIFICATION con evidencia', toVerification?.status === 'VERIFICATION');

  record(
    'S14.2 guard VERIFICATION sin notas',
    await expect400(
      'POST',
      `/change-requests/${change.id}/advance`,
      { target: 'CLOSED' },
      'verificacion',
    ),
  );

  change = await call(
    'PATCH',
    `/change-requests/${change.id}`,
    { verificationNotes: `${MARK} verificacion smoke S14: controles instalados y verificados` },
    200,
  );
  const toClosed = await call(
    'POST',
    `/change-requests/${change.id}/advance`,
    { target: 'CLOSED' },
    [200, 201],
  );
  record('S14.2 VERIFICATION->CLOSED con notas', toClosed?.status === 'CLOSED');

  record(
    'S14.2 avance sobre workflow cerrado rechazado',
    await expect400(
      'POST',
      `/change-requests/${change.id}/advance`,
      { target: 'CLOSED' },
      'cerrado',
    ),
  );

  // ===== Limpieza =====
  const cleanup = [
    () => call('DELETE', `/change-requests/${change.id}`, undefined, [200, 204]),
    () => call('DELETE', `/documents/${document.id}`, undefined, [200, 204, 405]),
    () => call('DELETE', `/risks/${risk.id}`, undefined, [200, 204, 405]),
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
console.log(`\n== Smoke S14: ${results.length - failed.length}/${results.length} pasos OK ==`);
process.exit(failed.length > 0 ? 1 : 0);
