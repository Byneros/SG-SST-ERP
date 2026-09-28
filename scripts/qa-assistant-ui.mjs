export default async function run(page, ui) {
  const Q1 = process.env.QA_Q1 ?? '¿Que modulos tiene el ERP para gestionar riesgos?';
  const Q2 = process.env.QA_Q2 ?? '@datos resumen de riesgos';
  const TOOL = process.env.QA_TOOL ?? 'risks_summary';
  const Q2_MARKER = process.env.QA_Q2_MARKER ?? 'Trabajo en alturas|Planta Norte';
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
    await ui.fill(emailRef, 'admin@sgsst.com');
    await ui.fill(passRef, 'Admin12345');
    snap = await ui.snapshot();
    const loginRef =
      refOf(snap, /@(e\d+) button "Iniciar sesion"(?!\s*\[disabled\])/) ||
      refOf(snap, /@(e\d+) button "Iniciar sesión"(?!\s*\[disabled\])/);
    if (!loginRef) return { error: 'boton Iniciar sesion disabled', snap };
    await ui.click(loginRef);
    await page.waitForFunction(
      () => /Dashboard|Cerrar sesi[oó]n/.test(document.body.innerText),
      { timeout: 20000 },
    );
    out.steps.push({ step: 'login', ok: true });
  }

  // --- Abrir el chat del asistente desde el sidebar ---
  async function clickNav(labels) {
    let s = await ui.snapshot();
    let ref = null;
    for (const label of labels) {
      ref = refOf(s, new RegExp(`@(e\\d+) button "${label}"`, 'i'));
      if (ref) break;
    }
    if (!ref) {
      await page.evaluate(() => {
        const b = document.querySelector('button.mobile-menu');
        if (b) b.click();
      });
      await page.waitForTimeout(800);
      s = await ui.snapshot();
      for (const label of labels) {
        ref = refOf(s, new RegExp(`@(e\\d+) button "${label}"`, 'i'));
        if (ref) break;
      }
    }
    if (!ref) throw new Error(`nav no encontrada: ${labels.join('/')}`);
    await ui.click(ref);
    await page.waitForTimeout(1500);
  }

  await clickNav(['Asistente IA', 'Asistente']);
  const chatText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  out.steps.push({
    step: 'vista chat abierta',
    ok: /Asistente inteligente/.test(chatText),
  });

  // --- Enviar pregunta conversacional ---
  let inputRef = null;
  for (let i = 0; i < 8 && !inputRef; i += 1) {
    const s = await ui.snapshot();
    inputRef =
      refOf(s, /@(e\d+) textbox "Escribe tu consulta[^"]*"/) ||
      refOf(s, /@(e\d+) textbox "Escribe tu consulta/);
    if (!inputRef) await page.waitForTimeout(700);
  }
  if (!inputRef) return { ...out, error: 'no encontre el input del chat' };
  await ui.fill(inputRef, '¿Que modulos tiene el ERP para gestionar riesgos?');
  const s1 = await ui.snapshot();
  const sendRef =
    refOf(s1, /@(e\d+) button "Enviar"(?!\s*\[disabled\])/) ||
    refOf(s1, /@(e\\d+) button "Enviar/);
  if (!sendRef) return { ...out, error: 'boton Enviar no habilitado' };
  await ui.click(sendRef);

  // Esperar la respuesta real del proveedor (puede tardar unos segundos).
  let answer1 = '';
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(1000);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    if (/Pensando\.\.\./.test(text)) continue;
    if (/GTC 45|riesgos laborales|matriz de peligros/i.test(text)) {
      answer1 = text;
      break;
    }
  }
  out.steps.push({
    step: 'respuesta conversacional con contenido del ERP',
    ok: Boolean(answer1),
  });

  // --- Enviar @datos ---
  const s2 = await ui.snapshot();
  const inputRef2 =
    refOf(s2, /@(e\d+) textbox "Escribe tu consulta[^"]*"/) ||
    refOf(s2, /@(e\d+) textbox "Escribe tu consulta/);
  await ui.fill(inputRef2, Q2);
  const s3 = await ui.snapshot();
  const sendRef2 =
    refOf(s3, /@(e\d+) button "Enviar"(?!\s*\[disabled\])/) ||
    refOf(s3, /@(e\d+) button "Enviar/);
  await ui.click(sendRef2);

  let answer2 = '';
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(1000);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    if (/Pensando\.\.\./.test(text)) continue;
    const chip = new RegExp(`Datos: ${TOOL}`, 'i');
    const marker = new RegExp(Q2_MARKER, 'i');
    if (chip.test(text) && marker.test(text)) {
      answer2 = text;
      break;
    }
  }
  out.steps.push({
    step: `@datos (${TOOL}) con chip y contenido enriquecido`,
    ok: Boolean(answer2),
    sinUuids: !/[0-9a-f]{8}-[0-9a-f]{4}/i.test(answer2 || ''),
  });

  out.ok = out.steps.every((s) => s.ok) && out.consoleErrors.length === 0;
  return out;
}
