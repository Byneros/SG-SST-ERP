// Verificacion precisa: lee la celda de la columna Sede de la fila indicada.
async function celdaSede(page, nombre) {
  return page.evaluate((n) => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) =>
      r.textContent?.includes(n),
    );
    const cells = row ? [...row.querySelectorAll('td')] : [];
    // Orden: Empleado, Documento, Cargo, Contrato, Centro, Sede, Empresa, ...
    return cells[5]?.textContent?.trim() ?? '(sin fila)';
  }, nombre);
}

export default async function run(page, ui) {
  const out = {}
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

  await page.getByRole('button', { name: 'Empleados' }).click()
  await page.waitForTimeout(2500)

  out.sedeInicialLaura = await celdaSede(page, 'Laura')

  // Desasignar
  await page.locator('tbody tr', { hasText: 'Laura' }).getByRole('button').first().click()
  const dialogo = page.getByRole('dialog')
  await dialogo.waitFor({ state: 'visible', timeout: 10000 })
  await dialogo.getByLabel('Sede', { exact: true }).click()
  await page.getByRole('option', { name: 'Sin sede' }).click()
  await dialogo.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(3000)
  out.sedeTrasDesasignar = await celdaSede(page, 'Laura')

  // Reasignar
  await page.locator('tbody tr', { hasText: 'Laura' }).getByRole('button').first().click()
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('dialog').getByLabel('Sede', { exact: true }).click()
  await page.getByRole('option', { name: /Planta Norte/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(3000)
  out.sedeTrasReasignar = await celdaSede(page, 'Laura')

  // Crear empleado nuevo con sede desde el dialogo
  await page.getByRole('button', { name: 'Nuevo' }).click()
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 })
  const d = page.getByRole('dialog')
  await d.getByLabel('Nombres').fill('QA')
  await d.getByLabel('Apellidos').fill('Sede')
  await d.getByLabel(/^Documento/).fill('QA-0001')
  await d.getByLabel('Cargo').fill('Operario QA')
  await d.getByLabel('Sede', { exact: true }).click()
  await page.getByRole('option', { name: /Planta Norte/ }).click()
  await d.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(3000)
  out.sedeNuevoEmpleado = await celdaSede(page, 'QA Sede')

  out.errores = await page.evaluate(() => window.__errs ?? [])
  return out
}
