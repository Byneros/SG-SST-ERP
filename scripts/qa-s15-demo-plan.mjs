/**
 * [QA-S15] Siembra plan anual de trabajo demo (plan + 2 actividades PHVA)
 * para la corrida de aceptacion de reportes #55. Log: qa-artifacts.
 * Uso: node scripts/tmp-qa-s15-demo-plan.mjs [apiBase] [email] [password]
 */
const API = process.argv[2] ?? 'http://localhost:3002/api/v1';
const EMAIL = process.argv[3] ?? 'admin@sgsst.com';
const PASSWORD = process.argv[4] ?? '';
const MARK = '[QA-S15]';

const login = await (await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})).json();
const tk = login.accessToken;
if (!tk) { console.error('FAIL login'); process.exit(1); }
const me = await (await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${tk}` } })).json();
const companyId = me.companyId ?? me.user?.companyId;
console.log('empresa', companyId);

const post = async (p, b) => {
  const r = await fetch(`${API}${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
    body: JSON.stringify(b),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
};

let plan = await post('/annual-work-plans', {
  year: 2026, status: 'IN_PROGRESS', companyId, notes: `${MARK} plan demo para QA reportes`,
});
if (!plan.data?.id) {
  const existing = (await (await fetch(`${API}/annual-work-plans`, { headers: { Authorization: `Bearer ${tk}` } })).json());
  const plans = Array.isArray(existing) ? existing : existing.data ?? existing.items ?? [];
  plan.data = plans.find((p) => p.year === 2026 ?? p.year === 2026);
}
console.log('plan', plan.status, plan.data?.id ?? JSON.stringify(plan.data).slice(0, 160));
if (!plan.data?.id) process.exit(1);
const pid = plan.data.id;

const mkAct = (extra) => ({ planId: pid, companyId, ...extra });
const a1 = await post(`/annual-work-plans/${pid}/activities`, mkAct({
  name: `${MARK} Actividad PHVA Planear demo`, cycle: 'PLANEAR', frequency: 'Mensual',
  dueDate: '2026-11-30', progress: 40, status: 'IN_PROGRESS',
}));
const a2 = await post(`/annual-work-plans/${pid}/activities`, mkAct({
  name: `${MARK} Actividad PHVA Hacer demo`, cycle: 'HACER', frequency: 'Anual',
  dueDate: '2026-12-15', progress: 10,
}));
console.log('act1', a1.status, a1.data?.id ?? JSON.stringify(a1.data).slice(0, 200));
console.log('act2', a2.status, a2.data?.id ?? JSON.stringify(a2.data).slice(0, 200));
