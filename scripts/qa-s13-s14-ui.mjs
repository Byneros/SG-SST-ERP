/**
 * QA UI del flujo de ingreso de contratistas (S13.4) y gestion del cambio (S14).
 * Ejecutar: node ~/.codegpt/skills/browser-automation/browser.mjs http://localhost:5176 --script scripts/qa-s13-s14-ui.mjs
 * Credenciales via QA_EMAIL / QA_PASS.
 */
export default async function run(page, ui) {
  const out = { steps: [], consoleErrors: [] };
  page.on('pageerror', (err) => out.consoleErrors.push(String(err).slice(0, 200)));

  function refOf(snap, pattern) {
    return snap.match(pattern)?.[1] ?? null;
  }

  // --- Login (o sesion persistente) ---
  let snap = await ui.snapshot();
  const bodyStart = await page.evaluate(() => document.body.innerText.slice(0, 400));
  if (/Dashboard|Cerrar sesi[oó]n/.test(bodyStart)) {
    out.steps.push({ step: 'login', ok: true, note: 'sesion persistente' });
  } else {
    let emailRef = null;
    let passRef = null;
    for (let i = 0; i < 10 && !emailRef; i += 1) {
      snap = await ui.snapshot();
      emailRef = refOf(snap, /@(e\d+) textbox "Correo"/);
      passRef = refOf(snap, /@(e\d+) textbox "Contrasena"|@(e\d+) textbox "Contraseña"/);
      if (!emailRef) await page.waitForTimeout(1000);
    }
    if (!emailRef || !passRef) return { error: 'no aparecio el form de login', snap };
    await ui.fill(emailRef, process.env.QA_EMAIL ?? 'admin@sgsst.com');
    await ui.fill(passRef, process.env.QA_PASS ?? '');
    snap = await ui.snapshot();
    const submitRef = refOf(snap, /@(e\d+) button "Iniciar sesi[oó]n"|@(e\d+) button "Ingresar"/);
    if (!submitRef) return { error: 'no aparecio el boton de submit', snap };
    await ui.click(submitRef);
    await page.waitForTimeout(2500);
    out.steps.push({ step: 'login', ok: true });
  }

  // --- Helper: abrir el drawer lateral y navegar ---
  async function goTo(viewLabel, viewMarker) {
    const before = await page.evaluate(() => document.body.innerText.slice(0, 600));
    if (before.includes(viewMarker)) return true;
    // Si el drawer esta cerrado (viewport angosto), abrir hamburger.
    const menuRef = refOf(await ui.snapshot(), /@(e\d+) button "open drawer"|@(e\d+) button "Men[uú]"/);
    if (menuRef) await ui.click(menuRef);
    await page.waitForTimeout(400);
    const nav = await page.evaluate((label) => {
      const items = Array.from(document.querySelectorAll('button, a'));
      const item = items.find((el) => (el.textContent || '').trim().includes(label));
      if (item) {
        item.click();
        return true;
      }
      return false;
    }, viewLabel);
    await page.waitForTimeout(1200);
    return nav;
  }

  // ================= S13.4: flujo de ingreso de contratistas =================
  const contractorsNav = await goTo('Contratistas', 'Contratistas');
  out.steps.push({ step: 'nav-contratistas', ok: contractorsNav });
  await page.waitForTimeout(800);

  // Localizar la fila del contratista de prueba creado por HTTP.
  const rowText = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('table tbody tr'));
    const row = cells.find((el) => (el.textContent || '').includes('QA S13'));
    return row ? row.textContent.slice(0, 200) : null;
  });
  out.steps.push({ step: 'fila-contratista-QA', ok: Boolean(rowText), rowText });

  // Abrir el dialogo de autorizacion de ingreso (icono VerifiedUser: title="Autorización de ingreso").
  const opened = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const row = rows.find((el) => (el.textContent || '').includes('QA S13'));
    if (!row) return false;
    const btn = row.querySelector('button[title*="Autorizaci"], button[aria-label*="Autorizaci"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  await page.waitForTimeout(1200);
  out.steps.push({ step: 'abrir-autorizacion', ok: opened });

  // Leer el dialogo: stepper del flujo y decision del backend.
  const dialog = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const open = dialogs.find((el) => el.textContent.includes('Flujo de ingreso'));
    if (!open) return null;
    const chips = Array.from(open.querySelectorAll('.MuiChip-root')).map((el) => el.textContent.trim());
    return {
      title: open.querySelector('.MuiDialogTitle-root')?.textContent?.trim(),
      alert: open.querySelector('.MuiAlert-message')?.textContent?.trim().slice(0, 140),
      chips: chips.slice(0, 12),
      blocking: open.textContent.includes('Razones de bloqueo'),
    };
  });
  out.steps.push({ step: 'dialogo-flujo', ok: Boolean(dialog), dialog });
  await page.screenshot({ path: 'scripts/qa-artifacts/s13-entry-flow.png', fullPage: false }).catch(() => {});

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ================= S14: gestion del cambio =================
  const changeNav = await goTo('Gestión del cambio', 'Gestión del cambio');
  await page.waitForTimeout(800);
  const changeView = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  out.steps.push({
    step: 'nav-gestion-cambio',
    ok: changeNav && changeView.includes('Gestión del cambio') && (changeView.includes('QA S14') || changeView.includes('Solicitud de cambio') || changeView.includes('Sin solicitudes')),
  });

  // Abrir el workflow del cambio QA S14.
  const wfOpened = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const row = rows.find((el) => (el.textContent || '').includes('QA S14'));
    if (!row) return false;
    const btn = row.querySelector('button[title*="Workflow"], button[aria-label*="Workflow"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  await page.waitForTimeout(1200);
  const wfDialog = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const open = dialogs.find((el) => el.textContent.includes('Flujo del cambio'));
    if (!open) return null;
    const chips = Array.from(open.querySelectorAll('.MuiChip-root')).map((el) => el.textContent.trim());
    return {
      title: open.querySelector('.MuiDialogTitle-root')?.textContent?.trim(),
      chips: chips.slice(0, 12),
      hasAdvance: Array.from(open.querySelectorAll('button')).some((b) => /Avanzar a/.test(b.textContent || '')),
    };
  });
  out.steps.push({ step: 'dialogo-workflow', ok: Boolean(wfDialog), wfDialog });
  await page.screenshot({ path: 'scripts/qa-artifacts/s14-change-workflow.png', fullPage: false }).catch(() => {});

  // ================================= Resumen =================================
  const failed = out.steps.filter((s) => s.ok === false || (s.step === 'dialogo-flujo' && !s.ok) || (s.step === 'dialogo-workflow' && !s.ok));
  out.pass = out.consoleErrors.length === 0 && failed.length === 0;
  return out;
}
