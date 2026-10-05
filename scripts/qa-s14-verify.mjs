/**
 * Verificacion UI de S14 (gestion del cambio) en navegador fresco.
 * Uso: QA_EMAIL/QA_PASS en env; node ~/.codegpt/skills/browser-automation/browser.mjs http://localhost:5176 --script scripts/qa-s14-verify.mjs
 */
export default async function run(page, ui) {
  const out = { steps: [], consoleErrors: [] };
  page.on('pageerror', (err) => out.consoleErrors.push(String(err).slice(0, 200)));
  const bodyText = () => page.evaluate(() => document.body.innerText);

  // Limpia la cache HTTP del navegador: nginx cachea index.html y un chunk
  // viejo en memoria hace pasar el fix por roto (paso requerido tras rebuild).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  out.steps.push({ step: 'cache-cleared', ok: true });

  // --- Login por formulario con espera explicita ---
  let emailRef = null;
  let passRef = null;
  for (let i = 0; i < 15 && !emailRef; i += 1) {
    const snap = await ui.snapshot();
    emailRef = snap.match(/@(e\d+) textbox "Correo"/)?.[1];
    passRef = snap.match(/@(e\d+) textbox "Contrase[ñn]a"/)?.[1];
    if (!emailRef) await page.waitForTimeout(1000);
  }
  if (!emailRef || !passRef) return { error: 'no login form' };
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
  // Espera activa al dashboard, no un delay fijo.
  await page.waitForFunction(() => document.body.innerText.includes('Dashboard'), null, { timeout: 30000 });
  out.steps.push({ step: 'login', ok: true });

  // --- Navegar a Gestion del cambio ---
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Gestión del cambio');
    if (el) el.click();
  });
  // Espera la fila del cambio QA (no filas genericas: el dashboard tambien
  // tiene tablas y podria satisfacer la condicion antes de cargar la vista).
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('table tbody tr')).some((r) => r.textContent.includes('QA S14')), null, { timeout: 60000 });
    out.steps.push({ step: 'nav-gestion-cambio', ok: true });
  } catch (err) {
    out.steps.push({ step: 'nav-gestion-cambio', ok: false, error: String(err).slice(0, 150), body: await bodyText().then((t) => t.slice(0, 200)) });
  }

  // --- Localizar el cambio QA S14 y abrir el workflow ---
  const rowFound = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('table tbody tr')).find((r) => r.textContent.includes('QA S14'));
    return row ? row.textContent.slice(0, 140) : null;
  });
  out.steps.push({ step: 'fila-QA-S14', ok: Boolean(rowFound), rowFound });

  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('table tbody tr')).find((r) => r.textContent.includes('QA S14'));
    const btn = row && row.querySelector('button[title*="Workflow"], button[aria-label*="Workflow"]');
    if (btn) btn.click();
  });
  let wf = null;
  try {
    // Espera el dialogo CON datos renderizados (chips no vacios), no solo su
    // apertura: en "Cargando cambio..." el DOM existe pero no hay nada que
    // asertar y el paso pasaria sin verificar nada.
    wf = await page.waitForFunction(() => {
      const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.textContent.includes('Workflow del cambio'));
      if (!d || d.querySelectorAll('.MuiChip-root').length === 0) return null;
      return {
        chips: Array.from(d.querySelectorAll('.MuiChip-root')).map((e) => e.textContent.trim()),
        alerts: Array.from(d.querySelectorAll('.MuiAlert-message')).map((e) => e.textContent.trim()),
        advance: Array.from(d.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).filter((t) => t.includes('Avanzar')),
      };
    }, null, { timeout: 45000 });
    out.steps.push({ step: 'dialogo-workflow', ok: Boolean(wf), wf: wf.jsonValue ? await wf.jsonValue() : wf });
  } catch (err) {
    out.steps.push({ step: 'dialogo-workflow', ok: false, error: String(err).slice(0, 150), body: await bodyText().then((t) => t.slice(0, 200)) });
  }

  await page.screenshot({ path: 'scripts/qa-artifacts/s14-verify.png', fullPage: false }).catch(() => {});

  const failed = out.steps.filter((s) => s.ok === false);
  out.pass = out.consoleErrors.length === 0 && failed.length === 0;
  return out;
}
