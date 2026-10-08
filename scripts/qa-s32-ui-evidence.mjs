export default async function run(page, ui) {
  const API = 'http://localhost:3002/api/v1';
  const B_COMPANY = '8a90bd95-f3b9-404b-8174-fa32a0aaa3aa';
  const out = {};

  // Login como el usuario recién creado por qa-s32-flow.mjs (el más reciente).
  // El script crea s32-<TS>@demo.com; buscar el último creado en el listado de
  // usuarios requeriría otro token, así que usamos el email conocido aquí.
  // Email fijo de la corrida de evidencia (creado por qa-s32-flow.mjs).
  const email = process.env.S32_EMAIL ?? 's32-1791415123165@demo.com';
  if (!email) return { error: 'S32_EMAIL no definido' };

  await page.goto('http://localhost:5176/#/login');
  await page.waitForTimeout(1500);
  const snap = await ui.snapshot();
  const fields = [...snap.matchAll(/@(e\d+) (?:textbox|spinbutton)[^\n]*/g)].map((m) => m[1]);
  const loginBtn = snap.match(/@(e\d+) button[^\n]*(?:Iniciar|Login|Entrar|Ingresar)/i)?.[1];
  if (fields.length < 2 || !loginBtn) return { error: 'login form no encontrado', snap };

  await ui.fill(fields[0], email);
  await ui.fill(fields[1], 'Admin12345');
  await ui.click(loginBtn);
  await page.waitForTimeout(2500);
  const tree = await ui.snapshot({ full: true });
  out.loggedIn = /dashboard|panel|inicio/i.test(tree);
  out.companiesModuleNoAparece = !/#\w*companies|Empresas \(multi\)/i.test(tree);

  const token = await page.evaluate(() => {
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        const v = store.getItem(k);
        try {
          const j = JSON.parse(v);
          const cand = j?.accessToken ?? j?.access_token ?? j?.state?.accessToken ?? j?.state?.access_token;
          if (typeof cand === 'string' && cand.length > 20) return cand;
          if (j?.state?.token && typeof j.state.token === 'string') return j.state.token;
        } catch {
          if (typeof v === 'string' && v.split('.').length === 3) return v;
        }
      }
    }
    return null;
  });
  out.tokenFound = Boolean(token);

  if (token) {
    const probe = await page.evaluate(async ({ API, B_COMPANY, OWN_COMPANY, token }) => {
      const res = await fetch(`${API}/employees?companyId=${B_COMPANY}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // P-A5 (runbook S3.2): GET /companies con sesion de empresa activa
      // solo devuelve su propia empresa (el scope filtra el listado).
      const companies = await fetch(`${API}/companies`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()).catch(() => null);
      const arr = companies ? (Array.isArray(companies) ? companies : companies.data ?? []) : null;
      return { status: res.status, companiesVisibles: arr?.map((c) => c.name) ?? ["http-error"] };
    }, { API, B_COMPANY, token });
    out.empresaAjena = probe;

    await page.goto('http://localhost:5176/#/employees');
    await page.waitForTimeout(2500);
    const empTree = await ui.snapshot({ full: true });
    out.employeesPageSola = empTree.includes('Usuario QA') || empTree.includes('Nuevo');
    out.employeesPageSinEmpresaB = !empTree.includes('Trabajador 1B') && !empTree.includes('Ref B');
    await page.screenshot({ path: 'scripts/qa-artifacts/s32-ui-empleado-nuevo.png', fullPage: true });
  }
  return out;
}
