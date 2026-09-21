// QA: asignacion/desasignacion de sedes en Empleados como ADMIN.
export default async function run(page, ui) {
  const out = {}
  await page.setViewportSize({ width: 1680, height: 1050 })
  await page.evaluate(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.error?.stack || e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason?.stack || e.reason)))
  })

  // La sesion puede venir ya autenticada (perfil del navegador persistente).
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
  }
  await page.waitForFunction(() => document.body.innerText.includes('Rol de sesion'), { timeout: 20000 })
  await page.waitForTimeout(2000)
  out.login = yaAutenticado ? 'sesion previa' : 'ok'

  // Navegar a Empleados
  await page.getByRole('button', { name: 'Empleados' }).click()
  await page.waitForTimeout(2500)

  // 1) Columna Sede con datos sembrados
  out.tabla = {
    columnaSede: await page.getByRole('columnheader', { name: 'Sede' }).count(),
    filas: await page.locator('tbody tr').count(),
    plantaEnFilas: await page.locator('tbody tr', { hasText: 'Planta Norte' }).count(),
  }

  const filaLaura = page.locator('tbody tr', { hasText: 'Laura' })

  // 2) Abrir edicion de Laura y verificar el selector de sede
  await filaLaura.getByRole('button').first().click()
  const dialogo = page.getByRole('dialog')
  await dialogo.waitFor({ state: 'visible', timeout: 10000 })
  out.dialogoAbierto = await dialogo.getByText('Editar empleado').count() > 0

  const sedeSelect = dialogo.getByLabel('Sede', { exact: true })
  out.selectorSedeVisible = await sedeSelect.count()

  // 3) Desasignar: elegir "Sin sede"
  await sedeSelect.click()
  await page.getByRole('option', { name: 'Sin sede' }).click()
  await dialogo.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(3000)

  out.trasDesasignar = {
    lauraConSede: await page.locator('tbody tr', { hasText: 'Laura' }).filter({ hasText: 'Planta Norte' }).count(),
    lauraSinSede: (await page.locator('tbody tr', { hasText: 'Laura' }).textContent())?.includes('-') ?? false,
  }

  // 4) Reasignar a Planta Norte
  await page.locator('tbody tr', { hasText: 'Laura' }).getByRole('button').first().click()
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 })
  const sedeSelect2 = page.getByRole('dialog').getByLabel('Sede', { exact: true })
  await sedeSelect2.click()
  await page.getByRole('option', { name: /Planta Norte/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(3000)

  out.trasReasignar = {
    lauraConSede: await page.locator('tbody tr', { hasText: 'Laura' }).filter({ hasText: 'Planta Norte' }).count(),
  }

  out.errores = await page.evaluate(() => window.__errs ?? [])
  return out
}
