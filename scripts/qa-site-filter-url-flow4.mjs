// QA parte 4: URL compartible con recarga en frio (riesgos y empleados) y limpieza final.
async function rows(page) {
  return page.locator('tbody tr').count()
}
const chipLabel = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.MuiChip-label')].map((c) => c.textContent).find((t) => t?.startsWith('Sede:')) ?? null)
const hash = (page) => page.evaluate(() => window.location.hash)

export default async function run(page, ui) {
  const out = {}
  await page.setViewportSize({ width: 1680, height: 1050 })
  const siteId = await page.evaluate(() => window.__qaSiteId ?? null)
  if (!siteId) return { error: 'no siteId guardado en la sesion' }

  // 1) Recarga en frio: riesgos con sede en la URL.
  await page.goto('http://localhost:5180/#/risks?site=' + siteId)
  await page.reload()
  await page.waitForFunction(() => document.body.innerText.includes('Matriz de riesgos'), { timeout: 20000 })
  await page.waitForTimeout(2000)
  out.riesgosDesdeUrl = {
    url: await hash(page),
    chip: await chipLabel(page),
    filas: await rows(page),
  }

  // 2) Recarga en frio: empleados con sede en la URL.
  await page.goto('http://localhost:5180/#/employees?site=' + siteId)
  await page.reload()
  await page.waitForFunction(() => document.body.innerText.includes('CRUD Empleados'), { timeout: 20000 })
  await page.waitForTimeout(2000)
  out.empleadosDesdeUrl = {
    url: await hash(page),
    chip: await chipLabel(page),
    filas: await rows(page),
  }

  // 3) Limpieza final: X del chip y reload sin hash (queda dashboard).
  const x = page.locator('.MuiChip-deleteIcon').first()
  if (await x.isVisible().catch(() => false)) {
    await x.click()
    await page.waitForTimeout(1500)
  }
  out.trasLimpiar = {
    url: await hash(page),
    chip: await chipLabel(page),
  }
  await page.evaluate(() => { window.location.hash = '' })
  await page.reload()
  await page.waitForFunction(() => document.body.innerText.includes('Rol de sesion'), { timeout: 20000 })
  await page.waitForTimeout(1500)
  out.reloadSinHash = {
    url: await hash(page),
    sedesPanelVisible: await page.evaluate(() => [...document.querySelectorAll('h6')].some((h) => h.textContent?.trim() === 'Sedes')),
    kpiCards: await page.evaluate(() => document.querySelectorAll('.kpi-card').length),
  }

  out.erroresConsola = await page.evaluate(() => window.__errs ?? [])
  return out
}
