// QA parte 2: conteo de incidentes -> Incidentes filtrado; chip X -> limpiar; URL compartible.
async function rows(page) {
  return page.locator('tbody tr').count()
}
const chipLabel = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.MuiChip-label')].map((c) => c.textContent).find((t) => t?.startsWith('Sede:')) ?? null)
const hash = (page) => page.evaluate(() => window.location.hash)

export default async function run(page, ui) {
  const out = {}
  // Sesion ya autenticada en la parte 1; asegurar viewport y captura de errores.
  await page.setViewportSize({ width: 1680, height: 1050 })
  await page.evaluate(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.error?.stack || e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason?.stack || e.reason)))
  })

  // Ir al Dashboard limpio.
  await page.evaluate(() => { window.location.hash = '#/dashboard' })
  await page.reload()
  await page.waitForFunction(() => document.body.innerText.includes('Rol de sesion'), { timeout: 20000 })
  await page.waitForFunction(() => document.body.innerText.includes('Sedes'), { timeout: 20000 })
  await page.waitForTimeout(1200)

  // Capturar el siteId del hash de la parte 1 (guardado en la sesion).
  const siteId = await page.evaluate(() => window.__qaSiteId ?? null)
  out.siteId = siteId

  // 1) Click en el conteo de INCIDENTES de la fila Planta Norte (celda numerica de esa fila).
  const filaPlanta = page.locator('tbody tr', { hasText: 'Planta Norte' })
  const celdaIncidentes = filaPlanta.locator('td').nth(3) // Sede | Empleados | Riesgos | Incidentes
  await celdaIncidentes.click()
  await page.waitForTimeout(2000)
  out.incidentes = {
    url: await hash(page),
    chip: await chipLabel(page),
    filas: await rows(page),
  }

  // 2) Volver al dashboard y click en el conteo de RIESGOS.
  await page.evaluate(() => { window.location.hash = '#/dashboard' })
  await page.waitForTimeout(1500)
  const filaPlanta2 = page.locator('tbody tr', { hasText: 'Planta Norte' })
  await filaPlanta2.locator('td').nth(2).click()
  await page.waitForTimeout(2000)
  out.riesgos = {
    url: await hash(page),
    chip: await chipLabel(page),
    filas: await rows(page),
  }

  // 3) Limpiar filtro con la X del chip.
  const x = page.locator('.MuiChip-deleteIcon').first()
  if (await x.isVisible().catch(() => false)) {
    await x.click()
    await page.waitForTimeout(1800)
  }
  out.trasLimpiar = {
    url: await hash(page),
    chip: await chipLabel(page),
    filas: await rows(page),
  }

  // 4) URL compartible: abrir hash de riesgos con sede y RECARGAR (cold start).
  if (siteId && siteId !== 'all') {
    await page.goto('http://localhost:5180/#/risks?site=' + siteId)
    await page.reload()
    await page.waitForFunction(() => document.body.innerText.includes('Matriz de riesgos'), { timeout: 20000 })
    await page.waitForTimeout(2000)
    out.riesgosDesdeUrl = {
      url: await hash(page),
      chip: await chipLabel(page),
      filas: await rows(page),
    }
    // Y lo mismo para empleados.
    await page.goto('http://localhost:5180/#/employees?site=' + siteId)
    await page.reload()
    await page.waitForFunction(() => document.body.innerText.includes('CRUD Empleados'), { timeout: 20000 })
    await page.waitForTimeout(2000)
    out.empleadosDesdeUrl = {
      url: await hash(page),
      chip: await chipLabel(page),
      filas: await rows(page),
    }
  }

  out.erroresConsola = await page.evaluate(() => window.__errs ?? [])
  return out
}
