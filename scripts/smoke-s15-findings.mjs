#!/usr/bin/env node
/**
 * Smoke test S15.1 (hallazgos unificados) contra la API dev.
 *
 * Valida via HTTP real (#40):
 * - Hallazgo MANUAL y hallazgo con origen trazable (inspeccion reactiva).
 * - Origen sin sourceId rechazado y origen ajeno/inexistente rechazado (404).
 * - Causas: alta, rechazo sobre hallazgo cerrado y baja.
 * - Ciclo de estado OPEN -> IN_PROGRESS -> CLOSED con sello de cierre.
 *
 * Limpieza: elimina los recursos marcados [SMOKE] que creo.
 *
 * Uso: node scripts/smoke-s15-findings.mjs [apiBase] [email] [password]
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

async function expectStatus(method, path, body, status) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response.status === status;
}

async function main() {
  // 0. Login
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, [200, 201]);
  token = login.accessToken ?? login.access_token;
  record('S0 login', Boolean(token));

  const me = await call('GET', '/auth/me', undefined, 200);
  const companyId = me.companyId ?? me.user?.companyId;
  record('S0 auth/me', Boolean(companyId), `company=${companyId}`);

  // ===== Recurso de origen: inspeccion no planeada =====
  const inspection = await call('POST', '/unplanned-inspections', {
    title: `${MARK} inspeccion origen smoke S15.1`,
    reason: 'prueba de smoke S15.1',
    executedAt: new Date().toISOString(),
    companyId,
  });
  record('S15 origen (inspeccion reactiva) creado', Boolean(inspection?.id), `id=${inspection?.id}`);

  // ===== Hallazgo con origen trazable =====
  let finding = await call('POST', '/findings', {
    title: `${MARK} hallazgo smoke S15.1`,
    description: 'No conformidad con origen en inspeccion reactiva',
    sourceType: 'INSPECTION_UNPLANNED',
    sourceId: inspection.id,
    severity: 'MAJOR',
    companyId,
  });
  record('S15 hallazgo con origen creado', finding?.status === 'OPEN', `id=${finding?.id}`);

  record(
    'S15 origen sin sourceId rechazado',
    await expectStatus('POST', '/findings', {
      title: `${MARK} sin origen`,
      description: 'debe fallar por falta de sourceId',
      sourceType: 'INSPECTION_PLANNED',
      companyId,
    }, 400),
  );

  record(
    'S15 origen inexistente rechazado (404)',
    await expectStatus('POST', '/findings', {
      title: `${MARK} origen falso`,
      description: 'debe fallar por sourceId inexistente',
      sourceType: 'INSPECTION_UNPLANNED',
      sourceId: '00000000-0000-4000-8000-000000000000',
      companyId,
    }, 404),
  );

  // ===== Causas =====
  const cause = await call('POST', `/findings/${finding.id}/causes`, {
    causeType: 'Mantencion',
    description: `${MARK} causa smoke S15.1: falta de plan de purga`,
  });
  record('S15 causa registrada', Boolean(cause?.id), `id=${cause?.id}`);

  // ===== Ciclo de estado con sello de cierre =====
  finding = await call('PATCH', `/findings/${finding.id}`, { status: 'IN_PROGRESS' }, 200);
  record('S15 estado IN_PROGRESS', finding?.status === 'IN_PROGRESS');

  finding = await call('PATCH', `/findings/${finding.id}`, { status: 'CLOSED' }, 200);
  record(
    'S15 estado CLOSED sella closedAt',
    finding?.status === 'CLOSED' && Boolean(finding?.closedAt),
    `closedAt=${finding?.closedAt ?? '?'}`,
  );

  record(
    'S15 causa sobre hallazgo cerrado rechazada',
    await expectStatus('POST', `/findings/${finding.id}/causes`, {
      causeType: 'Tarde',
      description: 'debe fallar: hallazgo cerrado',
    }, 400),
  );

  // ===== Listado con filtros =====
  const list = await call(
    'GET',
    `/findings?search=hallazgo%20smoke%20S15.1&severity=MAJOR&status=CLOSED`,
    undefined,
    200,
  );
  const rows = list.data ?? [];
  record(
    'S15 listado con filtros encuentra el hallazgo',
    rows.some((f) => f.id === finding.id),
    `total=${list.meta?.total ?? rows.length}`,
  );

  // ===== Hallazgo MANUAL + causas y borrado en cascada =====
  const manual = await call('POST', '/findings', {
    title: `${MARK} hallazgo manual smoke S15.1`,
    description: 'Hallazgo manual para validar causas y borrado',
    sourceType: 'MANUAL',
    type: 'OBSERVATION',
    severity: 'MINOR',
    companyId,
  });
  record('S15 hallazgo MANUAL creado', manual?.sourceType === 'MANUAL', `id=${manual?.id}`);

  const manualCause = await call('POST', `/findings/${manual.id}/causes`, {
    causeType: 'Metodo',
    description: `${MARK} causa manual smoke S15.1`,
  });

  const causeRemoved = await call(
    'DELETE',
    `/findings/${manual.id}/causes/${manualCause.id}`,
    undefined,
    [200, 204],
  );
  record(
    'S15 causa eliminada',
    causeRemoved?.deleted === true || causeRemoved === null || causeRemoved === undefined || causeRemoved?.id === manualCause.id,
  );

  // ===== Limpieza =====
  const cleanup = [
    () => call('DELETE', `/findings/${finding.id}`, undefined, [200, 204]),
    () => call('DELETE', `/findings/${manual.id}`, undefined, [200, 204]),
    () => call('DELETE', `/unplanned-inspections/${inspection.id}`, undefined, [200, 204]),
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
console.log(`\n== Smoke S15.1: ${results.length - failed.length}/${results.length} pasos OK ==`);
process.exit(failed.length > 0 ? 1 : 0);
