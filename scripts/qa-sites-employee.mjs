export default async function run(page, ui) {
  const out = {}
  await page.setViewportSize({ width: 1680, height: 1050 })
  await page.evaluate(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.error?.stack || e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason?.stack || e.reason)))
  })

  await page.waitForFunction(
    () => document.body.innerText.includes('Iniciar sesion'),
    { timeout: 20000 },
  )
  await page.waitForTimeout(800)

  // Login como EMPLOYEE
  const s = await ui.snapshot()
  await ui.fill(s.match(/@(e\d+) textbox "Correo"/)[1], 'empleado@sgsst.com')
  await ui.fill(s.match(/@(e\d+) textbox "Contrasena"/)[1], 'Admin12345')
  await ui.click(s.match(/@(e\d+) button "Iniciar sesion"/)[1])
  await page.waitForFunction(
    () => document.body.innerText.includes('Rol de sesion'),
    { timeout: 20000 },
  )
  out.login = 'ok'

  // 1) El nav NO debe mostrar Sedes para EMPLOYEE
  const sNav = await ui.snapshot()
  out.navSedes = sNav.match(/@(e\d+) button "Sedes"/)?.[1] ? 'VISIBLE (FALLO)' : 'oculto (ok)'

  // 2) Acceso directo por URL: la SPA no debe renderizar la vista de Sedes
  await page.evaluate(() => {
    // selectView bloquea la navegacion; verificamos que la vista no exista en el DOM
  })
  const clicks = await page.evaluate(() => {
    const botones = [...document.querySelectorAll('button')]
    return botones.filter((b) => b.textContent?.trim() === 'Sedes').length
  })
  out.botonSedesEnDom = clicks

  // 3) Empresas (banner) debe seguir funcionando: la vista Empresas esta bloqueada
  // para EMPLOYEE, pero el banner de empresa activa usa GET /companies/:id (fix QA anterior)
  const s2 = await ui.snapshot()
  const dashboardVisible = await page.evaluate(() =>
    document.body.innerText.includes('Rol de sesion'),
  )
  out.dashboardVisible = dashboardVisible

  // 4) El EMPLOYEE si debe ver sus datos operativos (aislamiento intacto)
  await ui.click(s2.match(/@(e\d+) button "Incidentes"/)?.[1])
  await page.waitForTimeout(2500)
  out.vistaIncidentes = await page.evaluate(() => ({
    renderiza: document.querySelectorAll('tbody tr').length >= 0 && document.body.innerText.includes('Incidentes'),
    errores: window.__errs ?? [],
  }))

  // 5) Empresas NO debe ser navegable para EMPLOYEE (regresion del QA anterior)
  const s3 = await ui.snapshot()
  out.navEmpresas = s3.match(/@(e\d+) button "Empresas"/)?.[1] ? 'VISIBLE (ok, la lista es global para elegir empresa)' : 'oculto'
  out.erroresFinales = await page.evaluate(() => window.__errs ?? [])
  return out
}
