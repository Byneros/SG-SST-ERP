/**
 * Limpieza one-shot de residuos [SMOKE]/[QA S15.3]/[DIAG S15.3] (tareas y
 * hallazgos) en la empresa del admin. Uso: node scripts/cleanup-qa-s15.mjs
 */
const API = 'http://localhost:3002/api/v1';
const PASSWORD = process.env.QA_PASS ?? process.env.SEED_ADMIN_PASSWORD ?? '';
const MARKS = ['[SMOKE]', '[QA S15.3]', '[DIAG S15.3]'];

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@sgsst.com', password: PASSWORD }),
}).then((r) => r.json());
const token = login.accessToken ?? login.access_token;
const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const companyId = me.companyId ?? me.user?.companyId;
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

let removed = 0;
for (const resource of ['tasks', 'findings']) {
  const list = await fetch(`${API}/${resource}?pageSize=100`, { headers }).then((r) => r.json());
  for (const row of list.data ?? []) {
    if (MARKS.some((m) => (row.title ?? '').includes(m))) {
      const res = await fetch(`${API}/${resource}/${row.id}`, { method: 'DELETE', headers });
      console.log(`${res.status < 300 ? 'OK' : 'ERR'} ${resource} ${row.title}`);
      removed += 1;
    }
  }
}
console.log(`eliminados: ${removed}`);
