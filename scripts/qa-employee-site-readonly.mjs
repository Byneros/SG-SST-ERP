// QA EMPLOYEE: ve la columna Sede en solo-lectura, sin acciones de gestion.
export default async function run(page, ui) {
  const out = {}
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

  await page.getByRole('button', { name: 'Empleados' }).click()
  await page.waitForTimeout(2500)

  out.vista = {
    columnaSede: await page.getByRole('columnheader', { name: 'Sede' }).count(),
    filasConPlantaNorte: await page.locator('tbody tr', { hasText: 'Planta Norte' }).count(),
    filasTotales: await page.locator('tbody tr').count(),
    botonNuevoVisible: (await page.getByRole('button', { name: 'Nuevo' }).count()) > 0,
    botonesEdicionHabilitados: await page.locator('tbody button:not([disabled])').count(),
  }
  out.errores = await page.evaluate(() => window.__errs ?? [])
  return out
}
