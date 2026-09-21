// QA EMPLOYEE: el filtro por sede muestra las sedes de su empresa y funciona.
export default async function run(page, ui) {
  const out = {}
  await page.setViewportSize({ width: 1680, height: 1050 })
  await page.evaluate(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.error?.stack || e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason?.stack || e.reason)))
  })
  await page.waitForFunction(
    () => document.body.innerText.includes('Iniciar sesion') || document.body.innerText.includes('Rol de sesion'),
    { timeout: 20000 },
  )
  await page.waitForTimeout(1000)
  const yaAutenticado = await page.evaluate(() => document.body.innerText.includes('Rol de sesion'))
  if (!yaAutenticado) {
    await page.getByLabel('Correo').fill('empleado@sgsst.com')
    await page.getByLabel('Contrasena').fill('Admin12345')
    await page.getByRole('button', { name: 'Iniciar sesion' }).click()
    await page.waitForFunction(() => document.body.innerText.includes('Rol de sesion'), { timeout: 20000 })
  }
  await page.waitForTimeout(2000)
  out.login = yaAutenticado ? 'sesion previa' : 'ok'

  await page.getByRole('button', { name: 'Empleados', exact: true }).click()
  await page.waitForTimeout(2500)

  const filtro = page.getByLabel('Sede', { exact: true })
  out.filtroVisible = (await filtro.count()) > 0
  if (!out.filtroVisible) return out

  // Opciones del filtro: Todas + 3 sedes + Sin sede
  await filtro.click()
  await page.waitForTimeout(500)
  out.opciones = await page.evaluate(() => {
    const listbox = document.querySelector('ul[role="listbox"]')
    return listbox ? [...listbox.querySelectorAll('li')].map((li) => li.textContent?.trim()) : []
  })
  await page.getByRole('option', { name: /Planta Norte/ }).click()
  await page.waitForTimeout(2000)
  out.plantaNorte = { filas: await page.locator('tbody tr').count() }

  await filtro.click()
  await page.getByRole('option', { name: 'Sin sede asignada' }).click()
  await page.waitForTimeout(2000)
  out.sinSede = { filas: await page.locator('tbody tr').count() }

  await filtro.click()
  await page.getByRole('option', { name: 'Todas las sedes' }).click()
  await page.waitForTimeout(1500)

  out.botonesGestionHabilitados = await page.locator('tbody button:not([disabled])').count()
  out.errores = await page.evaluate(() => window.__errs ?? [])
  return out
}
