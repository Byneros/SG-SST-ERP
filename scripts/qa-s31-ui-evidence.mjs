export default async function run(page, ui) {
  const API = 'http://localhost:3002/api/v1';
  const B_EMP = '8cacd66d-098a-4c7b-adc4-5e7843d09d40';
  const B_SITE = '07110e0c-09c3-42e4-ac57-ff1f808aa18f';
  const B_TRAINING = 'b6bcdef9-69ee-478d-82e3-e9b007bc2ab8';
  const B_COMPANY = '8a90bd95-f3b9-404b-8174-fa32a0aaa3aa';
  const out = {};

  // Login como Admin A (empresa A).
  await page.goto('http://localhost:5176/#/login');
  await page.waitForTimeout(1500);
  let snap = await ui.snapshot();
  const fields = [...snap.matchAll(/@(e\d+) (?:textbox|spinbutton)[^\n]*/g)].map((m) => m[1]);
  const loginBtn = snap.match(/@(e\d+) button[^\n]*(?:Iniciar|Login|Entrar|Ingresar)/i)?.[1];
  if (fields.length < 2 || !loginBtn) return { error: 'login form no encontrado', snap };

  await ui.fill(fields[0], 'admin-a@demo.com');
  await ui.fill(fields[1], 'Admin12345');
  await ui.click(loginBtn);
  await page.waitForTimeout(2500);
  out.loggedIn = /dashboard|panel|inicio/i.test(await ui.snapshot({ full: true }));

  // Recuperar el token que la UI guarda (misma fuente que usa el cliente API).
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
  if (!token) return { ...out, error: 'token no encontrado en storage' };

  // P1–P4 desde el origin de la UI (equivalente a la Network tab del runbook).
  const probe = async (method, path, body) => {
    return page.evaluate(async ({ API, method, path, body, token }) => {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = null;
      try { data = await res.json(); } catch { data = null; }
      const leak = data ? JSON.stringify(data).includes('ISO-B') || JSON.stringify(data).includes('Trabajador 1B') : false;
      return { status: res.status, leak };
    }, { API, method, path, body, token });
  };

  out.p1_getEmpleadoB = await probe('GET', `/employees/${B_EMP}`);
  out.p1_listFiltroCompanyIdB = await probe('GET', `/employees?companyId=${B_COMPANY}`);
  out.p2_getSedeB = await probe('GET', `/sites/${B_SITE}`);
  out.p2_patchSedeB = await probe('PATCH', `/sites/${B_SITE}`, { name: 'intruso' });
  out.p3_patchEmpleadoB = await probe('PATCH', `/employees/${B_EMP}`, { position: 'hacked' });
  out.p3_deleteCapacitacionB = await probe('DELETE', `/trainings/${B_TRAINING}`);
  out.p4_postRiskCompanyIdB = await probe('POST', '/risks', { name: 'intruso', companyId: B_COMPANY, hazard: 'X', level: 'BAJO' });
  out.p4_getIncidentsCompanyIdB = await probe('GET', `/incidents?companyId=${B_COMPANY}`);

  // Listado visible para A: solo empleados de A.
  await page.goto('http://localhost:5176/#/employees');
  await page.waitForTimeout(2500);
  const tree = await ui.snapshot({ full: true });
  out.employeesPageMuestraA = tree.includes('Trabajador 1A');
  out.employeesPageSinB = !tree.includes('Trabajador 1B');
  await page.screenshot({ path: 'scripts/qa-artifacts/s31-ui-empleados-A.png', fullPage: true });

  return out;
}
