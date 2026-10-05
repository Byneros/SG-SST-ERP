/**
 * Verificacion UI de S15.1 (hallazgos unificados) en navegador fresco.
 * Crea el hallazgo de prueba por API, recorre la vista y limpia al final.
 * Uso: QA_EMAIL/QA_PASS en env; node ~/.codegpt/skills/browser-automation/browser.mjs http://localhost:5176 --script scripts/qa-s15-findings-ui.mjs
 */
export default async function run(page, ui) {
  const out = { steps: [], consoleErrors: [] };
  page.on('pageerror', (err) => out.consoleErrors.push(String(err).slice(0, 200)));
  const bodyText = () => page.evaluate(() => document.body.innerText);

  // --- Preparacion por API: login + hallazgo [QA S15] ---
  const apiBase = 'http://localhost:3002/api/v1';
  const login = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.QA_EMAIL ?? 'admin@sgsst.com', password: process.env.QA_PASS ?? '' }),
  }).then((r) => r.json());
  const token = login.accessToken ?? login.access_token;
  if (!token) return { error: 'no api login' };
  const me = await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const companyId = me.companyId ?? me.user?.companyId;
  const finding = await fetch(`${apiBase}/findings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: '[QA S15] hallazgo UI',
      description: 'Hallazgo de verificacion UI S15.1',
      sourceType: 'MANUAL',
      severity: 'MAJOR',
      companyId,
    }),
  }).then((r) => r.json());
  out.steps.push({ step: 'api-setup', ok: Boolean(finding.id), findingId: finding.id ?? null });
  const findingId = finding.id;

  // Limpia la cache HTTP del navegador (nginx cachea index.html).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  out.steps.push({ step: 'cache-cleared', ok: true });

  // --- Login por formulario ---
  let emailRef = null;
  let passRef = null;
  for (let i = 0; i < 15 && !emailRef; i += 1) {
    const snap = await ui.snapshot();
    emailRef = snap.match(/@(e\d+) textbox "Correo"/)?.[1];
    passRef = snap.match(/@(e\d+) textbox "Contrase[ñn]a"/)?.[1];
    if (!emailRef) await page.waitForTimeout(1000);
  }
  if (!emailRef || !passRef) return { error: 'no login form', steps: out.steps };
  await ui.fill(emailRef, process.env.QA_EMAIL ?? 'admin@sgsst.com');
  await ui.fill(passRef, process.env.QA_PASS ?? '');
  let submitRef = null;
  for (let i = 0; i < 5 && !submitRef; i += 1) {
    const snap = await ui.snapshot();
    submitRef = snap.match(/@(e\d+) button "Iniciar sesi[oó]n"/)?.[1];
    if (!submitRef) await page.waitForTimeout(500);
  }
  if (!submitRef) return { error: 'no submit button' };
  await ui.click(submitRef);
  await page.waitForFunction(() => document.body.innerText.includes('Dashboard'), null, { timeout: 30000 });
  out.steps.push({ step: 'login', ok: true });

  // --- Navegar a Hallazgos ---
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Hallazgos');
    if (el) el.click();
  });
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('table tbody tr')).some((r) => r.textContent.includes('QA S15')), null, { timeout: 60000 });
    out.steps.push({ step: 'nav-hallazgos', ok: true });
  } catch (err) {
    out.steps.push({ step: 'nav-hallazgos', ok: false, error: String(err).slice(0, 150), body: await bodyText().then((t) => t.slice(0, 200)) });
  }

  // --- Abrir el detalle del hallazgo QA ---
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('table tbody tr')).find((r) => r.textContent.includes('QA S15'));
    const btn = row && row.querySelector('button[title*="Detalle"], button[aria-label*="Detalle"]');
    if (btn) btn.click();
  });
  let detail = null;
  try {
    detail = await page.waitForFunction(() => {
      const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.textContent.includes('Detalle del hallazgo'));
      if (!d || d.querySelectorAll('.MuiChip-root').length === 0) return null;
      return {
        chips: Array.from(d.querySelectorAll('.MuiChip-root')).map((e) => e.textContent.trim()),
        hasCauseForm: Boolean(Array.from(d.querySelectorAll('input')).find((i) => i.placeholder && i.placeholder.includes('Tipo de causa'))),
      };
    }, null, { timeout: 45000 });
    out.steps.push({ step: 'dialogo-detalle', ok: Boolean(detail), detail: detail ? await detail.jsonValue() : null });
  } catch (err) {
    out.steps.push({ step: 'dialogo-detalle', ok: false, error: String(err).slice(0, 150), body: await bodyText().then((t) => t.slice(0, 200)) });
  }

  // --- Agregar una causa desde el dialogo ---
  let causeAdded = false;
  if (detail) {
    const causeTypeRef = (await ui.snapshot()).match(/@(e\d+) textbox "(Tipo de causa)?"/)?.[1];
    // El snapshot accesible no usa placeholder como nombre: busca por label.
    const refs = await ui.snapshot();
    const typeRef = refs.match(/@(e\d+) textbox "[^"]*causa[^"]*"/i)?.[1] ?? causeTypeRef;
    const descRef = refs.match(/@(e\d+) textbox "[^"]*Descripci[^"]*causa[^"]*"|@(e\d+) textbox "Descripción de la causa"/)?.[1];
    if (typeRef && descRef) {
      await ui.fill(typeRef, 'Metodo');
      await ui.fill(descRef, 'Causa agregada desde QA UI S15.1');
      const addRef = refs.match(/@(e\d+) button "[^"]*Agregar[^"]*"/)?.[1];
      if (addRef) {
        await ui.click(addRef);
        try {
          await page.waitForFunction(() => {
            const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.textContent.includes('Detalle del hallazgo'));
            return d && d.textContent.includes('Causa agregada desde QA UI S15.1');
          }, null, { timeout: 30000 });
          causeAdded = true;
        } catch (err) {
          out.steps.push({ step: 'agregar-causa', ok: false, error: String(err).slice(0, 150) });
        }
      }
    }
    out.steps.push({ step: 'agregar-causa', ok: causeAdded });
  }

  await page.screenshot({ path: 'scripts/qa-artifacts/s15-findings.png', fullPage: false }).catch(() => {});

  // --- Limpieza por API ---
  if (findingId) {
    await fetch(`${apiBase}/findings/${findingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    out.steps.push({ step: 'api-cleanup', ok: true, findingId });
  }

  const failed = out.steps.filter((s) => s.ok === false);
  out.pass = out.consoleErrors.length === 0 && failed.length === 0;
  return out;
}
