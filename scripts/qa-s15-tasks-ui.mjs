/**
 * Verificacion UI de S15.3 (bandeja de tareas) en navegador fresco.
 * Prepara un hallazgo MAJOR por API (dispara la tarea automatica), recorre la
 * vista Tareas, comenta desde el dialogo de detalle, completa la tarea y
 * verifica el widget del dashboard; limpia al final.
 * Uso: QA_EMAIL/QA_PASS en env; node ~/.codegpt/skills/browser-automation/browser.mjs http://localhost:5176 --script scripts/qa-s15-tasks-ui.mjs
 */
export default async function run(page, ui) {
  const out = { steps: [], consoleErrors: [] };
  page.on('pageerror', (err) => out.consoleErrors.push(String(err).slice(0, 200)));
  const bodyText = () => page.evaluate(() => document.body.innerText);

  // --- Preparacion por API: login + hallazgo MAJOR que genera la tarea ---
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

  const finding = await fetch(`${apiBase}/findings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: '[QA S15.3] hallazgo UI',
      description: 'Genera tarea automatica para la verificacion UI S15.3',
      sourceType: 'MANUAL',
      type: 'NON_CONFORMITY',
      severity: 'MAJOR',
      companyId,
    }),
  }).then((r) => r.json());
  if (!finding?.id) return { error: 'no finding created', finding };
  let autoTask = null;
  for (let i = 0; i < 10 && !autoTask; i += 1) {
    const list = await fetch(`${apiBase}/tasks?sourceType=FINDING&search=${encodeURIComponent('[QA S15.3]')}`, { headers }).then((r) => r.json());
    autoTask = (list.data ?? []).find((t) => t.sourceId === finding.id) ?? null;
    if (!autoTask) await new Promise((r) => setTimeout(r, 500));
  }
  if (!autoTask) return { error: 'no auto task', findingId: finding.id };
  out.steps.push({ step: 'api-setup', ok: true, findingId: finding.id, taskId: autoTask.id });

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

  // --- Navegar a Tareas ---
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Tareas');
    if (el) el.click();
  });
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('table tbody tr')).some((r) => r.textContent.includes('QA S15.3')), null, { timeout: 60000 });
    out.steps.push({ step: 'nav-tareas', ok: true });
  } catch (err) {
    out.steps.push({ step: 'nav-tareas', ok: false, error: String(err).slice(0, 150), body: await bodyText().then((t) => t.slice(0, 200)) });
  }

  // --- Abrir el dialogo de detalle de la tarea automatica ---
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('table tbody tr')).find((r) => r.textContent.includes('QA S15.3'));
    const title = row && row.querySelector('table tbody tr td span, table tbody tr td div p');
    const clickable = title || row;
    if (clickable) clickable.click();
  });
  let detailDialog = null;
  try {
    detailDialog = await page.waitForFunction(() => {
      const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.textContent.includes('Gestionar hallazgo'));
      if (!d) return null;
      return {
        hasOrigin: d.textContent.includes('Origen: Hallazgo'),
        hasPriority: d.textContent.includes('Alta'),
        hasStatus: d.textContent.includes('Abierta'),
      };
    }, null, { timeout: 45000 });
    out.steps.push({ step: 'dialogo-detalle', ok: Boolean(detailDialog), dialog: detailDialog ? await detailDialog.jsonValue() : null });
  } catch (err) {
    out.steps.push({ step: 'dialogo-detalle', ok: false, error: String(err).slice(0, 150), body: await bodyText().then((t) => t.slice(0, 200)) });
  }

  // --- Comentar desde el dialogo ---
  let commented = false;
  if (detailDialog) {
    const refs = await ui.snapshot();
    const commentBox = refs.match(/@(e\d+) textbox "Agregar comentario"/)?.[1];
    if (commentBox) {
      await ui.fill(commentBox, '[QA S15.3] comentario desde el dialogo');
      const sendBtn = refs.match(/@(e\d+) button "Comentar"/)?.[1];
      if (sendBtn) {
        await ui.click(sendBtn);
        try {
          await page.waitForFunction(() => {
            const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.textContent.includes('Gestionar hallazgo'));
            return d && d.textContent.includes('comentario desde el dialogo');
          }, null, { timeout: 30000 });
          commented = true;
        } catch (err) {
          out.steps.push({ step: 'comentar', ok: false, error: String(err).slice(0, 150) });
        }
      }
    }
    out.steps.push({ step: 'comentar', ok: commented });
  }

  // --- Completar la tarea desde el dialogo y confirmar el sello ---
  let completed = false;
  if (detailDialog) {
    const clicked = await page.evaluate(() => {
      const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.textContent.includes('Gestionar hallazgo'));
      const btn = d && Array.from(d.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Completar');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      try {
        await page.waitForFunction(() => {
          const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.textContent.includes('Gestionar hallazgo'));
          return d && d.textContent.includes('Hecha');
        }, null, { timeout: 30000 });
        completed = true;
      } catch (err) {
        out.steps.push({ step: 'completar', ok: false, error: String(err).slice(0, 150) });
      }
    } else {
      out.steps.push({ step: 'completar', ok: false, error: 'boton Completar no visible' });
    }
    out.steps.push({ step: 'completar', ok: completed });
  }
  if (detailDialog) {
    const refs = await ui.snapshot();
    const closeBtn = refs.match(/@(e\d+) button "Cerrar"/)?.[1];
    if (closeBtn) await ui.click(closeBtn);
    await page.waitForTimeout(500);
  }

  // --- Widget del dashboard ---
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Dashboard');
    if (el) el.click();
  });
  let widget = null;
  try {
    widget = await page.waitForFunction(() => {
      const el = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Bandeja de tareas');
      if (!el) return null;
      const card = el.closest('.kpi-card') ?? el.closest('div');
      const text = card ? card.textContent : document.body.innerText;
      return {
        text: text.slice(0, 200),
        hasOverdue: /\d+\s*vencidas/.test(text),
        hasDueSoon: /\d+\s*vencen en 7 d[ií]as/.test(text),
        hasMine: /Tuyas:/.test(text),
      };
    }, null, { timeout: 30000 });
    out.steps.push({ step: 'widget-dashboard', ok: Boolean(widget), widget: widget ? await widget.jsonValue() : null });
  } catch (err) {
    out.steps.push({ step: 'widget-dashboard', ok: false, error: String(err).slice(0, 150) });
  }

  await page.screenshot({ path: 'scripts/qa-artifacts/s15-tasks.png', fullPage: false }).catch(() => {});

  // --- Limpieza por API ---
  if (autoTask?.id) {
    await fetch(`${apiBase}/tasks/${autoTask.id}`, { method: 'DELETE', headers }).catch(() => {});
  }
  if (finding?.id) {
    await fetch(`${apiBase}/findings/${finding.id}`, { method: 'DELETE', headers }).catch(() => {});
  }
  out.steps.push({ step: 'api-cleanup', ok: true, taskId: autoTask?.id ?? null });

  const failed = out.steps.filter((s) => s.ok === false);
  out.pass = out.consoleErrors.length === 0 && failed.length === 0;
  return out;
}
