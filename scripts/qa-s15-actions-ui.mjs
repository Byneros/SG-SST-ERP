/**
 * Verificacion UI de S15.2 (acciones con eficacia) en navegador fresco.
 * Prepara una accion PREVENTIVE en DONE por API, recorre la vista Acciones,
 * verifica la eficacia desde el dialogo y limpia al final.
 * Uso: QA_EMAIL/QA_PASS en env; node ~/.codegpt/skills/browser-automation/browser.mjs http://localhost:5176 --script scripts/qa-s15-actions-ui.mjs
 */
export default async function run(page, ui) {
  const out = { steps: [], consoleErrors: [] };
  page.on('pageerror', (err) => out.consoleErrors.push(String(err).slice(0, 200)));
  const bodyText = () => page.evaluate(() => document.body.innerText);

  // --- Preparacion por API: login + accion PREVENTIVE en DONE ---
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
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const dueDate = new Date(Date.now() + 15 * 86400000).toISOString();

  const action = await fetch(`${apiBase}/actions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: '[QA S15.2] accion UI',
      description: 'Accion de verificacion UI S15.2',
      kind: 'PREVENTIVE',
      expectedBenefit: 'Reducir incidentes en temporada alta',
      dueDate,
      companyId,
    }),
  }).then((r) => r.json());
  if (!action?.id) return { error: 'no action created', action };
  const document = await fetch(`${apiBase}/documents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: '[QA S15.2] evidencia UI',
      fileUrl: '/qa/s15-accion-ui.pdf',
      category: 'OTHER',
      status: 'PUBLISHED',
      companyId,
    }),
  }).then((r) => r.json());
  await fetch(`${apiBase}/actions/${action.id}/advance`, { method: 'POST', headers, body: JSON.stringify({ target: 'IN_PROGRESS' }) });
  await fetch(`${apiBase}/actions/${action.id}`, { method: 'PATCH', headers, body: JSON.stringify({ evidenceId: document.id }) });
  const done = await fetch(`${apiBase}/actions/${action.id}/advance`, { method: 'POST', headers, body: JSON.stringify({ target: 'DONE' }) }).then((r) => r.json());
  out.steps.push({ step: 'api-setup', ok: done?.status === 'DONE', actionId: action.id, docId: document.id });

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

  // --- Navegar a Acciones ---
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Acciones');
    if (el) el.click();
  });
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('table tbody tr')).some((r) => r.textContent.includes('QA S15.2')), null, { timeout: 60000 });
    out.steps.push({ step: 'nav-acciones', ok: true });
  } catch (err) {
    out.steps.push({ step: 'nav-acciones', ok: false, error: String(err).slice(0, 150), body: await bodyText().then((t) => t.slice(0, 200)) });
  }

  // --- Abrir el dialogo de verificacion de eficacia ---
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('table tbody tr')).find((r) => r.textContent.includes('QA S15.2'));
    const btn = row && row.querySelector('button[title*="Verificar"], button[aria-label*="Verificar"]');
    if (btn) btn.click();
  });
  let dialog = null;
  try {
    dialog = await page.waitForFunction(() => {
      const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.textContent.includes('Verificar eficacia'));
      if (!d) return null;
      return {
        text: d.textContent.slice(0, 200),
        hasEffectiveness: Boolean(Array.from(d.querySelectorAll('[role="combobox"], .MuiSelect-select')).length),
      };
    }, null, { timeout: 45000 });
    out.steps.push({ step: 'dialogo-verificar', ok: Boolean(dialog), dialog: dialog ? await dialog.jsonValue() : null });
  } catch (err) {
    out.steps.push({ step: 'dialogo-verificar', ok: false, error: String(err).slice(0, 150), body: await bodyText().then((t) => t.slice(0, 200)) });
  }

  // --- Confirmar la verificacion (EFFECTIVE por defecto) ---
  let verified = false;
  if (dialog) {
    const refs = await ui.snapshot();
    const verifyBtn = refs.match(/@(e\d+) button "Verificar"/)?.[1];
    if (verifyBtn) {
      await ui.click(verifyBtn);
      try {
        await page.waitForFunction(() => {
          const row = Array.from(document.querySelectorAll('table tbody tr')).find((r) => r.textContent.includes('QA S15.2'));
          return row && row.textContent.includes('Verificada') && row.textContent.includes('Eficaz');
        }, null, { timeout: 30000 });
        verified = true;
      } catch (err) {
        out.steps.push({ step: 'confirmar-verificacion', ok: false, error: String(err).slice(0, 150) });
      }
    }
    out.steps.push({ step: 'confirmar-verificacion', ok: verified });
  }

  await page.screenshot({ path: 'scripts/qa-artifacts/s15-actions.png', fullPage: false }).catch(() => {});

  // --- Limpieza por API ---
  if (action.id) {
    await fetch(`${apiBase}/actions/${action.id}`, { method: 'DELETE', headers }).catch(() => {});
    await fetch(`${apiBase}/documents/${document.id}`, { method: 'DELETE', headers }).catch(() => {});
    out.steps.push({ step: 'api-cleanup', ok: true, actionId: action.id });
  }

  const failed = out.steps.filter((s) => s.ok === false);
  out.pass = out.consoleErrors.length === 0 && failed.length === 0;
  return out;
}
