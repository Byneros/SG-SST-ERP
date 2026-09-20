// QA: dashboard -> vista filtrada -> chip -> limpiar -> URL compartible.
async function rows(page) {
  return page.locator('tbody tr').count()
}
async function consoleErrors(page) {
  return page.evaluate(() => window.__errs ?? [])
}
function setupCapture(page) {
  return page.evaluate(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.error?.stack || e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason?.stack || e.reason)))
  })
}

export default async function run(page, ui) {
  const out = {}
  await page.setViewportSize({ width: 1680, height: 1050 })
  await setupCapture(page)

  // La sesion persistente ya puede estar logueada o no: tolerar ambos.
  const s0 = await ui.snapshot()
  if (s0.includes('Iniciar sesion')) {
    await ui.fill(s0.match(/@(e\d+) textbox "Correo"/)[1], 'admin@sgsst.com')
    await ui.fill(s0.match(/@(e\d+) textbox "Contrasena"/)[1], 'Admin12345')
    await ui.click(s0.match(/@(e\d+) button "Iniciar sesion"/)[1])
  }
  await page.waitForFunction(() => document.body.innerText.includes('Rol de sesion'), { timeout: 20000 })

  // Ir al Dashboard (limpio, sin hash previo).
  await page.evaluate(() => { window.location.hash = '' })
  await page.reload()
  await page.waitForFunction(() => document.body.innerText.includes('Rol de sesion'), { timeout: 20000 })
  await page.waitForTimeout(1500)
  out.dashboardSecciones = await page.evaluate(() => ({
    sedes: [...document.querySelectorAll('h6')].some((h) => h.textContent?.trim() === 'Sedes'),
    principal: document.body.innerText.includes('Principal'),
  }))

  // 1) Click en el nombre de la sede -> Empleados filtrado.
  await page.getByRole('cell', { name: /Planta Norte/ }).first().click()
  await page.waitForTimeout(2000)
  out.empleados = {
    url: await page.evaluate(() => window.location.hash),
    chip: await page.evaluate(() => [...document.querySelectorAll('.MuiChip-label')].map((c) => c.textContent).find((t) => t?.startsWith('Sede:')) ?? null),
    filas: await rows(page),
    selector: await page.getByRole('combobox', { name: 'Sede' }).inputValue(),
  }

  // 2) Volver al dashboard y click en el conteo de incidentes -> Incidentes filtrado.
  await page.getByRole('button', { name: 'Dashboard' }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('cell', { name: /\d+/ }).filter({ hasText: /^\d+$/ }).first().click().catch(() => {})
  out.incidentesClick = 'intento-1'
  // Si el click cayo en otra celda, verificar hash y corregir por URL directa.
  out.hashTrasClick = await page.evaluate(() => window.location.hash)

  // 3) Chip visible y limpiar filtro.
  const chipClear = await page.getByRole('button', { name: /Sede:/ }).first().isVisible().catch(() => false)
  if (chipClear) {
    await page.getByRole('button', { name: /Sede:/ }).first().click()
    await page.waitForTimeout(1500)
  }
  out.trasLimpiar = {
    url: await page.evaluate(() => window.location.hash),
    chip: await page.evaluate(() => [...document.querySelectorAll('.MuiChip-label')].map((c) => c.textContent).find((t) => t?.startsWith('Sede:')) ?? null),
  }

  // 4) URL compartible: navegar directo con hash a riesgos filtrados y recargar.
  const siteId = out.empleados.selector
  if (siteId && siteId !== 'all') {
    await page.goto(`http://localhost:5180/#/risks?site=${siteId}`)
    await page.reload()
    await page.waitForFunction(() => document.body.innerText.includes('Matriz de riesgos'), { timeout: 20000 })
    await page.waitForTimeout(1800)
    out.riesgosDesdeUrl = {
      url: await page.evaluate(() => window.location.hash),
      chip: await page.evaluate(() => [...document.querySelectorAll('.MuiChip-label')].map((c) => c.textContent).find((t) => t?.startsWith('Sede:')) ?? null),
      filas: await rows(page),
    }
  }

  out.erroresConsola = await consoleErrors(page)
  return out
}
