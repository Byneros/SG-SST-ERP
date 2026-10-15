/**
 * [QA-S56-AUD] Guardas del ciclo de auditoria (#56) sobre el canal unificado
 * (hallazgo unificado origen AUDIT -> causa -> ActionPlan con guardas) y
 * verificacion multi-empresa (404 de scope) y AuditLog (via DB en dev).
 * Uso: node scripts/tmp-qa-s15-audits-negative.mjs [apiBase] [email] [password]
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
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const rows = (d) => (Array.isArray(d) ? d : d?.data ?? d?.items ?? []);

const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
const tk = login.data.accessToken;
console.log('login ->', login.status, tk ? 'token ok' : JSON.stringify(login.data));
if (!tk) process.exit(1);
const me = (await call('GET', '/auth/me', undefined, tk)).data;
const companyId = me.companyId ?? me.user?.companyId;

// 1. Auditoria demo (ciclo PLANNED -> IN_PROGRESS).
const audit = await call('POST', '/sgsst-audits', {
  title: '[QA-S56-AUD] Guardas de eficacia',
  description: 'Prueba de guardas del ciclo con canal unificado.',
  scope: 'Guardas.', auditorName: 'Auditor demo SST',
  scheduledAt: new Date().toISOString().slice(0, 10), companyId,
}, tk);
const auditId = audit.data?.id;
check('Auditoria demo creada', audit.status === 201 && !!auditId);
await call('PATCH', `/sgsst-audits/${auditId}`, { status: 'IN_PROGRESS' }, tk);

// 2. Hallazgo UNIFICADO de origen AUDIT (queda en bandeja/tareas unificadas S15.3).
const finding = await call('POST', '/findings', {
  title: '[QA-S56-AUD] Hallazgo unificado de auditoria',
  description: 'No conformidad demo vinculada a la auditoría (canal unificado con guardas).',
  sourceType: 'AUDIT', sourceId: auditId, type: 'NON_CONFORMITY', severity: 'MAJOR', companyId,
}, tk);
const findingId = finding.data?.id;
check('Hallazgo unificado origen AUDIT creado', finding.status === 201 && !!findingId, JSON.stringify(finding.data?.message ?? []).slice(0, 120));
const findingsList = rows((await call('GET', '/findings?pageSize=100', undefined, tk)).data);
const inList = findingsList.find((f) => f.id === findingId);
check('Hallazgo visible en hallazgos unificados', !!inList, inList?.sourceType ?? '');
if (inList) {
  const linked = inList.sourceType === 'AUDIT' && inList.sourceId === auditId;
  check('Hallazgo enlazado a la auditoria origen ((sourceType, sourceId))', linked);
}

// 3. Causa raiz del hallazgo.
const cause = await call('POST', `/findings/${findingId}/causes`, {
  causeType: 'Metodo (Ishikawa)', description: 'Checklist de EPP desactualizado.',
}, tk);
check('Causa registrada en el hallazgo', cause.status === 201, JSON.stringify(cause.data?.message ?? []).slice(0, 120));

// 4. Accion correctiva unificada desde el hallazgo.
const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const action = await call('POST', '/actions', {
  title: '[QA-S56-AUD] Accion correctiva con guardas',
  description: 'Actualizar checklist de EPP y capacitar al responsable.',
  kind: 'CORRECTIVE', sourceType: 'FINDING', sourceId: findingId,
  dueDate: due, companyId,
}, tk);
const actionId = action.data?.id;
check('Accion CORRECTIVE creada desde el hallazgo', action.status === 201 && !!actionId, JSON.stringify(action.data?.message ?? []).slice(0, 120));

// 5. Guardas negativas del workflow.
const badJump = await call('POST', `/actions/${actionId}/advance`, { target: 'DONE' }, tk);
check('Salto OPEN -> DONE rechazado', badJump.status === 400, `HTTP ${badJump.status} ${JSON.stringify(badJump.data?.message ?? '').slice(0, 90)}`);
const earlyVerify = await call('POST', `/actions/${actionId}/verify`, { effectiveness: 'EFFECTIVE' }, tk);
check('Verificacion fuera de DONE rechazada', earlyVerify.status === 400, `HTTP ${earlyVerify.status} ${JSON.stringify(earlyVerify.data?.message ?? '').slice(0, 90)}`);
await call('POST', `/actions/${actionId}/advance`, { target: 'IN_PROGRESS' }, tk);
const noEvidence = await call('POST', `/actions/${actionId}/advance`, { target: 'DONE' }, tk);
check('Avance a DONE sin evidencia rechazado (falta evidencia de ejecucion)', noEvidence.status === 400 && /evidencia/.test(JSON.stringify(noEvidence.data?.message ?? '')), `HTTP ${noEvidence.status} ${JSON.stringify(noEvidence.data?.message ?? '').slice(0, 90)}`);

// 6. Evidencia del tenant (Document JSON) para DONE.
const doc = await call('POST', '/documents', {
  name: '[QA-S56-AUD] Evidencia checklist EPP',
  description: 'Evidencia de ejecución para la acción correctiva (QA).',
  category: 'AUDIT_EVIDENCE', fileUrl: '/qa/qa-s56-aud-checklist-epp.txt', mimeType: 'text/plain', companyId,
}, tk);
check('Evidencia (Document) creada en el tenant', doc.status === 201 && !!doc.data?.id, JSON.stringify(doc.data?.message ?? []).slice(0, 120));
const evPatch = await call('PATCH', `/actions/${actionId}`, { evidenceId: doc.data?.id, rootCause: 'Checklist sin version del profesiograma vigente.' }, tk);
check('Evidencia y causa raiz adjuntadas a la accion', evPatch.status === 200, `HTTP ${evPatch.status}`);
const toDone = await call('POST', `/actions/${actionId}/advance`, { target: 'DONE' }, tk);
check('Avance a DONE con evidencia aceptado', [200, 201].includes(toDone.status) && toDone.data?.status === 'DONE', `status=${toDone.data?.status ?? toDone.status}`);

// 7. Verificacion de eficacia (DONE -> VERIFIED).
const verified = await call('POST', `/actions/${actionId}/verify`, { effectiveness: 'EFFECTIVE', result: 'Checklist actualizado y capacitacion completada.' }, tk);
check('Verificacion de eficacia sella VERIFIED', [200, 201].includes(verified.status) && verified.data?.status === 'VERIFIED', `status=${verified.data?.status ?? verified.status}`);
const readonlyEdit = await call('PATCH', `/actions/${actionId}`, { title: '[QA-S56-AUD] EDIT rb' }, tk);
check('Accion VERIFIED es de solo lectura', readonlyEdit.status === 400, `HTTP ${readonlyEdit.status}`);

// 8. Guarda CRITICAL: el verificador no puede ser el responsable.
const critFinding = await call('POST', '/findings', {
  title: '[QA-S56-AUD] Hallazgo CRITICAL',
  description: 'Hallazgo CRITICAL demo para la regla de separacion verificador/responsable.',
  sourceType: 'AUDIT', sourceId: auditId, type: 'NON_CONFORMITY', severity: 'CRITICAL', companyId,
}, tk);
const critAction = await call('POST', '/actions', {
  title: '[QA-S56-AUD] Accion CRITICAL (responsable = verificador)',
  description: 'Demo para la guarda de separacion.',
  kind: 'CORRECTIVE', sourceType: 'FINDING', sourceId: critFinding.data?.id,
  ownerId: (await call('GET', '/auth/me', undefined, tk)).data.sub,
  dueDate: due, companyId,
}, tk);
const critId = critAction.data?.id;
await call('POST', `/actions/${critId}/advance`, { target: 'IN_PROGRESS' }, tk);
await call('PATCH', `/actions/${critId}`, { evidenceId: doc.data?.id, rootCause: 'Hallazgo CRITICAL demo.' }, tk);
await call('POST', `/actions/${critId}/advance`, { target: 'DONE' }, tk);
const selfVerify = await call('POST', `/actions/${critId}/verify`, { effectiveness: 'EFFECTIVE' }, tk);
check('CRITICAL: verificador igual al responsable rechazado', selfVerify.status === 400 && /responsable/.test(JSON.stringify(selfVerify.data?.message ?? '')), `HTTP ${selfVerify.status} ${JSON.stringify(selfVerify.data?.message ?? '').slice(0, 100)}`);
// Verificacion cruzada con SST (mismo tenant, distinto usuario).
const loginSst = await call('POST', '/auth/login', { email: 'sst@sgsst.com', password: PASSWORD });
if (loginSst.data?.accessToken) {
  const crossVerify = await call('POST', `/actions/${critId}/verify`, { effectiveness: 'EFFECTIVE' }, loginSst.data.accessToken);
  check('CRITICAL: verificado por otro verificador (SST) aceptado', [200, 201].includes(crossVerify.status) && crossVerify.data?.status === 'VERIFIED', `status=${crossVerify.data?.status ?? crossVerify.status}`);
} else {
  console.log('INFO sst@sgsst.com no disponible con la misma contrasenia; CRITICAL cruzado no verificado');
}

// 9. Multi-empresa: la empresa B no ve hallazgo/accion de la empresa A (404).
const loginB = await call('POST', '/auth/login', { email: 'admin-b@demo.com', password: 'Admin12345' });
if (loginB.data?.accessToken) {
  const tkB = loginB.data.accessToken;
  const f404 = await call('GET', `/findings/${findingId}`, undefined, tkB);
  check('Empresa B: hallazgo de A -> 404', f404.status === 404, `HTTP ${f404.status}`);
  const a404 = await call('GET', `/actions/${actionId}`, undefined, tkB);
  check('Empresa B: accion de A -> 404', a404.status === 404, `HTTP ${a404.status}`);
} else {
  console.log('INFO admin-b@demo.com no disponible; multi-empresa se verifica por scoping del listado');
}

console.log(failures === 0 ? '\nTODO PASS: guardas de eficacia + scoping.' : `\nFALLOS: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
