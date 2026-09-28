export default async function run(page, ui) {
  const out = { steps: [], consoleErrors: [] };
  page.on('pageerror', (err) => out.consoleErrors.push(String(err).slice(0, 200)));

  function refOf(snap, pattern) {
    return snap.match(pattern)?.[1] ?? null;
  }

  // --- Login (o sesion persistente) ---
  let snap = await ui.snapshot();
  const bodyStart = await page.evaluate(() => document.body.innerText.slice(0, 400));
  const alreadyIn = /Dashboard|Cerrar sesi[oó]n/.test(bodyStart);
  if (alreadyIn) {
    out.steps.push({ step: 'login', ok: true, note: 'sesion persistente (sin form)' });
  } else {
    // La app puede tardar en montar (chunks lazy): esperar el form de login.
    let emailRef = null;
    let passRef = null;
    for (let i = 0; i < 10 && !emailRef; i += 1) {
      snap = await ui.snapshot();
      emailRef = refOf(snap, /@(e\d+) textbox "Correo"/);
      passRef = refOf(snap, /@(e\d+) textbox "Contrasena"|@(e\d+) textbox "Contraseña"/);
      if (!emailRef) await page.waitForTimeout(1000);
    }
    if (!emailRef || !passRef) return { error: 'no aparecio el form de login', snap };
    await ui.fill(emailRef, 'admin@sgsst.com');
    await ui.fill(passRef, 'Admin12345');
    snap = await ui.snapshot();
    const loginRef =
      refOf(snap, /@(e\d+) button "Iniciar sesion"(?!\s*\[disabled\])/) ||
      refOf(snap, /@(e\d+) button "Iniciar sesión"(?!\s*\[disabled\])/);
    if (!loginRef) return { error: 'boton Iniciar sesion sigue disabled', snap };
    await ui.click(loginRef);
    await page.waitForFunction(
      () => /Dashboard|Cerrar sesi[oó]n/.test(document.body.innerText),
      { timeout: 20000 },
    );
    out.steps.push({ step: 'login', ok: true });
  }

  // --- Navegacion real: drawer del sidebar -> click en la entrada ---
  function navRefOf(snap, labels) {
    for (const label of labels) {
      const ref = snap.match(new RegExp(`@(e\\d+) button "${label}"`, 'i'))?.[1];
      if (ref) return ref;
    }
    return null;
  }

  async function gotoView(name, labels, markerPattern) {
    let snap2 = await ui.snapshot();
    let ref = navRefOf(snap2, labels);
    if (!ref) {
      // Drawer cerrado: abrirlo con click JS (el click de playwright se queda
      // esperando actionability contra la animacion del Drawer de MUI).
      await page.evaluate(() => {
        const b = document.querySelector('button.mobile-menu');
        if (b) b.click();
      });
      await page.waitForTimeout(800);
      snap2 = await ui.snapshot();
      ref = navRefOf(snap2, labels);
    }
    if (!ref) {
      out.steps.push({ step: name, ok: false, detail: `nav no encontrada: ${labels.join('/')}` });
      return;
    }
    await ui.click(ref);
    await page.waitForTimeout(1800);
    const text = await page.evaluate(() =>
      document.body.innerText.replace(/\s+/g, ' '),
    );
    const broken = /Algo sali[oó] mal|Oops/.test(text);
    const marker = new RegExp(markerPattern, 'i').test(text);
    out.steps.push({ step: name, ok: !broken && marker, markerFound: marker });
  }

  await gotoView('S8 annualWorkPlans', ['Plan Anual', 'Plan anual'], 'Plan anual');
  await gotoView('S9 plannedInspections', ['Inspecciones planeadas'], 'Inspecciones');
  await gotoView('S9 unplannedInspections', ['Inspecciones no planeadas'], 'reactiva|no planeada|motivo');
  await gotoView('S9 unsafeReports', ['Actos y condiciones', 'Condiciones inseguras'], 'insegur');
  await gotoView('S9 ppe', ['EPP'], 'EPP');
  await gotoView('S10 medical', ['Medicina laboral'], 'Profesiograma|Examen|Medicina');
  await gotoView('16.2 aiAssistant', ['Asistente IA'], 'Asistente');

  out.ok = out.steps.every((s) => s.ok) && out.consoleErrors.length === 0;
  return out;
}
