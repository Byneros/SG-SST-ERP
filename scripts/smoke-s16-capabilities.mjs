#!/usr/bin/env node
/**
 * Smoke test S16: capabilities del asistente por rol, contra la API dev.
 *
 * Valida via HTTP real (pendiente tecnico unico del cierre S16):
 * - El registro expone los 13 asistentes (central + 12 especializados) a
 *   los roles gestion (ADMIN, SST): mismos ids, mismos modulos.
 * - EMPLOYEE queda fuera del endpoint por el guard de roles (403), sin
 *   revelar el listado de asistentes.
 * - Invocacion sin token responde 401 (JWT guard).
 * - La respuesta mantiene el contrato de fase 1 (enabled, roles, dataTools,
 *   helpTopics, limits) ademas del campo `assistants` de fase L.
 *
 * Los usuarios no-ADMIN se crean via POST /users por corrida (prefijo
 * s16cap-, password de QA) y se eliminan al final (DELETE /users/:id).
 *
 * Uso: node scripts/smoke-s16-capabilities.mjs [apiBase] [adminEmail] [password]
 */

const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const ADMIN_EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD =
  process.argv[4] ?? process.env.QA_PASS ?? process.env.SEED_ADMIN_PASSWORD ?? '';

// Registro esperado (assistant-registry.ts): 1 central + 12 especializados.
const EXPECTED_ASSISTANTS = [
  { id: 'central', module: 'dashboard' },
  { id: 'risks', module: 'risks' },
  { id: 'incidents', module: 'incidents' },
  { id: 'findings', module: 'findings' },
  { id: 'trainings', module: 'trainings' },
  { id: 'medical', module: 'medical' },
  { id: 'ppe', module: 'ppe' },
  { id: 'contractors', module: 'contractors' },
  { id: 'committees', module: 'committees' },
  { id: 'emergency', module: 'emergency' },
  { id: 'audit', module: 'sgsst-audits' },
  { id: 'indicators', module: 'indicators' },
  { id: 'documents', module: 'documents' },
];

const results = [];
const createdUsers = []; // { id, email } para limpieza
let token = null;

function record(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, body, bearer = token) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text.slice(0, 200);
  }
  return { status: response.status, payload };
}

async function loginAs(email, password) {
  return call('POST', '/auth/login', { email, password }, null);
}

function accessToken(payload) {
  return payload?.accessToken ?? payload?.access_token ?? null;
}

function idsOf(capabilities) {
  return (capabilities?.assistants ?? []).map((a) => a.id);
}

/** Crea un usuario rol QA y registra su id para limpieza. */
async function createRoleUser(role, companyId) {
  const stamp = Date.now();
  const email = `s16cap-${role.toLowerCase()}-${stamp}@demo.com`;
  const created = await call('POST', '/users', {
    name: `QA S16 ${role}`,
    email,
    password: PASSWORD,
    role,
    companyId,
  });
  if (created.status !== 201 && created.status !== 200) {
    throw new Error(
      `POST /users (${role}) -> HTTP ${created.status}: ${JSON.stringify(created.payload).slice(0, 200)}`,
    );
  }
  const id = created.payload?.id ?? created.payload?.user?.id;
  createdUsers.push({ id, email });
  return { email, id };
}

async function main() {
  if (!PASSWORD) {
    console.error(
      'Sin password: pase argv[4], o exporte QA_PASS / SEED_ADMIN_PASSWORD',
    );
    process.exit(1);
  }

  try {
    // S1. Logins por rol
    const admin = await loginAs(ADMIN_EMAIL, PASSWORD);
    record('S1 login ADMIN', admin.status === 200 || admin.status === 201);
    token = accessToken(admin.payload);

    // El scope multi-tenant exige companyId explicito al crear usuarios.
    const me = await call('GET', '/auth/me');
    const companyId = me.payload?.companyId ?? me.payload?.user?.companyId;
    record('S1 auth/me (companyId del scope)', Boolean(companyId), `company=${companyId}`);

    const sstUser = await createRoleUser('SST', companyId);
    const sstLogin = await loginAs(sstUser.email, PASSWORD);
    record('S1 login SST (creado por corrida)', sstLogin.status === 201 || sstLogin.status === 200);
    const sstToken = accessToken(sstLogin.payload);

    const empUser = await createRoleUser('EMPLOYEE', companyId);
    const empLogin = await loginAs(empUser.email, PASSWORD);
    record('S1 login EMPLOYEE (creado por corrida)', empLogin.status === 201 || empLogin.status === 200);
    const empToken = accessToken(empLogin.payload);

    // S2. capabilities para roles de gestion: los 13 asistentes del registro
    for (const [role, bearer] of [['ADMIN', token], ['SST', sstToken]]) {
      const res = await call('GET', '/ai-assistant/capabilities', undefined, bearer);
      record(`S2 capabilities ${role} -> 200`, res.status === 200);
      const ids = idsOf(res.payload);
      const expectedIds = EXPECTED_ASSISTANTS.map((a) => a.id);
      const sameOrder = JSON.stringify(ids) === JSON.stringify(expectedIds);
      record(`S2 ${role}: 13 asistentes en orden del registro`, sameOrder, `ids=${ids.join(',')}`);
      const modulesOk = EXPECTED_ASSISTANTS.every(
        (a, i) => res.payload?.assistants?.[i]?.module === a.module,
      );
      record(`S2 ${role}: modulo de cada asistente`, modulesOk);
      const contractOk =
        typeof res.payload?.enabled === 'boolean' &&
        Array.isArray(res.payload?.roles) &&
        Array.isArray(res.payload?.dataTools) &&
        Array.isArray(res.payload?.helpTopics) &&
        res.payload?.limits?.maxMessageLength === 4000;
      record(`S2 ${role}: contrato fase 1 intacto (enabled/roles/dataTools/helpTopics/limits)`, contractOk);
      const roleOk = res.payload?.roles?.includes(role);
      record(`S2 ${role}: rol incluido en ASSISTANT_ALLOWED_ROLES`, Boolean(roleOk));
    }

    // S3. EMPLOYEE: 403 por guard (controller), sin revelar asistentes
    const emp = await call('GET', '/ai-assistant/capabilities', undefined, empToken);
    record('S3 capabilities EMPLOYEE -> 403', emp.status === 403);

    // S4. Sin token: 401
    const anon = await call('GET', '/ai-assistant/capabilities', undefined, null);
    record('S4 capabilities sin token -> 401', anon.status === 401);
  } finally {
    // Limpieza: elimina los usuarios s16cap- creados por esta corrida.
    for (const user of createdUsers) {
      const removed = await call('DELETE', `/users/${user.id}`);
      console.log(
        `LIMPIEZA DELETE /users/${user.id} (${user.email}) -> HTTP ${removed.status}`,
      );
    }
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} PASS`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR inesperado:', error.message);
  process.exit(1);
});
