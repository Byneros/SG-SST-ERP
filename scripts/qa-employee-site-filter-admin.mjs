// QA ADMIN: filtro por sede en Empleados con conteos exactos.
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
    await page.getByLabel('Correo').fill('admin@sgsst.com')
    await page.getByLabel('Contrasena').fill('Admin12345')
    await page.getByRole('button', { name: 'Iniciar sesion' }).click()
    await page.waitForFunction(() => document.body.innerText.includes('Rol de sesion'), { timeout: 20000 })
  }
  await page.waitForTimeout(2000)
  out.login = yaAutenticado ? 'sesion previa' : 'ok'

  await page.getByRole('button', { name: 'Empleados', exact: true }).click()
  await page.waitForTimeout(2500)

  // Preparar datos: dejar 3 empleados en Planta Norte y 1 sin sede (QA Sede -> Bodega Sur primero)
  async function elegirSede(nombreEmpleado, opcion) {
    await page.locator('tbody tr', { hasText: nombreEmpleado }).getByRole('button').first().click()
    const d = page.getByRole('dialog')
    await d.waitFor({ state: 'visible', timeout: 10000 })
    await d.getByLabel('Sede', { exact: true }).click()
    await page.getByRole('option', { name: opcion }).click()
    await d.getByRole('button', { name: 'Guardar' }).click()
    await page.waitForTimeout(2500)
  }
  // Estado objetivo: Laura/Carlos/Diana en Planta Norte; QA Sede sin sede.
  await elegirSede('Laura', /Planta Norte/)
  await elegirSede('Carlos', /Planta Norte/)
  await elegirSede('Diana', /Planta Norte/)
  await elegirSede('QA Sede', 'Sin sede')
  out.preparacion = 'ok'

  const filtro = page.getByLabel('Sede', { exact: true })

  async function leerTabla() {
    return {
      filas: await page.locator('tbody tr').count(),
      errorVisible: (await page.getByRole('alert').count()) > 0,
      textoAlerta: (await page.getByRole('alert').count()) ? await page.getByRole('alert').textContent() : '',
    }
  }

  // 1) Todas las sedes
  await filtro.click()
  await page.getByRole('option', { name: 'Todas las sedes' }).click()
  await page.waitForTimeout(2000)
  out.todas = await leerTabla()

  // 2) Planta Norte (4 empleados... 3 demo + QA-0001 no;Laura/Carlos/Diana = 3)
  await filtro.click()
  await page.getByRole('option', { name: /Planta Norte/ }).click()
  await page.waitForTimeout(2000)
  out.plantaNorte = await leerTabla()

  // 3) Sin sede asignada ('none')
  await filtro.click()
  await page.getByRole('option', { name: 'Sin sede asignada' }).click()
  await page.waitForTimeout(2000)
  out.sinSede = await leerTabla()

  // Volver a "todas" para dejar estado limpio
  await filtro.click()
  await page.getByRole('option', { name: 'Todas las sedes' }).click()
  await page.waitForTimeout(1500)

  out.errores = await page.evaluate(() => window.__errs ?? [])
  return out
}
