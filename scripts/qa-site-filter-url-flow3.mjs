// QA parte 3: conteo de riesgos -> Riesgos filtrado; chip X -> limpiar; URL compartible.
async function rows(page) {
  return page.locator('tbody tr').count()
}
const chipLabel = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.MuiChip-label')].map((c) => c.textContent).find((t) => t?.startsWith('Sede:')) ?? null)
const hash = (page) => page.evaluate(() => window.location.hash)

export default async function run(page, ui) {
  const out = {}
  await page.setViewportSize({ width: 1680, height: 1050 })
  await page.evaluate(() => {
    window.__errs = window.__errs ?? []
    window.addEventListener('error', (e) => window.__errs.push(String(e.error?.stack || e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason?.stack || e.reason)))
  })

  // Estado actual: Incidentes filtrado por Planta Norte (de la parte 2), chip activo.
  out.incidentes = {
    url: await hash(page),
    chip: await chipLabel(page),
    filas: await rows(page),
  }

  // 1) Limpiar filtro con la X del chip (queda en Incidentes, sin filtro).
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

  // 2) Dashboard (nav button) -> click en el conteo de RIESGOS de Planta Norte.
  await page.getByRole('button', { name: 'Dashboard' }).click()
  await page.waitForTimeout(1500)
  const siteId = await page.evaluate(() => window.__qaSiteId ?? null)
  await page.locator('tbody tr', { hasText: 'Planta Norte' }).locator('td').nth(2).click()
  await page.waitForTimeout(2000)
  out.riesgos = {
    url: await hash(page),
    chip: await chipLabel(page),
    filas: await rows(page),
  }

  // 3) URL compartible: recarga en frio de riesgos y empleados con sede.
  if (siteId) {
    await page.goto('http://localhost:5180/#/risks?site=' + siteId)
    await page.reload()
    await page.waitForFunction(() => document.body.innerText.includes('Matriz de riesgos'), { timeout: 20000 })
    await page.waitForTimeout(2000)
    out.riesgosDesdeUrl = {
      url: await hash(page),
      chip: await chipLabel(page),
      filas: await rows(page),
    }
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
